// One call that turns a user selection into intake + inventory + scan, so it
// can run in a Web Worker (off the UI thread, cancellable by terminating the
// worker). The UI requires workers for cancellation. Pure apart from reading
// the given Blobs.

import { intakeFolder, intakeZip, type IntakeOptions, type IntakeResult, type PickedFile } from "./intake";
import { buildInventory, canonicalManifest, sha256Hex, type Inventory } from "./inventory";
import { scanBundle, type CompatibilityScan } from "./scan";
import { DEFAULT_ZIP_LIMITS } from "./zip";

// Folder entries carry their relative path explicitly: structured cloning a
// File into a worker does not reliably keep webkitRelativePath.
export type AnalysisInput =
  | { kind: "zip"; file: Blob }
  | { kind: "folder"; entries: { path: string; blob: Blob }[] };

export interface AnalysisOptions extends IntakeOptions {
  // Re-reading one selection must preserve the original-path content snapshot.
  expectedSourceDigest?: string;
}

export interface AnalysisResult {
  sourceDigest: string;
  intake: IntakeResult;
  inv: Inventory;
  scan: CompatibilityScan;
}

export type Progress = (stage: "reading" | "hashing" | "scanning", done: number, total: number) => void;

export async function runAnalysis(input: AnalysisInput, opts: AnalysisOptions, onProgress: Progress = () => {}): Promise<AnalysisResult> {
  let intake: IntakeResult;
  if (input.kind === "zip") {
    // Size checked from metadata before the archive is read into memory.
    const size = input.file.size;
    if (!Number.isSafeInteger(size) || size < 0 || size > DEFAULT_ZIP_LIMITS.maxArchiveBytes) {
      intake = { source: "zip", candidateRoot: null, strippedRoot: null, files: [], issues: [{ severity: "error", code: "MK_LIMIT_EXCEEDED", message: "archive exceeds size limit" }] };
    } else {
      onProgress("reading", 0, 1);
      const bytes = new Uint8Array(await input.file.arrayBuffer());
      intake = bytes.length !== size || input.file.size !== size
        ? { source: "zip", candidateRoot: null, strippedRoot: null, files: [], issues: [{ severity: "error", code: "MK_INPUT_CHANGED", message: "archive changed while it was being read; select it again" }] }
        : intakeZip(bytes, opts);
      onProgress("reading", 1, 1);
    }
  } else {
    const picked: PickedFile[] = input.entries.map((e) => ({ webkitRelativePath: e.path, get size() { return e.blob.size; }, arrayBuffer: () => e.blob.arrayBuffer() }));
    intake = await intakeFolder(picked, opts, DEFAULT_ZIP_LIMITS, (done, total) => onProgress("reading", done, total));
  }
  const inv = await buildInventory(intake.files, (done, total) => onProgress("hashing", done, total));
  // Root selection changes manifest paths, not the selected source bytes.
  // Hash original paths so a repeated read can be compared across root choices.
  const sourceEntries = intake.strippedRoot
    ? inv.entries.map((e) => ({ ...e, path: `${intake.strippedRoot}/${e.path}` }))
    : inv.entries;
  const sourceDigest = await sha256Hex(new TextEncoder().encode(canonicalManifest(sourceEntries)));
  if (opts.expectedSourceDigest !== undefined && sourceDigest !== opts.expectedSourceDigest) {
    return {
      sourceDigest,
      intake: { source: intake.source, candidateRoot: null, strippedRoot: null, files: [], issues: [{ severity: "error", code: "MK_INPUT_CHANGED", message: "source contents changed since the previous read; select the input again" }] },
      inv: await buildInventory([]),
      scan: scanBundle([]),
    };
  }
  onProgress("scanning", 0, 1);
  const scan = scanBundle(intake.files);
  onProgress("scanning", 1, 1);
  return { sourceDigest, intake, inv, scan };
}

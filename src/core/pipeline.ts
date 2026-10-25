// One call that turns a user selection into intake + inventory + scan, so it
// can run in a Web Worker (off the UI thread, cancellable by terminating the
// worker) or inline as a fallback. Pure apart from reading the given Blobs.

import { intakeFolder, intakeZip, type IntakeOptions, type IntakeResult, type PickedFile } from "./intake";
import { buildInventory, type Inventory } from "./inventory";
import { scanBundle, type ScanReport } from "./scan";
import { DEFAULT_ZIP_LIMITS } from "./zip";

// Folder entries carry their relative path explicitly: structured cloning a
// File into a worker does not reliably keep webkitRelativePath.
export type AnalysisInput =
  | { kind: "zip"; file: Blob }
  | { kind: "folder"; entries: { path: string; blob: Blob }[] };

export interface AnalysisResult {
  intake: IntakeResult;
  inv: Inventory;
  scan: ScanReport;
}

export type Progress = (stage: "reading" | "hashing" | "scanning", done: number, total: number) => void;

export async function runAnalysis(input: AnalysisInput, opts: IntakeOptions, onProgress: Progress = () => {}): Promise<AnalysisResult> {
  let intake: IntakeResult;
  if (input.kind === "zip") {
    // Size checked from metadata before the archive is read into memory.
    if (input.file.size > DEFAULT_ZIP_LIMITS.maxArchiveBytes) {
      intake = { source: "zip", candidateRoot: null, strippedRoot: null, files: [], issues: [{ severity: "error", code: "MK_LIMIT_EXCEEDED", message: "archive exceeds size limit" }] };
    } else {
      onProgress("reading", 0, 1);
      intake = intakeZip(new Uint8Array(await input.file.arrayBuffer()), opts);
      onProgress("reading", 1, 1);
    }
  } else {
    const picked: PickedFile[] = input.entries.map((e) => ({ webkitRelativePath: e.path, size: e.blob.size, arrayBuffer: () => e.blob.arrayBuffer() }));
    intake = await intakeFolder(picked, opts, DEFAULT_ZIP_LIMITS, (done, total) => onProgress("reading", done, total));
  }
  const inv = await buildInventory(intake.files, (done, total) => onProgress("hashing", done, total));
  onProgress("scanning", 0, 1);
  const scan = scanBundle(intake.files);
  onProgress("scanning", 1, 1);
  return { intake, inv, scan };
}

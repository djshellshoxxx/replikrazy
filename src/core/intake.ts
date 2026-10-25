// Turns a ZIP archive or a picked folder into a validated in-memory bundle.
// Intake never modifies file bytes. Names are only changed by stripping one
// common wrapper folder, and only when the caller explicitly asks for it
// (research T-ART-02: root selection is a visible user choice).

import { compareUtf8, findCaseCollisions, findFileDirConflicts, validatePath } from "./paths";
import { DEFAULT_ZIP_LIMITS, readZip, ZipError, type ZipLimits } from "./zip";

export interface BundleFile {
  path: string;
  bytes: Uint8Array;
}

export interface IntakeIssue {
  severity: "error" | "warning";
  code?: string;
  path?: string;
  message: string;
}

export interface IntakeOptions {
  // Strip the single top-level folder, if there is one. Off by default.
  stripRoot?: boolean;
}

export interface IntakeResult {
  source: "zip" | "folder";
  // Single top-level folder shared by every file, offered to the user as a
  // root choice; null when there is none.
  candidateRoot: string | null;
  strippedRoot: string | null;
  files: BundleFile[];
  issues: IntakeIssue[];
}

const failed = (source: IntakeResult["source"], message: string, code: string): IntakeResult => ({
  source, candidateRoot: null, strippedRoot: null, files: [], issues: [{ severity: "error", code, message }],
});

// If every file lives under the same single top-level folder (the usual shape
// of "zip the site folder"), strip it so index.html ends up at the root.
export function commonRoot(paths: readonly string[]): string | null {
  if (paths.length === 0) return null;
  const first = paths[0]!.split("/")[0]!;
  if (!paths.every((p) => p.includes("/") && p.split("/")[0] === first)) return null;
  return first;
}

function finish(
  source: IntakeResult["source"],
  raw: { name: string; bytes: Uint8Array }[],
  issues: IntakeIssue[],
  opts: IntakeOptions,
): IntakeResult {
  const valid: BundleFile[] = [];
  for (const r of raw) {
    const v = validatePath(r.name);
    if (v.ok) valid.push({ path: v.path, bytes: r.bytes });
    else issues.push({ severity: "error", code: "MK_PATH_INVALID", path: r.name, message: `rejected path: ${v.reason}` });
  }
  const root = commonRoot(valid.map((f) => f.path));
  const strip = opts.stripRoot && root ? root : null;
  const files = strip
    ? valid.map((f) => ({ path: f.path.slice(strip.length + 1), bytes: f.bytes }))
    : valid;
  files.sort((a, b) => compareUtf8(a.path, b.path));

  for (const group of findCaseCollisions(files.map((f) => f.path))) {
    issues.push({ severity: "error", code: "MK_PATH_COLLISION", path: group.join(", "), message: "paths collide after Unicode normalisation and case folding" });
  }
  for (const p of findFileDirConflicts(files.map((f) => f.path))) {
    issues.push({ severity: "error", code: "MK_PATH_COLLISION", path: p, message: "path is both a file and a folder" });
  }
  if (files.length === 0) issues.push({ severity: "error", code: "MK_INPUT_EMPTY", message: "bundle contains no usable files" });
  return { source, candidateRoot: root, strippedRoot: strip, files, issues };
}

export function intakeZip(buf: Uint8Array, opts: IntakeOptions = {}, limits: ZipLimits = DEFAULT_ZIP_LIMITS): IntakeResult {
  try {
    const { entries, rejected } = readZip(buf, limits);
    const issues: IntakeIssue[] = rejected.map((r) => ({
      severity: "error",
      code: r.code,
      path: r.name,
      message: `rejected entry: ${r.reason}`,
    }));
    return finish("zip", entries, issues, opts);
  } catch (e) {
    return e instanceof ZipError ? failed("zip", e.message, e.code) : failed("zip", "unreadable archive", "MK_ZIP_CORRUPT");
  }
}

// Minimal shape of a File from <input webkitdirectory>, so tests can pass
// plain objects. webkitRelativePath includes the picked folder's own name.
export interface PickedFile {
  webkitRelativePath: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export async function intakeFolder(
  picked: readonly PickedFile[],
  opts: IntakeOptions = {},
  limits: ZipLimits = DEFAULT_ZIP_LIMITS,
  onProgress: (done: number, total: number) => void = () => {},
): Promise<IntakeResult> {
  const issues: IntakeIssue[] = [];
  if (picked.length > limits.maxEntries) return failed("folder", "too many files", "MK_LIMIT_EXCEEDED");
  const raw: { name: string; bytes: Uint8Array }[] = [];
  let total = 0;
  // Sizes are checked from metadata before reading, so an oversized pick is
  // refused without loading it into memory.
  for (const f of picked) {
    if (f.size > limits.maxFileBytes) {
      issues.push({ severity: "error", code: "MK_LIMIT_EXCEEDED", path: f.webkitRelativePath, message: "file exceeds size limit" });
      continue;
    }
    total += f.size;
    if (total > limits.maxTotalBytes) return failed("folder", "total size exceeds limit", "MK_LIMIT_EXCEEDED");
    const bytes = new Uint8Array(await f.arrayBuffer());
    // The file changed between listing and reading (MK_INPUT_CHANGED).
    if (bytes.length !== f.size) return failed("folder", "a file changed while it was being read; select the folder again", "MK_INPUT_CHANGED");
    raw.push({ name: f.webkitRelativePath, bytes });
    onProgress(raw.length, picked.length);
  }
  return finish("folder", raw, issues, opts);
}

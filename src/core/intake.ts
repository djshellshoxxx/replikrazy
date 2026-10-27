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
  directories: string[] = [],
): IntakeResult {
  // Determine the wrapper before rejecting any names. Otherwise a rejected
  // sibling can make an originally mixed input appear to have a common root.
  // A wrapper must itself be safe; stripping never launders traversal/control
  // characters. Payload length/depth limits apply after the explicit choice.
  const names = [...raw.map((r) => r.name), ...directories.map((p) => `${p}/`), ...issues.flatMap((i) => i.path === undefined ? [] : [i.path])];
  const candidate = commonRoot(names);
  const root = candidate && validatePath(candidate).ok ? candidate : null;
  const strip = opts.stripRoot && root ? root : null;
  const files: BundleFile[] = [];
  for (const r of raw) {
    const path = strip ? r.name.slice(strip.length + 1) : r.name;
    const v = validatePath(path);
    if (v.ok) files.push({ path: v.path, bytes: r.bytes });
    else issues.push({ severity: "error", code: "MK_PATH_INVALID", path: r.name, message: `rejected path: ${v.reason}` });
  }
  for (const name of directories) {
    // An explicit wrapper's own directory record becomes the selected root.
    if (strip && name === strip) continue;
    const path = strip ? name.slice(strip.length + 1) : name;
    const v = validatePath(path);
    if (!v.ok) issues.push({ severity: "error", code: "MK_PATH_INVALID", path: name, message: `rejected directory path: ${v.reason}` });
  }
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
    const { entries, directories, rejected } = readZip(buf, limits, true);
    const issues: IntakeIssue[] = rejected.map((r) => ({
      severity: "error",
      code: r.code,
      path: r.name,
      message: `rejected entry: ${r.reason}`,
    }));
    return finish("zip", entries, issues, opts, directories);
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
  // Capture and validate the entire size budget before reading any bytes.
  // Keep the snapshot separate from possibly changing source metadata.
  const accepted: { file: PickedFile; size: number; path: string }[] = [];
  for (const f of picked) {
    const size = f.size;
    if (!Number.isSafeInteger(size) || size < 0) return failed("folder", "invalid file size", "MK_LIMIT_EXCEEDED");
    if (size > limits.maxFileBytes) {
      issues.push({ severity: "error", code: "MK_LIMIT_EXCEEDED", path: f.webkitRelativePath, message: "file exceeds size limit" });
      continue;
    }
    total += size;
    if (!Number.isSafeInteger(total) || total > limits.maxTotalBytes) return failed("folder", "total size exceeds limit", "MK_LIMIT_EXCEEDED");
    accepted.push({ file: f, size, path: f.webkitRelativePath });
  }
  for (const { file: f, size, path } of accepted) {
    if (f.size !== size || f.webkitRelativePath !== path) return failed("folder", "a file changed before it was read; select the folder again", "MK_INPUT_CHANGED");
    const bytes = new Uint8Array(await f.arrayBuffer());
    // The file changed between listing and reading (MK_INPUT_CHANGED).
    if (bytes.length !== size || f.size !== size || f.webkitRelativePath !== path) return failed("folder", "a file changed while it was being read; select the folder again", "MK_INPUT_CHANGED");
    raw.push({ name: path, bytes });
    onProgress(raw.length, picked.length);
  }
  return finish("folder", raw, issues, opts);
}

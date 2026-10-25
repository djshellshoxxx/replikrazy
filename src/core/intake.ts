// Turns a ZIP archive or a picked folder into a validated in-memory bundle.
// Intake never modifies file bytes. Names are only changed by stripping one
// common wrapper folder, and that is recorded in the result.

import { findCaseCollisions, findFileDirConflicts, validatePath } from "./paths";
import { DEFAULT_ZIP_LIMITS, readZip, ZipError, type ZipLimits } from "./zip";

export interface BundleFile {
  path: string;
  bytes: Uint8Array;
}

export interface IntakeIssue {
  severity: "error" | "warning";
  path?: string;
  message: string;
}

export interface IntakeResult {
  source: "zip" | "folder";
  strippedRoot: string | null;
  files: BundleFile[];
  issues: IntakeIssue[];
}

// If every file lives under the same single top-level folder (the usual shape
// of "zip the site folder"), strip it so index.html ends up at the root.
export function commonRoot(paths: readonly string[]): string | null {
  if (paths.length === 0) return null;
  const first = paths[0]!.split("/")[0]!;
  if (!paths.every((p) => p.includes("/") && p.split("/")[0] === first)) return null;
  return first;
}

function finish(source: IntakeResult["source"], raw: { name: string; bytes: Uint8Array }[], issues: IntakeIssue[]): IntakeResult {
  const valid: BundleFile[] = [];
  for (const r of raw) {
    const v = validatePath(r.name);
    if (v.ok) valid.push({ path: v.path, bytes: r.bytes });
    else issues.push({ severity: "error", path: r.name, message: `rejected path: ${v.reason}` });
  }
  const root = commonRoot(valid.map((f) => f.path));
  const files = root
    ? valid.map((f) => ({ path: f.path.slice(root.length + 1), bytes: f.bytes }))
    : valid;
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  for (const group of findCaseCollisions(files.map((f) => f.path))) {
    issues.push({ severity: "error", path: group.join(", "), message: "paths differ only by letter case" });
  }
  for (const p of findFileDirConflicts(files.map((f) => f.path))) {
    issues.push({ severity: "error", path: p, message: "path is both a file and a folder" });
  }
  if (files.length === 0) issues.push({ severity: "error", message: "bundle contains no usable files" });
  return { source, strippedRoot: root, files, issues };
}

export function intakeZip(buf: Uint8Array, limits: ZipLimits = DEFAULT_ZIP_LIMITS): IntakeResult {
  try {
    const { entries, rejected } = readZip(buf, limits);
    const issues: IntakeIssue[] = rejected.map((r) => ({
      severity: "error",
      path: r.name,
      message: `rejected entry: ${r.reason}`,
    }));
    return finish("zip", entries, issues);
  } catch (e) {
    const msg = e instanceof ZipError ? e.message : "unreadable archive";
    return { source: "zip", strippedRoot: null, files: [], issues: [{ severity: "error", message: msg }] };
  }
}

// Minimal shape of a File from <input webkitdirectory>, so tests can pass
// plain objects. webkitRelativePath includes the picked folder's own name.
export interface PickedFile {
  webkitRelativePath: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export async function intakeFolder(picked: readonly PickedFile[], limits: ZipLimits = DEFAULT_ZIP_LIMITS): Promise<IntakeResult> {
  const issues: IntakeIssue[] = [];
  if (picked.length > limits.maxEntries) {
    return { source: "folder", strippedRoot: null, files: [], issues: [{ severity: "error", message: "too many files" }] };
  }
  const raw: { name: string; bytes: Uint8Array }[] = [];
  let total = 0;
  // Sizes are checked from metadata before reading, so an oversized pick is
  // refused without loading it into memory.
  for (const f of picked) {
    if (f.size > limits.maxFileBytes) {
      issues.push({ severity: "error", path: f.webkitRelativePath, message: "file exceeds size limit" });
      continue;
    }
    total += f.size;
    if (total > limits.maxTotalBytes) {
      return { source: "folder", strippedRoot: null, files: [], issues: [{ severity: "error", message: "total size exceeds limit" }] };
    }
    raw.push({ name: f.webkitRelativePath, bytes: new Uint8Array(await f.arrayBuffer()) });
  }
  return finish("folder", raw, issues);
}

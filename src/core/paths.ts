// Path validation for files taken from an imported bundle (ZIP entry names or
// folder-picker relative paths). Every path that reaches the inventory must
// pass validatePath(); anything else is rejected with a reason, never "fixed"
// silently, so the inventory stays byte-for-byte and name-for-name faithful.

export const PATH_LIMITS = {
  maxPathLength: 1024,
  maxSegmentLength: 255,
  maxDepth: 32,
} as const;

export type PathResult =
  | { ok: true; path: string }
  | { ok: false; reason: string };

// Windows reserved device names are rejected on every platform because the
// exported bundle may be unpacked on Windows by the user or a host's tooling.
const RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
// C0 controls, DEL, and characters invalid in Windows filenames.
const BAD_CHARS = /[\u0000-\u001f\u007f<>:"|?*]/;

export function validatePath(raw: string): PathResult {
  if (raw.length === 0) return { ok: false, reason: "empty path" };
  if (raw.length > PATH_LIMITS.maxPathLength) return { ok: false, reason: "path too long" };
  if (raw.includes("\\")) return { ok: false, reason: "backslash in path" };
  if (raw.startsWith("/")) return { ok: false, reason: "absolute path" };
  if (/^[a-zA-Z]:/.test(raw)) return { ok: false, reason: "drive-letter path" };
  if (raw.normalize("NFC") !== raw) return { ok: false, reason: "path is not NFC-normalised" };

  const segments = raw.split("/");
  if (segments.length > PATH_LIMITS.maxDepth) return { ok: false, reason: "path too deep" };
  for (const seg of segments) {
    if (seg === "") return { ok: false, reason: "empty path segment" };
    if (seg === "." || seg === "..") return { ok: false, reason: "dot segment" };
    if (seg.length > PATH_LIMITS.maxSegmentLength) return { ok: false, reason: "path segment too long" };
    if (BAD_CHARS.test(seg)) return { ok: false, reason: "forbidden character" };
    if (seg.endsWith(" ") || seg.endsWith(".")) return { ok: false, reason: "trailing space or dot" };
    if (RESERVED.test(seg)) return { ok: false, reason: "reserved device name" };
  }
  return { ok: true, path: raw };
}

// Two distinct paths that fold to the same key would overwrite each other on
// case-insensitive filesystems/hosts; report them rather than pick one.
export function findCaseCollisions(paths: readonly string[]): string[][] {
  const groups = new Map<string, string[]>();
  for (const p of paths) {
    const key = p.toLowerCase();
    const g = groups.get(key);
    if (g) g.push(p);
    else groups.set(key, [p]);
  }
  return [...groups.values()].filter((g) => g.length > 1);
}

// A path that is both a file and a directory prefix ("a" and "a/b") cannot be
// written to any filesystem.
export function findFileDirConflicts(paths: readonly string[]): string[] {
  const set = new Set(paths);
  const out: string[] = [];
  for (const p of paths) {
    const segs = p.split("/");
    for (let i = 1; i < segs.length; i++) {
      const prefix = segs.slice(0, i).join("/");
      if (set.has(prefix)) out.push(prefix);
    }
  }
  return [...new Set(out)];
}

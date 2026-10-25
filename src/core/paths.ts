// Path validation for files taken from an imported bundle (ZIP entry names or
// folder-picker relative paths). Every path that reaches the inventory must
// pass validatePath(); anything else is rejected with a reason, never "fixed"
// silently, so the inventory stays byte-for-byte and name-for-name faithful.
// Rules follow research spec MK-ART-002 (conservative portability: some names
// legal on one host are rejected so every host and URL sees the same path).

export const PATH_LIMITS = {
  maxPathBytes: 240, // UTF-8 bytes, full relative path
  maxSegmentBytes: 120, // UTF-8 bytes, one component
  maxDepth: 32,
} as const;

export type PathResult =
  | { ok: true; path: string }
  | { ok: false; reason: string };

const utf8Len = (s: string) => new TextEncoder().encode(s).length;

// Windows reserved device names are rejected on every platform because the
// exported bundle may be unpacked on Windows by the user or a host's tooling.
const RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
// C0 controls and DEL.
const CONTROL = /[\u0000-\u001f\u007f]/;
// Bidi overrides/isolates can make a displayed name differ from the real one.
const BIDI = /[‪-‮⁦-⁩]/;
// Characters with divergent URL/host meaning: "#" and "?" split URLs, "%"
// creates a second (percent-decoded) spelling, the rest are invalid on Windows.
const URL_OR_FS_SPECIAL = /[?#%:*"<>|]/;

export function validatePath(raw: string): PathResult {
  if (raw.length === 0) return { ok: false, reason: "empty path" };
  if (utf8Len(raw) > PATH_LIMITS.maxPathBytes) return { ok: false, reason: "path too long" };
  if (raw.includes("\\")) return { ok: false, reason: "backslash in path" };
  if (raw.startsWith("/")) return { ok: false, reason: "absolute path" };
  if (/^[a-zA-Z]:/.test(raw)) return { ok: false, reason: "drive-letter path" };
  if (CONTROL.test(raw)) return { ok: false, reason: "control character" };
  if (BIDI.test(raw)) return { ok: false, reason: "bidirectional control character" };
  if (raw.normalize("NFC") !== raw) return { ok: false, reason: "path is not NFC-normalised" };

  const segments = raw.split("/");
  if (segments.length > PATH_LIMITS.maxDepth) return { ok: false, reason: "path too deep" };
  for (const seg of segments) {
    if (seg === "") return { ok: false, reason: "empty path segment" };
    if (seg === "." || seg === "..") return { ok: false, reason: "dot segment" };
    if (utf8Len(seg) > PATH_LIMITS.maxSegmentBytes) return { ok: false, reason: "path segment too long" };
    if (URL_OR_FS_SPECIAL.test(seg)) return { ok: false, reason: "forbidden character" };
    if (seg.endsWith(" ") || seg.endsWith(".")) return { ok: false, reason: "trailing space or dot" };
    if (RESERVED.test(seg)) return { ok: false, reason: "reserved device name" };
  }
  return { ok: true, path: raw };
}

// Collision key: NFC + case fold. JS has no full Unicode case-fold API, so we
// approximate it with upper-then-lower casing, which folds the common
// multi-character cases (ß→ss, ſ→s, ﬁ→fi) that toLowerCase alone misses. The
// Unicode data version is whatever the running JS engine ships.
export function foldKey(p: string): string {
  return p.normalize("NFC").toUpperCase().toLowerCase().normalize("NFC");
}

// Two distinct paths with the same fold key would overwrite each other on
// case-insensitive filesystems/hosts; report them rather than pick one.
export function findCaseCollisions(paths: readonly string[]): string[][] {
  const groups = new Map<string, string[]>();
  for (const p of paths) {
    const key = foldKey(p);
    const g = groups.get(key);
    if (g) g.push(p);
    else groups.set(key, [p]);
  }
  return [...groups.values()].filter((g) => g.length > 1);
}

// A path that is both a file and a directory prefix ("a" and "a/b") cannot be
// written to any filesystem. Compared on fold keys so "A" vs "a/b" is caught.
export function findFileDirConflicts(paths: readonly string[]): string[] {
  const files = new Map(paths.map((p) => [foldKey(p), p]));
  const out = new Set<string>();
  for (const p of paths) {
    const segs = foldKey(p).split("/");
    for (let i = 1; i < segs.length; i++) {
      const hit = files.get(segs.slice(0, i).join("/"));
      if (hit) out.add(hit);
    }
  }
  return [...out];
}

// Sort key per research contract: UTF-8 byte order. For well-formed strings
// this equals code-point order, which differs from JS's default UTF-16
// code-unit order only for astral vs U+E000–U+FFFF characters.
export function compareUtf8(a: string, b: string): number {
  const ia = a[Symbol.iterator]();
  const ib = b[Symbol.iterator]();
  for (;;) {
    const x = ia.next();
    const y = ib.next();
    if (x.done || y.done) return x.done && y.done ? 0 : x.done ? -1 : 1;
    const cx = x.value.codePointAt(0)!;
    const cy = y.value.codePointAt(0)!;
    if (cx !== cy) return cx < cy ? -1 : 1;
  }
}

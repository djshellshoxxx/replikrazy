// Offline comparison of a copy (e.g. files the owner saved back from a
// mirror) against the artifact inventory. Matching bytes show the copy is
// intact; they do NOT show the mirror works (MK-VER: an upload or a byte match
// is not verified live content). Differences can be legitimate host
// processing (injected analytics, minification), so they are reported, not
// judged.

import { compareUtf8 } from "./paths";
import type { InventoryEntry } from "./inventory";

export interface Comparison {
  matching: string[];
  changed: { path: string; expectedSize: number; actualSize: number; expectedSha256: string; actualSha256: string }[];
  missing: string[];
  extra: string[];
}

export function compareInventories(expected: readonly InventoryEntry[], actual: readonly InventoryEntry[]): Comparison {
  const got = new Map(actual.map((e) => [e.path, e]));
  const want = new Set(expected.map((e) => e.path));
  const out: Comparison = { matching: [], changed: [], missing: [], extra: [] };
  for (const e of expected) {
    const a = got.get(e.path);
    if (!a) out.missing.push(e.path);
    else if (a.sha256 === e.sha256 && a.size === e.size) out.matching.push(e.path);
    else out.changed.push({ path: e.path, expectedSize: e.size, actualSize: a.size, expectedSha256: e.sha256, actualSha256: a.sha256 });
  }
  for (const a of actual) if (!want.has(a.path)) out.extra.push(a.path);
  out.extra.sort(compareUtf8);
  return out;
}

export const isIdentical = (c: Comparison) => !c.changed.length && !c.missing.length && !c.extra.length;

// Prefer the original path interpretation on ties.
export function preferRootComparison(plain: Comparison, stripped: Comparison): boolean {
  const plainOverlap = plain.matching.length + plain.changed.length;
  const strippedOverlap = stripped.matching.length + stripped.changed.length;
  return strippedOverlap > plainOverlap ||
    (strippedOverlap === plainOverlap && stripped.matching.length > plain.matching.length);
}

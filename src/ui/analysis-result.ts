// Internal worker data admission, not a public recovery-record/import schema.
// Validate structure and consistency without rerunning scanner logic or hashes.
import { exactKeys, isRecord, isUInt } from "../contracts/diagnostic";
import { compareUtf8, validatePath } from "../core/paths";
import { DEFAULT_ZIP_LIMITS as limits } from "../core/zip";
import { SCAN_LIMITS } from "../core/scan";
import type { AnalysisResult, AnalysisPreflight } from "../core/pipeline";

const hash = (x: unknown): x is string => typeof x === "string" && /^[0-9a-f]{64}$/.test(x);
const text = (x: unknown): x is string => typeof x === "string" && x.length <= limits.maxMetadataBytes;
const path = (x: unknown): x is string => typeof x === "string" && validatePath(x).ok;
const list = (x: unknown, max: number): x is unknown[] => {
  if (!Array.isArray(x) || x.length > max) return false;
  for (let n = 0; n < x.length; n++) if (!Object.hasOwn(x, n)) return false;
  return true;
};
const oneOf = (x: unknown, values: string[]) => typeof x === "string" && values.includes(x);

export function isAnalysisResult(x: unknown): x is AnalysisResult {
  if (!isRecord(x) || !exactKeys(x, ["sourceDigest", "intake", "inv", "scan"]) || !hash(x.sourceDigest)) return false;
  const i = x.intake, v = x.inv, s = x.scan;
  if (!isRecord(i) || !exactKeys(i, ["source", "candidateRoot", "strippedRoot", "files", "issues"])
    || !oneOf(i.source, ["folder", "zip"]) || ![i.candidateRoot, i.strippedRoot].every((r) => r === null || (path(r) && !r.includes("/")))
    || (i.strippedRoot !== null && i.strippedRoot !== i.candidateRoot)
    || !list(i.files, limits.maxEntries) || !list(i.issues, limits.maxDirEntries + 4 * limits.maxEntries + 1)) return false;
  if (!i.issues.every((r) => isRecord(r) && exactKeys(r, ["severity", "message"], ["path", "code"])
    && oneOf(r.severity, ["error", "warning"]) && text(r.message)
    && (!Object.hasOwn(r, "path") || text(r.path)) && (!Object.hasOwn(r, "code") || text(r.code)))) return false;
  if (!isRecord(v) || !exactKeys(v, ["entries", "totalBytes", "bundleDigest"]) || !hash(v.bundleDigest)
    || !isUInt(v.totalBytes) || v.totalBytes > limits.maxTotalBytes || !list(v.entries, limits.maxEntries) || v.entries.length !== i.files.length) return false;
  let total = 0;
  for (let n = 0; n < i.files.length; n++) {
    const f = i.files[n], e = v.entries[n];
    if (!isRecord(f) || !exactKeys(f, ["path", "bytes"]) || !path(f.path) || !(f.bytes instanceof Uint8Array)
      || f.bytes.byteLength > limits.maxFileBytes || !isRecord(e) || !exactKeys(e, ["path", "size", "sha256"])
      || e.path !== f.path || e.size !== f.bytes.byteLength || !hash(e.sha256)) return false;
    if (n && compareUtf8((i.files[n - 1] as { path: string }).path, f.path) >= 0) return false;
    total += f.bytes.byteLength;
  }
  if (total !== v.totalBytes) return false;
  if (!isRecord(s) || !exactKeys(s, ["diagnosticCounts", "hints", "dependencies", "missing", "findings", "reservedPaths", "skipped", "truncated"])
    || typeof s.truncated !== "boolean" || !list(s.findings, SCAN_LIMITS.maxFindings) || !list(s.missing, SCAN_LIMITS.maxFindings)
    || !list(s.dependencies, SCAN_LIMITS.maxDependencyReferences) || !list(s.skipped, limits.maxEntries) || !s.skipped.every(path)
    || !list(s.reservedPaths, limits.maxEntries) || !s.reservedPaths.every(text)) return false;
  const h = s.hints, c = s.diagnosticCounts;
  if (!isRecord(h) || !exactKeys(h, ["assetBase", "routing", "serviceWorker", "usesOriginStorage", "usesRealtime", "hasBaseTag", "externalDependenciesComplete"])
    || !oneOf(h.assetBase, ["relative", "root", "mixed", "unknown"]) || !oneOf(h.routing, ["documents", "hash", "history", "unknown"])
    || !oneOf(h.serviceWorker, ["present", "absent", "unknown"]) || h.externalDependenciesComplete !== false
    || ![h.usesOriginStorage, h.usesRealtime, h.hasBaseTag].every((b) => typeof b === "boolean")) return false;
  if (!isRecord(c) || !exactKeys(c, ["info", "warning", "blocker", "total"]) || !Object.values(c).every(isUInt)
    || (c.info as number) + (c.warning as number) + (c.blocker as number) !== c.total) return false;
  const displayed = { info: 0, warning: 0, blocker: 0 };
  for (const f of s.findings) {
    if (!isRecord(f) || !exactKeys(f, ["code", "severity", "certainty", "message"], ["path", "secretClass"])
      || !text(f.code) || !text(f.message) || !oneOf(f.severity, ["info", "warning", "blocker"])
      || !oneOf(f.certainty, ["definite", "heuristic", "unknown"]) || (Object.hasOwn(f, "path") && !text(f.path))
      || (Object.hasOwn(f, "secretClass") && !text(f.secretClass))) return false;
    displayed[f.severity as keyof typeof displayed]++;
  }
  for (const severity of ["info", "warning", "blocker"] as const)
    if (displayed[severity] > (c[severity] as number) || (!s.truncated && displayed[severity] !== c[severity])) return false;
  if (!s.missing.every((r) => isRecord(r) && exactKeys(r, ["from", "ref", "resolved"]) && path(r.from) && text(r.ref) && text(r.resolved))) return false;
  let associations = 0;
  for (const d of s.dependencies) {
    if (!isRecord(d) || !exactKeys(d, ["origin", "roles", "files", "discovery"]) || !text(d.origin) || d.discovery !== "literal"
      || !list(d.roles, 10) || !d.roles.every((r) => oneOf(r, ["script", "style", "font", "image", "media", "api", "worker", "navigation", "unknown"]))
      || !list(d.files, limits.maxEntries) || !d.files.every(path)) return false;
    associations += d.roles.length + d.files.length;
    if (associations > 2 * SCAN_LIMITS.maxDependencyReferences) return false;
  }
  return true;
}

export function isAnalysisPreflight(x: unknown): x is AnalysisPreflight {
  if (!isRecord(x) || !exactKeys(x, ["kind", "source", "candidateRoot", "strippedRoot", "entries", "issues"])
    || x.kind !== "preflight" || !oneOf(x.source, ["folder", "zip"])
    || ![x.candidateRoot, x.strippedRoot].every(r => r === null || (path(r) && !r.includes("/")))
    || (x.strippedRoot !== null && x.strippedRoot !== x.candidateRoot)
    || !list(x.entries, limits.maxEntries) || !list(x.issues, limits.maxDirEntries + 4 * limits.maxEntries + 1)) return false;
  let total = 0;
  for (const e of x.entries) {
    if (!isRecord(e) || !exactKeys(e, ["path", "size"]) || !path(e.path) || !isUInt(e.size) || e.size > limits.maxFileBytes) return false;
    total += e.size;
  }
  return total <= limits.maxTotalBytes && x.issues.every(i => isRecord(i) && exactKeys(i, ["severity", "message"], ["path", "code"])
    && oneOf(i.severity, ["error", "warning"]) && text(i.message)
    && (!Object.hasOwn(i, "path") || text(i.path)) && (!Object.hasOwn(i, "code") || text(i.code)));
}

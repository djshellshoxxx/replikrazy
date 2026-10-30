// MK-CTR-003 owner claims only; signatures remain untrusted opaque sidecars.
import { boundedText, exactKeys, isRecord, type ErrorCode, type Result } from "./diagnostic";
import { isUtc } from "./artifact-handle";
const text = (x: unknown, max: number): x is string => typeof x === "string" && x.length <= 2 * max && boundedText(x, max);
const https = (x: unknown): x is string => {
  if (!text(x, 2048) || x.includes("#")) return false;
  try { const u = new URL(x); return u.protocol === "https:" && !u.username && !u.password; } catch { return false; }
};
export function validateProvenance(x: unknown, artifacts: ReadonlySet<string>): Result<Record<string, unknown>> {
  const reject = (code: ErrorCode): Result<Record<string, unknown>> => ({ ok: false, error: { code, messageKey: "record.provenance-unapplied", params: {}, retry: "after-user-action" } });
  if (!isRecord(x)) return reject("MK_RECORD_CORRUPT");
  if (typeof x.schemaVersion === "string" && x.schemaVersion !== "1.0") return reject("MK_SCHEMA_UNSUPPORTED");
  if (!exactKeys(x, ["schemaVersion", "artifactId", "suppliedAt", "claims"], ["ownerLabel", "sourceRevision", "sourceUrl", "buildDescription", "signature"])
    || x.schemaVersion !== "1.0" || typeof x.artifactId !== "string" || !artifacts.has(x.artifactId)
    || !isUtc(x.suppliedAt) || x.claims !== "owner-supplied-not-independently-verified") return reject("MK_RECORD_CORRUPT");
  for (const key of ["ownerLabel", "sourceRevision", "buildDescription"])
    if (Object.hasOwn(x, key) && !text(x[key], key === "buildDescription" ? 2000 : 200)) return reject("MK_RECORD_CORRUPT");
  if (Object.hasOwn(x, "sourceUrl") && !https(x.sourceUrl)) return reject("MK_RECORD_CORRUPT");
  if (Object.hasOwn(x, "signature")) {
    if (!isRecord(x.signature)) return reject("MK_RECORD_CORRUPT");
    if (new TextEncoder().encode(JSON.stringify(x.signature)).length > 64 * 1024) return reject("MK_LIMIT_EXCEEDED");
    // Do not interpret algorithm, proof or key fields as verification/trust.
    // Full recovery import and secret-material exclusion remain disabled.
  }
  return { ok: true, value: x };
}

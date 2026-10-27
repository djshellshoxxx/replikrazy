// MK-CTR-001/007/008: read-only envelope inspection, never record hydration.
import { boundedText, exactKeys, isRecord, type Result } from "./diagnostic";
import { parseRecordJson, RecordJsonError } from "./record-json";
export interface RecoverySourceInspection {
  source: string; // Exact input, including unsupported versions; not an error detail.
  result: Result<{ disposition: "read-only-unvalidated"; envelope: Record<string, unknown> }>;
}
export function inspectRecoverySource(source: string): RecoverySourceInspection {
  const reject = (code: "MK_RECORD_CORRUPT" | "MK_LIMIT_EXCEEDED" | "MK_SCHEMA_UNSUPPORTED"): RecoverySourceInspection => ({
    source, result: { ok: false, error: { code, messageKey: "record.unapplied", params: {}, retry: "after-user-action" } },
  });
  let x: unknown;
  try { x = parseRecordJson(source); } catch (e) { return reject(e instanceof RecordJsonError ? e.code : "MK_RECORD_CORRUPT"); }
  if (!isRecord(x) || typeof x.schemaVersion !== "string") return reject("MK_RECORD_CORRUPT");
  if (x.schemaVersion !== "1.0") return reject("MK_SCHEMA_UNSUPPORTED");
  if (!exactKeys(x, ["schemaVersion", "exportedAt", "engineVersion", "artifacts", "plans", "operations", "provenance"])
    || typeof x.exportedAt !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(x.exportedAt)
    || !Number.isFinite(Date.parse(x.exportedAt)) || new Date(x.exportedAt).toISOString() !== x.exportedAt
    || typeof x.engineVersion !== "string" || x.engineVersion.length > 400 || !boundedText(x.engineVersion, 200) || !x.engineVersion.length) return reject("MK_RECORD_CORRUPT");
  for (const [key, cap] of [["artifacts", 100], ["plans", 100], ["operations", 1000], ["provenance", Infinity]] as const) {
    if (!Array.isArray(x[key])) return reject("MK_RECORD_CORRUPT");
    if (x[key].length > cap) return reject("MK_LIMIT_EXCEEDED");
    if (!x[key].every(isRecord)) return reject("MK_RECORD_CORRUPT");
  }
  // Nested schemas, identities, timestamps/expiry, ledgers, secret exclusions
  // and cross-record references are not validated here. Never apply this value.
  return { source, result: { ok: true, value: { disposition: "read-only-unvalidated", envelope: x } } };
}

// Local manual-attestation convenience data. This is NOT a RecoveryRecord,
// consent receipt, verified remote evidence, or a second lifecycle engine.
import { parseRecordJson, RECORD_MAX_BYTES } from "../contracts/record-json";
import { exactKeys, isId, isRecord } from "../contracts/diagnostic";
export const STATUS_RECORD_MAX_BYTES = RECORD_MAX_BYTES;
export const statusKey = (id: string) => `replikrazy.status.v1.${id}`;
export const legacyStatusKey = (id: string) => `replikrazy.plan.${id}`;
const digest = (x: unknown) => typeof x === "string" && /^sha256:[0-9a-f]{64}$/.test(x);
const statusesValid = (x: unknown): x is Record<string, string> => isRecord(x) && Object.keys(x).length <= 16
  && Object.entries(x).every(([key, value]) => isId(key) && ["blocked", "needs-review", "ready-for-manual-export", "uploaded-by-user", "verified-by-user", "skipped"].includes(value as string));
export type StoredStatuses =
  | { kind: "empty"; statuses: null }
  | { kind: "current" | "legacy"; statuses: Record<string, string> }
  | { kind: "retained"; statuses: null; reason: "oversized" | "unsupported" | "invalid" | "stale" };

export function readStatusRecord(raw: string | null, artifactId: string, legacy = false): StoredStatuses {
  if (raw === null) return { kind: "empty", statuses: null };
  // Check UTF-16 length first to avoid allocating an oversized encoding.
  if (raw.length > STATUS_RECORD_MAX_BYTES || new TextEncoder().encode(raw).length > STATUS_RECORD_MAX_BYTES)
    return { kind: "retained", statuses: null, reason: "oversized" };
  let x: unknown;
  try { x = parseRecordJson(raw); } catch { return { kind: "retained", statuses: null, reason: "invalid" }; }
  if (!digest(artifactId)) return { kind: "retained", statuses: null, reason: "invalid" };
  if (legacy) return statusesValid(x) ? { kind: "legacy", statuses: x } : { kind: "retained", statuses: null, reason: "invalid" };
  if (!isRecord(x)) return { kind: "retained", statuses: null, reason: "invalid" };
  if (x.schemaVersion !== "1.0") return { kind: "retained", statuses: null, reason: "unsupported" };
  if (!exactKeys(x, ["schemaVersion", "kind", "artifactId", "statuses"]) || x.kind !== "replikrazy-manual-status" || !digest(x.artifactId) || !statusesValid(x.statuses))
    return { kind: "retained", statuses: null, reason: "invalid" };
  if (x.artifactId !== artifactId) return { kind: "retained", statuses: null, reason: "stale" };
  return { kind: "current", statuses: x.statuses };
}

export function writeStatusRecord(storage: Pick<Storage, "getItem" | "setItem">, artifactId: string, statuses: Record<string, string>): boolean {
  if (!digest(artifactId) || !statusesValid(statuses)) return false;
  try {
    const old = readStatusRecord(storage.getItem(statusKey(artifactId)), artifactId);
    if (old.kind === "retained") return false; // Never erase unknown/corrupt source bytes.
    storage.setItem(statusKey(artifactId), JSON.stringify({ schemaVersion: "1.0", kind: "replikrazy-manual-status", artifactId, statuses }));
    return true;
  } catch { return false; } // Optional persistence must not affect export gates.
}

// MK-CTR-006 read-only operation/attempt/evidence checks. No resume authority.
import { isUtc, type ArtifactHandle } from "./artifact-handle";
import { isId, isMKError, isRecord, isUInt, type ErrorCode, type Result } from "./diagnostic";
import { array, digest, oneOf, publicUrl, record, text, uuid } from "./record-fields";
const states = ["planned", "blocked", "awaiting-auth", "ready", "publishing", "awaiting-provider", "outcome-unknown", "reconciling", "published-unverified", "verifying", "verified", "verification-limited", "failed", "cancel-requested", "cancelled", "interrupted", "awaiting-manual"];
const phases = ["none", "resource", "upload", "commit", "pointer", "verify"];
const reject = (code: ErrorCode): Result<Record<string, unknown>> => ({ ok: false, error: { code, messageKey: "record.operation-unapplied", params: {}, retry: "after-user-action" } });
export function validateRecoveryOperation(x: unknown, plans: ReadonlyMap<string, Record<string, unknown>>, artifacts: ReadonlyMap<string, ArtifactHandle>): Result<Record<string, unknown>> {
  if (isRecord(x) && typeof x.schemaVersion === "string" && x.schemaVersion !== "1.0") return reject("MK_SCHEMA_UNSUPPORTED");
  if (!record(x, ["schemaVersion", "operationId", "kind", "planId", "artifactId", "targetId", "state", "phase", "requestKey", "actions", "attempt", "createdAt", "updatedAt", "mutationMayHaveOccurred", "verification"], ["currentActionId", "release", "lastError"])
    || x.schemaVersion !== "1.0" || !uuid(x.operationId) || !oneOf(x.kind, ["publish", "verify", "rollback"])
    || !digest(x.planId) || !plans.has(x.planId) || !digest(x.artifactId) || !artifacts.has(x.artifactId)
    || !isId(x.targetId) || !oneOf(x.state, states) || !oneOf(x.phase, phases) || !digest(x.requestKey)
    || !isUInt(x.attempt) || !isUtc(x.createdAt) || !isUtc(x.updatedAt) || x.updatedAt < x.createdAt
    || typeof x.mutationMayHaveOccurred !== "boolean" || (Object.hasOwn(x, "lastError") && !isMKError(x.lastError))) return reject("MK_RECORD_CORRUPT");
  const plan = plans.get(x.planId)!;
  if (plan.artifactId !== x.artifactId) return reject("MK_RECORD_CORRUPT");
  const target = (plan.destinations as Record<string, unknown>[]).find((t) => (t.destination as Record<string, unknown>).targetId === x.targetId);
  if (!target) return reject("MK_RECORD_CORRUPT");
  if (Array.isArray(x.actions) && x.actions.length > 1024) return reject("MK_LIMIT_EXCEEDED");
  if (!array(x.actions, 1024, isRecord) || !array(x.verification, 200_000, isRecord)) return reject("MK_RECORD_CORRUPT");
  const planned = new Set((target.operations as Record<string, unknown>[]).map((a) => a.id));
  const attempts = new Set<string>();
  const seenActionIds = new Set<string>();
  for (const a of x.actions) {
    if (!record(a, ["actionId", "requestKey", "attempt", "phase", "status", "mutationMayHaveOccurred", "updatedAt"], ["providerJobId", "providerReleaseId", "reconcileMarker"])
      || !isId(a.actionId) || !planned.has(a.actionId) || !digest(a.requestKey) || !isUInt(a.attempt)
      || !oneOf(a.phase, phases.slice(1)) || !oneOf(a.status, ["prepared", "dispatched", "acknowledged", "pending", "unknown", "not-applied", "failed"])
      || typeof a.mutationMayHaveOccurred !== "boolean" || !isUtc(a.updatedAt) || a.updatedAt < x.createdAt || a.updatedAt > x.updatedAt) return reject("MK_RECORD_CORRUPT");
    for (const key of ["providerJobId", "providerReleaseId", "reconcileMarker"]) if (Object.hasOwn(a, key) && !text(a[key], 512)) return reject("MK_RECORD_CORRUPT");
    const pair = `${a.actionId}:${a.attempt}`;
    if (attempts.has(pair)) return reject("MK_RECORD_CORRUPT");
    attempts.add(pair); seenActionIds.add(a.actionId);
    if (a.mutationMayHaveOccurred && !x.mutationMayHaveOccurred) return reject("MK_RECORD_CORRUPT");
    if (a.mutationMayHaveOccurred || a.phase !== "verify") return reject("MK_CAPABILITY_UNSUPPORTED");
  }
  if (Object.hasOwn(x, "currentActionId") && (!isId(x.currentActionId) || !seenActionIds.has(x.currentActionId))) return reject("MK_RECORD_CORRUPT");
  const paths = new Set(artifacts.get(x.artifactId)!.manifest.files.map((f) => f.path));
  const evidenceIds = new Set<string>();
  for (const v of x.verification) {
    if (!record(v, ["id", "kind", "status", "checkedAt", "method", "artifactId", "coveredPaths", "coverage"], ["sourceUrl", "limitation", "trustedKeyFingerprint"])
      || !uuid(v.id) || evidenceIds.has(v.id) || !oneOf(v.kind, ["local-byte-preservation", "provider-ack", "provider-listing", "remote-byte-match", "runtime-owner-check", "cid-proof", "signature-valid", "publisher-trusted"])
      || !oneOf(v.status, ["pass", "fail", "unknown"]) || !isUtc(v.checkedAt) || !text(v.method) || v.artifactId !== x.artifactId
      || !oneOf(v.coverage, ["all", "sample", "none"]) || !array(v.coveredPaths, paths.size, (p) => typeof p === "string" && paths.has(p))
      || new Set(v.coveredPaths).size !== v.coveredPaths.length
      || (v.coverage === "all" && v.coveredPaths.length !== paths.size) || (v.coverage === "none" && v.coveredPaths.length !== 0)
      || (Object.hasOwn(v, "sourceUrl") && !publicUrl(v.sourceUrl)) || (Object.hasOwn(v, "limitation") && !text(v.limitation))
      || (Object.hasOwn(v, "trustedKeyFingerprint") && !digest(v.trustedKeyFingerprint))) return reject("MK_RECORD_CORRUPT");
    evidenceIds.add(v.id);
    // Local inspection does not qualify remote providers, signatures or keys.
    if (!oneOf(v.kind, ["local-byte-preservation", "runtime-owner-check"]) || Object.hasOwn(v, "trustedKeyFingerprint")) return reject("MK_CAPABILITY_UNSUPPORTED");
  }
  if (x.kind !== "verify" || x.mutationMayHaveOccurred || Object.hasOwn(x, "release")) return reject("MK_CAPABILITY_UNSUPPORTED");
  return { ok: true, value: x };
}

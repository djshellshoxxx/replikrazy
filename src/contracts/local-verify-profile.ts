// Opt-in local validation profile, not a provider protocol or state engine.
import { canonicalBytes, canonicalJson } from "./canonical";
import { isId, isRecord, type ErrorCode } from "./diagnostic";
import { sha256Hex } from "../core/inventory";
import { digest } from "./record-fields";
export const LOCAL_VERIFY_PROFILE = "replikrazy-local-verify/1";
export async function localRequestKey(planId: string, targetId: string, actionId?: string): Promise<string> {
  if (!digest(planId) || !isId(targetId) || (actionId !== undefined && !isId(actionId))) throw Error("invalid local request-key inputs");
  const body = { profile: LOCAL_VERIFY_PROFILE, scope: actionId === undefined ? "operation" : "action", planId, targetId,
    ...(actionId === undefined ? {} : { actionId }) };
  return `sha256:${await sha256Hex(canonicalBytes(body))}`;
}
const phaseByState: Record<string, readonly string[]> = {
  planned: ["none"], blocked: ["none"], ready: ["none"], verifying: ["verify"],
  "cancel-requested": ["verify"], verified: ["verify"], "verification-limited": ["verify"], failed: ["verify"],
  cancelled: ["none", "verify"], interrupted: ["none", "verify"],
};
const edges: Record<string, readonly string[]> = {
  planned: ["ready", "blocked", "cancelled", "interrupted"],
  ready: ["verifying", "cancelled", "interrupted"],
  verifying: ["verified", "verification-limited", "failed", "cancel-requested", "interrupted"],
  "cancel-requested": ["cancelled", "interrupted"],
};
const attemptEdges: Record<string, readonly string[]> = {
  prepared: ["dispatched", "not-applied", "failed"], dispatched: ["acknowledged", "pending", "unknown", "failed"],
  pending: ["acknowledged", "unknown", "failed"], unknown: ["acknowledged", "not-applied", "failed"],
};
// Called only after structural operation and plan validation. No data mutation.
export async function checkLocalVerifyProfile(op: Record<string, unknown>, plan: Record<string, unknown>): Promise<ErrorCode | null> {
  if (op.kind !== "verify" || op.mutationMayHaveOccurred !== false || !phaseByState[op.state as string]?.includes(op.phase as string)) return "MK_CAPABILITY_UNSUPPORTED";
  if (op.createdAt as string < (plan.createdAt as string) || op.createdAt as string >= (plan.expiresAt as string)) return "MK_PLAN_CHANGED";
  if (await localRequestKey(op.planId as string, op.targetId as string) !== op.requestKey) return "MK_HASH_MISMATCH";
  const actions = op.actions as Record<string, unknown>[];
  const verification = op.verification as Record<string, unknown>[];
  if (op.attempt !== actions.length || (op.phase === "none" && (actions.length || verification.length))) return "MK_RECORD_CORRUPT";
  if (actions.length && op.currentActionId !== actions[actions.length - 1]!.actionId) return "MK_RECORD_CORRUPT";
  const target = (plan.destinations as Record<string, unknown>[]).find((t) => (t.destination as Record<string, unknown>).targetId === op.targetId)!;
  const planned = target.operations as Record<string, unknown>[];
  const attempts = new Map<string, number>();
  const latestStatus = new Map<string, string>();
  for (const a of actions) {
    const id = a.actionId as string;
    if (planned.find((p) => p.id === id)?.kind !== "verify" || a.phase !== "verify" || a.mutationMayHaveOccurred !== false
      || ["providerJobId", "providerReleaseId", "reconcileMarker"].some((k) => Object.hasOwn(a, k))) return "MK_CAPABILITY_UNSUPPORTED";
    // No retry-authorization receipt exists in this profile. Preserve retry
    // histories as unsupported rather than guessing permission or backoff.
    if (attempts.has(id)) return "MK_CAPABILITY_UNSUPPORTED";
    const expected = 1;
    if (a.attempt !== expected) return "MK_RECORD_CORRUPT";
    attempts.set(id, expected);
    latestStatus.set(id, a.status as string);
    if (await localRequestKey(op.planId as string, op.targetId as string, id) !== a.requestKey) return "MK_HASH_MISMATCH";
  }
  for (const evidence of verification) {
    if (evidence.checkedAt as string < (op.createdAt as string) || evidence.checkedAt as string > (op.updatedAt as string)) return "MK_RECORD_CORRUPT";
  }
  if (op.state === "verified" && (!actions.length || [...latestStatus.values()].some((status) => status !== "acknowledged")
    || !verification.some((v) => v.kind === "local-byte-preservation" && v.status === "pass" && v.coverage === "all")
    || verification.some((v) => v.status === "fail"))) return "MK_RECORD_CORRUPT";
  if (op.state === "verification-limited" && (!actions.length || actions.some((a) => ["prepared", "dispatched", "pending"].includes(a.status as string)))) return "MK_RECORD_CORRUPT";
  if (op.state === "failed" && !Object.hasOwn(op, "lastError")) return "MK_RECORD_CORRUPT";
  return null;
}
// Pair validator for already structurally/profile-valid snapshots. It neither
// advances state nor proves events occurred. Terminal states never resume.
export function isLocalVerifyTransition(previous: Record<string, unknown>, next: Record<string, unknown>): boolean {
  const from = previous.state as string, to = next.state as string;
  if (!phaseByState[from]?.includes(previous.phase as string) || !phaseByState[to]?.includes(next.phase as string)) return false;
  if (previous.phase === "verify" && next.phase !== "verify") return false;
  if (!(edges[from] ?? []).includes(to) && !(from === to && ["verifying", "cancel-requested"].includes(from))) return false;
  if (["operationId", "kind", "planId", "artifactId", "targetId", "requestKey", "createdAt"].some((k) => previous[k] !== next[k])
    || previous.mutationMayHaveOccurred !== false || next.mutationMayHaveOccurred !== false
    || typeof previous.updatedAt !== "string" || typeof next.updatedAt !== "string" || next.updatedAt < previous.updatedAt
    || !Array.isArray(previous.actions) || !Array.isArray(next.actions) || next.actions.length < previous.actions.length
    || !Array.isArray(previous.verification) || !Array.isArray(next.verification) || next.verification.length < previous.verification.length) return false;
  if (Object.hasOwn(previous, "lastError") && (!Object.hasOwn(next, "lastError") || canonicalJson(previous.lastError) !== canonicalJson(next.lastError))) return false;
  if (next.actions.length > previous.actions.length) {
    if (from === "cancel-requested" || Object.hasOwn(previous, "lastError")) return false;
    const existing = new Set(previous.actions.map((a: Record<string, unknown>) => a.actionId));
    for (const a of next.actions.slice(previous.actions.length)) {
      if (!isRecord(a) || existing.has(a.actionId)) return false;
      existing.add(a.actionId);
    }
  }
  for (let n = 0; n < previous.actions.length; n++) {
    const a = previous.actions[n], b = next.actions[n];
    if (!isRecord(a) || !isRecord(b) || ["actionId", "requestKey", "attempt", "phase"].some((k) => a[k] !== b[k])
      || typeof a.updatedAt !== "string" || typeof b.updatedAt !== "string" || b.updatedAt < a.updatedAt
      || (a.status !== b.status && !(attemptEdges[a.status as string] ?? []).includes(b.status as string))) return false;
  }
  for (let n = 0; n < previous.verification.length; n++)
    if (canonicalJson(previous.verification[n]) !== canonicalJson(next.verification[n])) return false;
  return true;
}

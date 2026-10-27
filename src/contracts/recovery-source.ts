// MK-CTR-001/007/008: read-only envelope inspection, never record hydration.
import { hasExcludedRecordMaterial } from "./record-secrets";
import { validateRecoveryOperation } from "./recovery-operation";
import { validateRecoveryPlan } from "./recovery-plan";
import type { ArtifactHandle } from "./artifact-handle";
import { validateProvenance } from "./provenance";
import { isUtc, validateArtifactHandle } from "./artifact-handle";
import { boundedText, exactKeys, isRecord, type Result } from "./diagnostic";
import { parseRecordJson, RecordJsonError } from "./record-json";
export interface RecoverySourceInspection {
  source: string; // Exact input, including unsupported versions; not an error detail.
  result: Result<{ disposition: "read-only-unvalidated"; envelope: Record<string, unknown> }>;
}
export async function inspectRecoverySource(source: string): Promise<RecoverySourceInspection> {
  const reject = (code: "MK_RECORD_CORRUPT" | "MK_LIMIT_EXCEEDED" | "MK_SCHEMA_UNSUPPORTED" | "MK_PRIVATE_DATA"): RecoverySourceInspection => ({
    source, result: { ok: false, error: { code, messageKey: "record.unapplied", params: {}, retry: "after-user-action" } },
  });
  let x: unknown;
  try { x = parseRecordJson(source); } catch (e) { return reject(e instanceof RecordJsonError ? e.code : "MK_RECORD_CORRUPT"); }
  if (hasExcludedRecordMaterial(x)) return reject("MK_PRIVATE_DATA");
  if (!isRecord(x) || typeof x.schemaVersion !== "string") return reject("MK_RECORD_CORRUPT");
  if (x.schemaVersion !== "1.0") return reject("MK_SCHEMA_UNSUPPORTED");
  if (!exactKeys(x, ["schemaVersion", "exportedAt", "engineVersion", "artifacts", "plans", "operations", "provenance"])
    || !isUtc(x.exportedAt)
    || typeof x.engineVersion !== "string" || x.engineVersion.length > 400 || !boundedText(x.engineVersion, 200) || !x.engineVersion.length) return reject("MK_RECORD_CORRUPT");
  for (const [key, cap] of [["artifacts", 100], ["plans", 100], ["operations", 1000], ["provenance", Infinity]] as const) {
    if (!Array.isArray(x[key])) return reject("MK_RECORD_CORRUPT");
    if (x[key].length > cap) return reject("MK_LIMIT_EXCEEDED");
    if (!x[key].every(isRecord)) return reject("MK_RECORD_CORRUPT");
  }
  const artifactIds = new Set<string>();
  const artifacts = new Map<string, ArtifactHandle>();
  for (const artifact of x.artifacts as unknown[]) {
    const checked = await validateArtifactHandle(artifact);
    if (!checked.ok) return { source, result: checked };
    artifactIds.add(checked.value.artifactId);
    artifacts.set(checked.value.artifactId, checked.value);
  }
  const plans = new Map<string, Record<string, unknown>>();
  for (const plan of x.plans as unknown[]) {
    const checked = await validateRecoveryPlan(plan, artifacts);
    if (!checked.ok) return { source, result: checked };
    plans.set(checked.value.planId as string, checked.value);
  }
  const operationIds = new Set<string>();
  for (const operation of x.operations as unknown[]) {
    const checked = validateRecoveryOperation(operation, plans, artifacts);
    if (!checked.ok) return { source, result: checked };
    const id = checked.value.operationId as string;
    if (operationIds.has(id)) return reject("MK_RECORD_CORRUPT");
    operationIds.add(id);
  }
  for (const provenance of x.provenance as unknown[]) {
    const checked = validateProvenance(provenance, artifactIds);
    if (!checked.ok) return { source, result: checked };
  }
  // Artifact metadata is manifest-bound; provenance remains owner claims.
  // Manual-plan/non-mutating operation structure is checked. Signatures,
  // complete secret absence, lifecycle and execution authority remain unvalidated.
  // Never apply this value.
  return { source, result: { ok: true, value: { disposition: "read-only-unvalidated", envelope: x } } };
}

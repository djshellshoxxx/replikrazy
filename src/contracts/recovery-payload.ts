// Local byte binding only. No plans, consent, statuses or execution authority.
import { validateArtifactHandle } from "./artifact-handle";
import { artifactId, buildManifest, type ArtifactManifest } from "./manifest";
import { runAnalysis, type AnalysisInput } from "../core/pipeline";
import type { ErrorCode, Result } from "./diagnostic";
export async function bindRecoveryPayload(handle: unknown, input: AnalysisInput): Promise<Result<ArtifactManifest>> {
  const reject = (code: ErrorCode): Result<never> => ({ ok: false, error: { code, messageKey: "recovery.unapplied", params: {}, retry: "after-user-action" } });
  const checked = await validateArtifactHandle(handle);
  if (!checked.ok) return checked;
  // Paths are exactly those chosen in intake; no inferred wrapper stripping.
  const analyzed = await runAnalysis(input, { requireEntrypoint: true, entrypoint: checked.value.manifest.entrypoint });
  if ("kind" in analyzed) return reject("MK_HASH_MISMATCH");
  if (analyzed.intake.issues.some(i => i.severity === "error")) return reject("MK_HASH_MISMATCH");
  const m = buildManifest(checked.value.manifest.appId, analyzed.inv.entries, checked.value.manifest.entrypoint);
  if (!m.ok || await artifactId(m.manifest) !== checked.value.artifactId) return reject("MK_HASH_MISMATCH");
  if (analyzed.scan.truncated || analyzed.scan.diagnosticCounts.blocker) return reject("MK_POLICY_BLOCKED");
  return { ok: true, value: m.manifest };
}

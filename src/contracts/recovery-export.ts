// Artifact-only local recovery export. No consent, auth, provider status or bytes.
import { validateArtifactHandle, isUtc } from "./artifact-handle";
import { RECORD_MAX_BYTES } from "./record-json";
import type { Result } from "./diagnostic";
export async function exportArtifactRecovery(handle: unknown, exportedAt: string): Promise<Result<string>> {
  const checked = await validateArtifactHandle(handle);
  if (!checked.ok) return checked;
  if (!isUtc(exportedAt)) return { ok: false, error: { code: "MK_RECORD_CORRUPT", messageKey: "recovery.export-invalid", params: {}, retry: "after-user-action" } };
  const source = JSON.stringify({ schemaVersion: "1.0", exportedAt, engineVersion: "replikrazy-local/1",
    artifacts: [checked.value], plans: [], operations: [], provenance: [] }, null, 2);
  if (new TextEncoder().encode(source).length > RECORD_MAX_BYTES) return { ok: false, error: { code: "MK_LIMIT_EXCEEDED", messageKey: "recovery.export-limit", params: {}, retry: "never" } };
  return { ok: true, value: source };
}

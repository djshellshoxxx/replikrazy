// MK-CTR-003: validate metadata and bind its manifest, not unavailable payload
// bytes. Container hashes are provenance only; timestamps are not trust proof.
import { exactKeys, isRecord, isUInt, type ErrorCode, type Result } from "./diagnostic";
import { artifactId, validateManifest, type ArtifactManifest, type Digest } from "./manifest";
export interface ArtifactHandle {
  artifactId: Digest;
  manifest: ArtifactManifest;
  totalBytes: number;
  fileCount: number;
  sourceKind: "folder" | "zip";
  sourceContainerSha256?: string;
  capturedAt: string;
}
export const isUtc = (x: unknown): x is string => typeof x === "string"
  && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(x)
  && Number.isFinite(Date.parse(x)) && new Date(x).toISOString() === x;
const reject = (code: ErrorCode): Result<ArtifactHandle> => ({ ok: false, error: { code, messageKey: "record.artifact-unapplied", params: {}, retry: "after-user-action" } });
export async function validateArtifactHandle(x: unknown): Promise<Result<ArtifactHandle>> {
  if (!isRecord(x) || !exactKeys(x, ["artifactId", "manifest", "totalBytes", "fileCount", "sourceKind", "capturedAt"], ["sourceContainerSha256"])
    || typeof x.artifactId !== "string" || !/^sha256:[0-9a-f]{64}$/.test(x.artifactId)
    || !isUInt(x.totalBytes) || !isUInt(x.fileCount) || !["zip", "folder"].includes(x.sourceKind as string) || !isUtc(x.capturedAt)
    || (Object.hasOwn(x, "sourceContainerSha256") && (typeof x.sourceContainerSha256 !== "string" || !/^[0-9a-f]{64}$/.test(x.sourceContainerSha256)))) return reject("MK_RECORD_CORRUPT");
  if (isRecord(x.manifest) && typeof x.manifest.schemaVersion === "string" && x.manifest.schemaVersion !== "1.0") return reject("MK_SCHEMA_UNSUPPORTED");
  if (validateManifest(x.manifest).length) return reject("MK_RECORD_CORRUPT");
  const manifest = x.manifest as unknown as ArtifactManifest;
  const total = manifest.files.reduce((sum, f) => sum + f.size, 0);
  if (!isUInt(total) || total !== x.totalBytes || manifest.files.length !== x.fileCount) return reject("MK_RECORD_CORRUPT");
  try {
    if (await artifactId(manifest) !== x.artifactId) return reject("MK_HASH_MISMATCH");
  } catch { return reject("MK_INTERNAL"); }
  return { ok: true, value: x as unknown as ArtifactHandle };
}

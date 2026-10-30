import { artifactId, type ArtifactManifest } from "../src/contracts/manifest";
import { buildPublishPlan } from "../src/contracts/publish-plan";
import { buildPlan } from "../src/core/plan";
import { analyze } from "../src/core/analyze";
import { getProvider } from "../src/providers/catalogue";
export async function recoveryFixture() {
  const manifest: ArtifactManifest = { schemaVersion: "1.0", appId: "site", files: [{ path: "index.html", size: 0, sha256: "a".repeat(64) }], entrypoint: "index.html" };
  const id = await artifactId(manifest);
  const use = { category: "personal" as const, containsPrivateData: false as const, ownerHasRights: true, description: "public example" };
  const providers = [getProvider("netlify")!];
  const plan = await buildPublishPlan(manifest, id, use, buildPlan(id, analyze(manifest.files), false, providers, undefined, use), providers, undefined, Date.parse("2026-10-27T00:00:00.000Z"));
  return { schemaVersion: "1.0", engineVersion: "test", exportedAt: "2026-10-27T00:00:00.000Z", artifacts: [{ artifactId: id, manifest, totalBytes: 0, fileCount: 1, sourceKind: "folder", capturedAt: "2026-10-27T00:00:00.000Z" }], plans: [plan], operations: [] as Record<string, unknown>[], provenance: [] };
}

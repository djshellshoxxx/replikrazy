import { beforeAll, describe, expect, it } from "vitest";
import { artifactId, type ArtifactManifest } from "../src/contracts/manifest";
import { inspectRecoverySource } from "../src/contracts/recovery-source";
const manifest: ArtifactManifest = { schemaVersion: "1.0", appId: "site", files: [{ path: "index.html", size: 2, sha256: "a".repeat(64) }], entrypoint: "index.html" };
let handle: Record<string, any>;
beforeAll(async () => { handle = { artifactId: await artifactId(manifest), manifest, totalBytes: 2, fileCount: 1, sourceKind: "folder", capturedAt: "2026-10-27T00:00:00.000Z" }; });
const sourceOf = (artifact: unknown) => JSON.stringify({ schemaVersion: "1.0", engineVersion: "test", exportedAt: "2026-10-27T00:00:00.000Z", artifacts: [artifact], plans: [], operations: [], provenance: [] });
describe("recovery ArtifactHandle admission", () => {
  it("accepts a manifest-bound handle as read-only metadata", async () => {
    const source = sourceOf(handle);
    expect(await inspectRecoverySource(source)).toMatchObject({ source, result: { ok: true, value: { disposition: "read-only-unvalidated" } } });
  });
  it.each([
    ["wrong identity", (x: typeof handle) => { x.artifactId = `sha256:${"0".repeat(64)}`; }, "MK_HASH_MISMATCH"],
    ["changed file digest", (x: typeof handle) => { x.manifest.files[0].sha256 = "b".repeat(64); }, "MK_HASH_MISMATCH"],
    ["changed app identity", (x: typeof handle) => { x.manifest.appId = "other"; }, "MK_HASH_MISMATCH"],
    ["wrong total", (x: typeof handle) => { x.totalBytes = 3; }, "MK_RECORD_CORRUPT"],
    ["wrong count", (x: typeof handle) => { x.fileCount = 2; }, "MK_RECORD_CORRUPT"],
    ["fractional count", (x: typeof handle) => { x.fileCount = 1.5; }, "MK_RECORD_CORRUPT"],
    ["unknown source", (x: typeof handle) => { x.sourceKind = "remote"; }, "MK_RECORD_CORRUPT"],
    ["invalid date", (x: typeof handle) => { x.capturedAt = "2026-02-30T00:00:00.000Z"; }, "MK_RECORD_CORRUPT"],
    ["bad provenance hash", (x: typeof handle) => { x.sourceContainerSha256 = "A".repeat(64); }, "MK_RECORD_CORRUPT"],
    ["unknown field", (x: typeof handle) => { x.extra = "preserve but refuse"; }, "MK_RECORD_CORRUPT"],
    ["future manifest", (x: typeof handle) => { x.manifest.schemaVersion = "2.0"; }, "MK_SCHEMA_UNSUPPORTED"],
  ] as const)("retains and rejects %s", async (_name, mutate, code) => {
    const x = structuredClone(handle); mutate(x); const source = sourceOf(x);
    const r = await inspectRecoverySource(source);
    expect(r.source).toBe(source);
    expect(r.result).toMatchObject({ ok: false, error: { code, params: {} } });
  });
  it("does not mistake a container hash for artifact identity", async () => {
    const x: Record<string, any> = { ...handle, sourceKind: "zip", sourceContainerSha256: "b".repeat(64) };
    expect((await inspectRecoverySource(sourceOf(x))).result.ok).toBe(true);
    x.artifactId = `sha256:${x.sourceContainerSha256}`;
    expect((await inspectRecoverySource(sourceOf(x))).result).toMatchObject({ ok: false, error: { code: "MK_HASH_MISMATCH" } });
  });
});

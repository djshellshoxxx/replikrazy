import { beforeAll, describe, expect, it } from "vitest";
import { artifactId, type ArtifactManifest } from "../src/contracts/manifest";
import { inspectRecoverySource } from "../src/contracts/recovery-source";
const manifest: ArtifactManifest = { schemaVersion: "1.0", appId: "site", files: [{ path: "index.html", size: 0, sha256: "a".repeat(64) }], entrypoint: "index.html" };
let id: string;
beforeAll(async () => { id = await artifactId(manifest); });
const source = (patch: Record<string, unknown> = {}) => JSON.stringify({ schemaVersion: "1.0", engineVersion: "test", exportedAt: "2026-10-27T00:00:00.000Z", artifacts: [{ artifactId: id, manifest, totalBytes: 0, fileCount: 1, sourceKind: "folder", capturedAt: "2026-10-27T00:00:00.000Z" }], plans: [], operations: [], provenance: [{ schemaVersion: "1.0", artifactId: id, suppliedAt: "2026-10-27T00:00:00.000Z", claims: "owner-supplied-not-independently-verified", ...patch }] });
describe("read-only provenance claims", () => {
  it.each([
    [{ claims: "verified" }, "MK_RECORD_CORRUPT"],
    [{ ownerLabel: "x".repeat(201) }, "MK_RECORD_CORRUPT"],
    [{ buildDescription: "x".repeat(2001) }, "MK_RECORD_CORRUPT"],
    [{ sourceUrl: "https://user:secret@example.org/" }, "MK_RECORD_CORRUPT"],
    [{ sourceUrl: "http://example.org/" }, "MK_RECORD_CORRUPT"],
    [{ sourceUrl: "https://example.org/#" }, "MK_RECORD_CORRUPT"],
    [{ artifactId: `sha256:${"0".repeat(64)}` }, "MK_RECORD_CORRUPT"],
    [{ schemaVersion: "2.0" }, "MK_SCHEMA_UNSUPPORTED"],
    [{ suppliedAt: "yesterday" }, "MK_RECORD_CORRUPT"],
    [{ signature: { opaque: "x".repeat(65536) } }, "MK_LIMIT_EXCEEDED"],
  ])("retains invalid provenance without trusting it", async (patch, code) => {
    const raw = source(patch); const r = await inspectRecoverySource(raw);
    expect(r.source).toBe(raw);
    expect(r.result).toMatchObject({ ok: false, error: { code, params: {} } });
  });
  it("retains bounded unknown signatures without verification", async () => {
    const signature = { format: "future", proof: "opaque" };
    const raw = source({ ownerLabel: "😀".repeat(200), sourceUrl: "https://example.org/revision", signature });
    const r = await inspectRecoverySource(raw);
    expect(r.source).toBe(raw);
    expect(r.result).toMatchObject({ ok: true, value: { disposition: "read-only-unvalidated", envelope: { provenance: [{ signature }] } } });
  });
});

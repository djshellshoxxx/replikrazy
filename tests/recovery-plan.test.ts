import { beforeAll, describe, expect, it } from "vitest";
import { inspectRecoverySource } from "../src/contracts/recovery-source";
import { recoveryFixture } from "./recovery-fixture";
let fixture: Awaited<ReturnType<typeof recoveryFixture>>;
beforeAll(async () => { fixture = await recoveryFixture(); });
describe("read-only manual plan boundary", () => {
  it("recognizes a generated manual plan without applying it", async () => {
    expect((await inspectRecoverySource(JSON.stringify(fixture))).result).toMatchObject({ ok: true, value: { disposition: "read-only-unvalidated" } });
  });
  it.each([
    ["identity", (p: any) => { p.planId = `sha256:${"0".repeat(64)}`; }, "MK_HASH_MISMATCH"],
    ["artifact reference", (p: any) => { p.artifactId = `sha256:${"0".repeat(64)}`; }, "MK_RECORD_CORRUPT"],
    ["public files", (p: any) => { p.destinations[0].publicFiles = []; }, "MK_RECORD_CORRUPT"],
    ["manifest reference", (p: any) => { p.destinations[0].manifestId = `sha256:${"0".repeat(64)}`; }, "MK_RECORD_CORRUPT"],
    ["schema", (p: any) => { p.schemaVersion = "2.0"; }, "MK_SCHEMA_UNSUPPORTED"],
    ["destination count", (p: any) => { p.destinations = Array(17).fill(p.destinations[0]); }, "MK_LIMIT_EXCEEDED"],
    ["action count", (p: any) => { p.destinations[0].operations = Array(257).fill(p.destinations[0].operations[0]); }, "MK_LIMIT_EXCEEDED"],
    ["expiry order", (p: any) => { p.expiresAt = "2026-10-26T00:00:00.000Z"; }, "MK_RECORD_CORRUPT"],
    ["unknown field", (p: any) => { p.extra = true; }, "MK_RECORD_CORRUPT"],
    ["private-data declaration", (p: any) => { p.intendedUse.containsPrivateData = true; }, "MK_PRIVATE_DATA"],
  ] as const)("retains and rejects %s", async (_name, mutate, code) => {
    const record = structuredClone(fixture); mutate(record.plans[0]); const source = JSON.stringify(record);
    const result = await inspectRecoverySource(source);
    expect(result.source).toBe(source);
    expect(result.result).toMatchObject({ ok: false, error: { code, params: {} } });
  });
});

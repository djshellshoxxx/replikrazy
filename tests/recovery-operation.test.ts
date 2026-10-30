import { beforeAll, describe, expect, it } from "vitest";
import { inspectRecoverySource } from "../src/contracts/recovery-source";
import { recoveryFixture } from "./recovery-fixture";
let fixture: Awaited<ReturnType<typeof recoveryFixture>>;
const uuid = "12345678-1234-4234-8234-123456789abc";
beforeAll(async () => { fixture = await recoveryFixture(); });
const operation = () => ({ schemaVersion: "1.0", operationId: uuid, kind: "verify", planId: fixture.plans[0]!.planId, artifactId: fixture.artifacts[0]!.artifactId, targetId: "netlify", state: "planned", phase: "none", requestKey: `sha256:${"a".repeat(64)}`, actions: [], attempt: 0, createdAt: "2026-10-27T00:00:00.000Z", updatedAt: "2026-10-27T00:00:00.000Z", mutationMayHaveOccurred: false, verification: [] });
describe("read-only operation references", () => {
  it("recognizes a non-mutating record without resuming it", async () => {
    expect((await inspectRecoverySource(JSON.stringify({ ...fixture, operations: [operation()] }))).result.ok).toBe(true);
  });
  it.each([
    { operationId: "bad" }, { planId: `sha256:${"0".repeat(64)}` }, { artifactId: `sha256:${"0".repeat(64)}` },
    { targetId: "other" }, { state: "made-up" }, { phase: "made-up" }, { attempt: -1 }, { actions: [null] },
    { currentActionId: "missing" }, { updatedAt: "yesterday" }, { lastError: { code: "secret" } }, { verification: [null] },
  ])("rejects malformed or dangling operations", async (patch) => {
    const source = JSON.stringify({ ...fixture, operations: [{ ...operation(), ...patch }] });
    const r = await inspectRecoverySource(source);
    expect(r.source).toBe(source);
    expect(r.result).toMatchObject({ ok: false, error: { code: "MK_RECORD_CORRUPT", params: {} } });
  });
  it("bounds the ledger before inspecting attempts", async () => {
    const source = JSON.stringify({ ...fixture, operations: [{ ...operation(), actions: Array(1025).fill({}) }] });
    expect((await inspectRecoverySource(source)).result).toMatchObject({ ok: false, error: { code: "MK_LIMIT_EXCEEDED" } });
  });
  it("retains possible remote mutations as unsupported", async () => {
    const source = JSON.stringify({ ...fixture, operations: [{ ...operation(), mutationMayHaveOccurred: true, state: "outcome-unknown" }] });
    expect((await inspectRecoverySource(source)).result).toMatchObject({ ok: false, error: { code: "MK_CAPABILITY_UNSUPPORTED" } });
  });
});

const ledgerOperation = () => ({ ...operation(), state: "verifying", phase: "verify", currentActionId: "verify", attempt: 1,
  actions: [{ actionId: "verify", requestKey: `sha256:${"b".repeat(64)}`, attempt: 1, phase: "verify", status: "prepared", mutationMayHaveOccurred: false, updatedAt: "2026-10-27T00:00:00.000Z" }],
  verification: [{ id: "12345678-1234-4234-8234-123456789abd", kind: "local-byte-preservation", status: "pass", checkedAt: "2026-10-27T00:00:00.000Z", method: "owner-supplied local record", artifactId: fixture.artifacts[0]!.artifactId, coveredPaths: ["index.html"], coverage: "all" }],
});
it("recognizes bounded local verification claims without elevating them", async () => {
  const r = await inspectRecoverySource(JSON.stringify({ ...fixture, operations: [ledgerOperation()] }));
  expect(r.result).toMatchObject({ ok: true, value: { disposition: "read-only-unvalidated" } });
});
it.each([
  (x: any) => { x.actions[0].actionId = "missing"; },
  (x: any) => { x.actions.push(x.actions[0]); },
  (x: any) => { x.actions[0].attempt = 1.5; },
  (x: any) => { x.actions[0].mutationMayHaveOccurred = true; },
  (x: any) => { x.verification[0].coveredPaths = []; },
  (x: any) => { x.verification[0].coveredPaths = ["absent.html"]; },
  (x: any) => { x.verification[0].artifactId = `sha256:${"0".repeat(64)}`; },
])("rejects inconsistent attempts and evidence coverage", async (mutate) => {
  const op = ledgerOperation(); mutate(op);
  const r = await inspectRecoverySource(JSON.stringify({ ...fixture, operations: [op] }));
  expect(r.result).toMatchObject({ ok: false, error: { code: "MK_RECORD_CORRUPT" } });
});

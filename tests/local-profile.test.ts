import { expect, it } from "vitest";
import { inspectRecoverySource } from "../src/contracts/recovery-source";
import { recoveryFixture } from "./recovery-fixture";
it("requires explicitly selected profiles to reject legacy opaque keys", async () => {
  const fixture = await recoveryFixture();
  fixture.operations = [{ schemaVersion: "1.0", operationId: "12345678-1234-4234-8234-123456789abc", kind: "verify", planId: fixture.plans[0]!.planId, artifactId: fixture.artifacts[0]!.artifactId, targetId: "netlify", state: "planned", phase: "none", requestKey: `sha256:${"a".repeat(64)}`, actions: [], attempt: 0, createdAt: "2026-10-27T00:00:00.000Z", updatedAt: "2026-10-27T00:00:00.000Z", mutationMayHaveOccurred: false, verification: [] }];
  const source = JSON.stringify(fixture);
  expect((await inspectRecoverySource(source)).result.ok).toBe(true);
  const strict = await inspectRecoverySource(source, { validationProfile: "replikrazy-local-verify/1" });
  expect(strict.source).toBe(source);
  expect(strict.result).toMatchObject({ ok: false, error: { code: "MK_HASH_MISMATCH" } });
});
it("does not silently ignore an unknown profile", async () => {
  const source = JSON.stringify(await recoveryFixture());
  expect((await inspectRecoverySource(source, { validationProfile: "future-profile/2" })).result).toMatchObject({ ok: false, error: { code: "MK_SCHEMA_UNSUPPORTED" } });
});

import { LOCAL_VERIFY_PROFILE, localRequestKey, isLocalVerifyTransition } from "../src/contracts/local-verify-profile";
it("matches independently computed SHA-256/JCS vectors", async () => {
  const planId = `sha256:${"a".repeat(64)}`;
  expect(await localRequestKey(planId, "netlify")).toBe("sha256:935ebc7c3fb86c2ec50a4518a821721deb08651793b5cec6aec97d441950fe89");
  expect(await localRequestKey(planId, "netlify", "verify")).toBe("sha256:8edd438328b1652355c371782e44b89ebd0efee9f7adce8607cd87aaf2be2116");
  expect(await localRequestKey(planId, "other", "verify")).not.toBe(await localRequestKey(planId, "netlify", "verify"));
  await expect(localRequestKey(planId, "Invalid ID")).rejects.toThrow("invalid local request-key inputs");
});
async function profiledFixture() {
  const fixture = await recoveryFixture();
  const planId = fixture.plans[0]!.planId, artifactId = fixture.artifacts[0]!.artifactId;
  const ready = { schemaVersion: "1.0", operationId: "12345678-1234-4234-8234-123456789abc", kind: "verify", planId, artifactId, targetId: "netlify", state: "ready", phase: "none", requestKey: await localRequestKey(planId, "netlify"), actions: [] as any[], attempt: 0, createdAt: "2026-10-27T00:00:00.000Z", updatedAt: "2026-10-27T00:00:00.000Z", mutationMayHaveOccurred: false, verification: [] as any[] };
  const verifying = { ...ready, state: "verifying", phase: "verify", currentActionId: "verify", attempt: 1,
    actions: [{ actionId: "verify", requestKey: await localRequestKey(planId, "netlify", "verify"), attempt: 1, phase: "verify", status: "dispatched", mutationMayHaveOccurred: false, updatedAt: ready.updatedAt }] };
  const verified = { ...verifying, state: "verified", actions: [{ ...verifying.actions[0]!, status: "acknowledged" }],
    verification: [{ id: "12345678-1234-4234-8234-123456789abd", kind: "local-byte-preservation", status: "pass", checkedAt: ready.updatedAt, method: "fixture", artifactId, coveredPaths: ["index.html"], coverage: "all" }] };
  return { fixture, ready, verifying, verified };
}
it("validates new-profile snapshots while retaining their read-only disposition", async () => {
  const { fixture, ready, verifying, verified } = await profiledFixture();
  for (const operation of [ready, verifying, verified]) {
    const source = JSON.stringify({ ...fixture, operations: [operation] });
    const inspected = await inspectRecoverySource(source, { validationProfile: LOCAL_VERIFY_PROFILE });
    expect(inspected.source).toBe(source);
    expect(inspected.result).toMatchObject({ ok: true, value: { disposition: "read-only-unvalidated", validationProfile: LOCAL_VERIFY_PROFILE } });
  }
});
it.each([
  (x: any) => { x.requestKey = `sha256:${"0".repeat(64)}`; },
  (x: any) => { x.actions[0].requestKey = `sha256:${"0".repeat(64)}`; },
  (x: any) => { x.state = "verified"; },
  (x: any) => { x.phase = "none"; },
  (x: any) => { x.attempt = 2; },
  (x: any) => { x.actions.push({ ...x.actions[0], attempt: 2 }); x.attempt = 2; },
  (x: any) => { x.createdAt = "2026-10-26T00:00:00.000Z"; },
])("refuses invalid profiled snapshots without rewriting keys", async (mutate) => {
  const { fixture, verifying } = await profiledFixture(); mutate(verifying);
  const source = JSON.stringify({ ...fixture, operations: [verifying] });
  const r = await inspectRecoverySource(source, { validationProfile: LOCAL_VERIFY_PROFILE });
  expect(r.source).toBe(source); expect(r.result.ok).toBe(false);
});
it("allows only conservative forward transitions without lost history", async () => {
  const { ready, verifying, verified } = await profiledFixture();
  expect(isLocalVerifyTransition(ready, verifying)).toBe(true);
  expect(isLocalVerifyTransition(verifying, verified)).toBe(true);
  expect(isLocalVerifyTransition(ready, verified)).toBe(false);
  expect(isLocalVerifyTransition(verified, verifying)).toBe(false);
  expect(isLocalVerifyTransition(verifying, { ...verifying, state: "interrupted", actions: [] })).toBe(false);
  expect(isLocalVerifyTransition(verifying, { ...verified, requestKey: `sha256:${"0".repeat(64)}` })).toBe(false);
  expect(isLocalVerifyTransition(verifying, { ...verified, updatedAt: "2026-10-26T00:00:00.000Z" })).toBe(false);
});
it.each(["never", "after-user-action", "reconcile-first"])("does not infer retry permission from %s records", async (retry) => {
  const { fixture, verifying } = await profiledFixture();
  const previous = { ...verifying, actions: [{ ...verifying.actions[0]!, status: "failed" }], lastError: { code: "MK_INTERNAL", messageKey: "local.failed", params: {}, retry } };
  const next = { ...previous, attempt: 2, actions: [...previous.actions, { ...previous.actions[0]!, attempt: 2, status: "prepared" }] };
  expect(isLocalVerifyTransition(previous, next)).toBe(false);
  expect((await inspectRecoverySource(JSON.stringify({ ...fixture, operations: [next] }), { validationProfile: LOCAL_VERIFY_PROFILE })).result.ok).toBe(false);
});
it("does not append work after cancellation was requested", async () => {
  const { verifying } = await profiledFixture();
  const previous = { ...verifying, state: "cancel-requested", actions: [{ ...verifying.actions[0]!, status: "failed" }] };
  const next = { ...previous, attempt: 2, actions: [...previous.actions, { ...previous.actions[0]!, attempt: 2, status: "prepared" }] };
  expect(isLocalVerifyTransition(previous, next)).toBe(false);
});
it("cannot erase an earlier error to bypass the append gate", async () => {
  const { verifying } = await profiledFixture();
  const previous = { ...verifying, lastError: { code: "MK_INTERNAL", messageKey: "local.failed", params: {}, retry: "never" } };
  expect(isLocalVerifyTransition(previous, verifying)).toBe(false);
});

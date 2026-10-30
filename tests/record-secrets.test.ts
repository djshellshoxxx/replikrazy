import { expect, it } from "vitest";
import { inspectRecoverySource } from "../src/contracts/recovery-source";
const base = { schemaVersion: "2.0", future: true };
it.each([
  { access_token: "synthetic-private-value" }, { refreshToken: "synthetic-private-value" },
  { publicKeyJwk: { kty: "OKP", d: "synthetic-private-value" } },
  { localStorage: { arbitrary: "synthetic-private-value" } },
  { note: "-----BEGIN PRIVATE KEY-----\nsynthetic-private-value\n-----END PRIVATE KEY-----" },
])("quarantines structural credential material without echoing it", async (extra) => {
  const source = JSON.stringify({ ...base, extra });
  const r = await inspectRecoverySource(source);
  expect(r.source).toBe(source);
  expect(r.result).toMatchObject({ ok: false, error: { code: "MK_PRIVATE_DATA", params: {} } });
  expect(JSON.stringify(r.result)).not.toContain("synthetic-private-value");
});
it("handles a large bounded array without argument-spread exhaustion", async () => {
  const source = JSON.stringify({ ...base, futureData: Array(150_000).fill(null) });
  expect((await inspectRecoverySource(source)).result).toMatchObject({ ok: false, error: { code: "MK_SCHEMA_UNSUPPORTED" } });
});

import { describe, expect, it } from "vitest";
import { parseRecordJson, RECORD_MAX_BYTES, RecordJsonError } from "../src/contracts/record-json";
import { inspectRecoverySource } from "../src/contracts/recovery-source";
import { readStatusRecord } from "../src/core/status-record";
const envelope = { schemaVersion: "1.0", exportedAt: "2026-10-27T00:00:00.000Z", engineVersion: "test", artifacts: [], plans: [], operations: [], provenance: [] };
describe("strict record JSON", () => {
  it.each(['{"a":1,"a":2}', '{"a":1,"\\u0061":2}', '{"nested":{"x":0,"x":1}}', '[1,]', '{"x":1,}', '01', '1e400', '{"x":"\\ud800"}', 'null true'])("rejects ambiguous or malformed source %s", (raw) => {
    expect(() => parseRecordJson(raw)).toThrow(RecordJsonError);
  });
  it("matches JSON data semantics without prototype assignment", () => {
    const raw = '{"__proto__":{"x":true},"a":[null,false,-1.25e2,"😀","a\\\"b"]}';
    expect(JSON.stringify(parseRecordJson(raw))).toBe(JSON.stringify(JSON.parse(raw)));
    expect(Object.getPrototypeOf(parseRecordJson(raw))).toBeNull();
  });
  it.each(["[".repeat(66) + "0" + "]".repeat(66), " ".repeat(RECORD_MAX_BYTES + 1), "[" + "0,".repeat(200_000) + "0]"])("enforces resource limits", (raw) => {
    try { parseRecordJson(raw); throw Error("accepted oversized input"); } catch (e) { expect(e).toMatchObject({ code: "MK_LIMIT_EXCEEDED" }); }
  });
  it("rejects duplicate saved-status keys too", () => {
    expect(readStatusRecord('{"netlify":"skipped","netlify":"verified-by-user"}', `sha256:${"a".repeat(64)}`, true).kind).toBe("retained");
  });
});
describe("recovery source envelope", () => {
  it("recognizes current headers only as read-only unvalidated data", () => {
    const source = JSON.stringify(envelope);
    expect(inspectRecoverySource(source)).toMatchObject({ source, result: { ok: true, value: { disposition: "read-only-unvalidated" } } });
  });
  it.each([
    [{ schemaVersion: "2.0", future: true }, "MK_SCHEMA_UNSUPPORTED"],
    [{ ...envelope, extra: true }, "MK_RECORD_CORRUPT"],
    [{ ...envelope, exportedAt: "2026-02-30T00:00:00.000Z" }, "MK_RECORD_CORRUPT"],
    [{ ...envelope, operations: Array.from({ length: 1001 }, () => ({})) }, "MK_LIMIT_EXCEEDED"],
  ])("retains rejected source and never echoes it in an error", (data, code) => {
    const source = JSON.stringify(data);
    const r = inspectRecoverySource(source);
    expect(r.source).toBe(source);
    expect(r.result).toMatchObject({ ok: false, error: { code, params: {} } });
  });
});

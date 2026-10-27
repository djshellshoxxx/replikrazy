import { describe, expect, it, vi } from "vitest";
import { legacyStatusKey, readStatusRecord, STATUS_RECORD_MAX_BYTES, statusKey, writeStatusRecord } from "../src/core/status-record";
const id = `sha256:${"a".repeat(64)}`;
const record = (patch = {}) => JSON.stringify({ schemaVersion: "1.0", kind: "replikrazy-manual-status", artifactId: id, statuses: { netlify: "uploaded-by-user" }, ...patch });
describe("manual-status retention boundary", () => {
  it("recognizes only the explicit current format and identity", () => {
    expect(readStatusRecord(record(), id).kind).toBe("current");
    expect(readStatusRecord(record({ artifactId: `sha256:${"b".repeat(64)}` }), id)).toMatchObject({ kind: "retained", reason: "stale" });
  });
  it.each([record({ schemaVersion: "2.0" }), record({ extra: true }), record({ statuses: null }), "null", "{bad", "x".repeat(STATUS_RECORD_MAX_BYTES + 1)])("retains rejected bytes without applying or overwriting them", (raw) => {
    const store = new Map([[statusKey(id), raw]]);
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: vi.fn((k: string, v: string) => { store.set(k, v); }) };
    expect(readStatusRecord(raw, id).kind).toBe("retained");
    expect(writeStatusRecord(storage, id, { netlify: "verified-by-user" })).toBe(false);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(store.get(statusKey(id))).toBe(raw);
  });
  it("keeps legacy source in its separate key while writing current data", () => {
    const raw = '{"netlify":"uploaded-by-user"}';
    expect(readStatusRecord(raw, id).kind).toBe("retained");
    expect(readStatusRecord(raw, id, true).kind).toBe("legacy");
    const store = new Map([[legacyStatusKey(id), raw]]);
    expect(writeStatusRecord({ getItem: (k) => store.get(k) ?? null, setItem: (k, v) => { store.set(k, v); } }, id, { netlify: "skipped" })).toBe(true);
    expect(store.get(legacyStatusKey(id))).toBe(raw);
    expect(readStatusRecord(store.get(statusKey(id))!, id).kind).toBe("current");
  });
  it("refuses oversized collections and invalid states", () => {
    expect(readStatusRecord(record({ statuses: Object.fromEntries(Array.from({ length: 17 }, (_, n) => [`p${n}`, "skipped"])) }), id).kind).toBe("retained");
    expect(readStatusRecord(record({ statuses: { netlify: "published" } }), id).kind).toBe("retained");
  });
  it("contains unavailable-storage errors", () => {
    expect(writeStatusRecord({ getItem() { throw Error("denied"); }, setItem() { throw Error(); } }, id, {})).toBe(false);
  });
});

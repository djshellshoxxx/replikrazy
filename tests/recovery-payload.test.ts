import { expect, it } from "vitest";
import { bindRecoveryPayload } from "../src/contracts/recovery-payload";
import { buildInventory } from "../src/core/inventory";
import { artifactId, buildManifest } from "../src/contracts/manifest";
const bytes = new TextEncoder().encode("public");
async function fixture() {
  const inv = await buildInventory([{ path: "index.html", bytes }]);
  const m = buildManifest("restored", inv.entries, "index.html"); if (!m.ok) throw Error();
  return { artifactId: await artifactId(m.manifest), manifest: m.manifest, totalBytes: bytes.length, fileCount: 1, sourceKind: "folder", capturedAt: "2026-10-27T00:00:00.000Z" };
}
const input = (content = "public", path = "index.html") => ({ kind: "folder" as const, entries: [{ path, blob: new Blob([content]) }] });
it("matches actual bytes against the complete manifest and restores no operation state", async () => {
  const h = await fixture(); const r = await bindRecoveryPayload(h, input());
  expect(r).toEqual({ ok: true, value: h.manifest });
});
it("rejects same-size changes, absent, extra and renamed files", async () => {
  const h = await fixture();
  for (const payload of [input("PUBLIC"), input("public", "other.html"), { kind: "folder" as const, entries: [] },
    { kind: "folder" as const, entries: [...input().entries, { path: "extra.txt", blob: new Blob(["x"]) }] }]) {
    expect((await bindRecoveryPayload(h, payload)).ok).toBe(false);
  }
});
it("rejects changed metadata, unknown versions and unsafe input without changing either source", async () => {
  const h = await fixture(), original = JSON.stringify(h);
  expect((await bindRecoveryPayload({ ...h, artifactId: `sha256:${"0".repeat(64)}` }, input())).ok).toBe(false);
  expect((await bindRecoveryPayload({ ...h, manifest: { ...h.manifest, schemaVersion: "2.0" } }, input())).ok).toBe(false);
  expect((await bindRecoveryPayload(h, { kind: "folder", entries: [...input().entries, { path: "../bad", blob: new Blob(["x"]) }] })).ok).toBe(false);
  expect(JSON.stringify(h)).toBe(original);
});

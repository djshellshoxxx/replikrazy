/// <reference types="node" />
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import snapshot from "../src/research/catalogue-snapshot.json";
import { buildSnapshot, mapRecord } from "../src/research/mapper";
import { CATALOGUE } from "../src/providers/catalogue";

const SOURCE = "docs/research/mirrorkit-v13/catalog/consolidated-providers.json";
const bytes = readFileSync(SOURCE);
const source = JSON.parse(bytes.toString("utf8"));

describe("research snapshot (MK-POL-006)", () => {
  it("is exactly what the mapper produces from the published source", () => {
    const sha = createHash("sha256").update(bytes).digest("hex");
    expect(snapshot.sourceSha256).toBe(sha);
    expect(buildSnapshot(source, SOURCE, sha)).toEqual(snapshot);
  });
  it("keeps every record id and source pin id verbatim", () => {
    const ids = source.records.map((r: { id: string }) => r.id).sort();
    expect(snapshot.records.map((r) => r.id)).toEqual(ids);
    expect(snapshot.records.some((r) => r.id === "4everland")).toBe(true);
    const cf = snapshot.records.find((r) => r.id === "cloudflare_pages")!;
    expect(cf.sourcePins.map((p) => p.pinId)).toContain("S0001");
  });
  it("enables nothing: no record is browser-publish verified", () => {
    expect(snapshot.records.every((r) => r.directBrowserPublishVerified === false)).toBe(true);
  });
  it("only fills typed fields from structured data and leaves gaps null", () => {
    const m = mapRecord({ id: "x", record_class: "c", record: { operator: "free text only", free_model: "₩0 for six months" } });
    expect(m.operatorCountry).toBeNull();
    expect(m.docsLanguages).toBeNull();
    expect(m.freeModel).toBe("₩0 for six months");
    expect(m.directBrowserPublishVerified).toBe(false);
  });
  it("adapter researchIds point at real research records", () => {
    const ids = new Set(snapshot.records.map((r) => r.id));
    for (const a of CATALOGUE) if (a.researchId) expect(ids.has(a.researchId)).toBe(true);
  });
});

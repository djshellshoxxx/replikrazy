import { describe, it, expect, vi } from "vitest";
import { runAnalysis } from "../src/core/pipeline";
const input = (paths: string[]) => ({ kind: "folder" as const, entries: paths.map(path => ({ path, blob: new Blob(["public"]) })) });
describe("UI entrypoint preflight", () => {
  it.each([{ paths: ["page.html"] }, { paths: ["index.html", "bad?.txt"] }, { paths: [] }])("does not hash or scan unresolved/rejected input %j", async ({ paths }) => {
    const hash = vi.spyOn(crypto.subtle, "digest");
    const stages: string[] = [];
    const result = await runAnalysis(input(paths), { requireEntrypoint: true }, s => stages.push(s));
    expect(result).toHaveProperty("kind", "preflight");
    expect(hash).not.toHaveBeenCalled();
    expect(stages).not.toContain("hashing"); expect(stages).not.toContain("scanning");
    hash.mockRestore();
  });
  it("accepts the default or an explicit existing HTML page only", async () => {
    for (const entrypoint of ["page.html", "missing.html", "asset.txt", null]) {
      const result = await runAnalysis(input(["page.html", "asset.txt"]), { requireEntrypoint: true, entrypoint });
      expect("kind" in result).toBe(entrypoint !== "page.html");
    }
    expect(await runAnalysis(input(["index.html"]), { requireEntrypoint: true })).toHaveProperty("sourceDigest");
  });
});

it("admits only bounded preflight metadata, never pretend hashes or bytes", async () => {
  const { isAnalysisPreflight } = await import("../src/ui/analysis-result");
  const result = await runAnalysis(input(["page.html"]), { requireEntrypoint: true });
  expect(isAnalysisPreflight(result)).toBe(true);
  expect(isAnalysisPreflight({ ...result, sourceDigest: "0".repeat(64) })).toBe(false);
  expect(isAnalysisPreflight({ ...result, entries: [{ path: "../bad", size: 1 }] })).toBe(false);
  expect(isAnalysisPreflight({ ...result, entries: [{ path: "page.html", size: Infinity }] })).toBe(false);
});

import { beforeAll, describe, expect, it } from "vitest";
import { runAnalysis, type AnalysisResult } from "../src/core/pipeline";
import { AnalysisTask } from "../src/ui/analysis-task";

let valid: AnalysisResult;
beforeAll(async () => { valid = await runAnalysis({ kind: "folder", entries: [{ path: "index.html", blob: new Blob(["hello"]) }] }, {}); });
async function accept(result: unknown, expectedSourceDigest?: string) {
  let send: (ev: MessageEvent) => void = () => {};
  const worker = { terminate() {}, postMessage() {}, set onmessage(f: typeof send) { send = f; } } as unknown as Worker;
  const pending = new AnalysisTask(() => worker).run({ kind: "zip", file: new Blob() }, { expectedSourceDigest }, () => {});
  send({ data: { type: "done", result } } as MessageEvent);
  return pending;
}
describe("analysis result boundary", () => {
  it("accepts a real worker result", async () => { expect((await accept(valid)).ok).toBe(true); });
  it.each([
    (x: AnalysisResult) => { x.inv.totalBytes++; },
    (x: AnalysisResult) => { x.inv.entries[0]!.path = "other.html"; },
    (x: AnalysisResult) => { x.inv.entries[0]!.sha256 = "not-a-hash"; },
    (x: AnalysisResult) => { x.intake.files[0]!.bytes = new Uint8Array(0); },
    (x: AnalysisResult) => { x.scan.hints.externalDependenciesComplete = true as false; },
    (x: AnalysisResult) => { x.scan.findings = new Array(10_001); },
    (x: AnalysisResult) => { x.scan.diagnosticCounts.total++; },
    (x: AnalysisResult) => { x.scan.missing = [null as never]; },
    (x: AnalysisResult) => { x.scan.missing = new Array(1); },
    (x: AnalysisResult) => { x.scan.dependencies = [{ origin: "https://example.org", roles: ["invalid" as never], files: [], discovery: "literal" }]; },
  ])("rejects malformed or inconsistent internal data", async (mutate) => {
    const x = structuredClone(valid); mutate(x);
    expect(await accept(x)).toMatchObject({ ok: false, error: { code: "MK_INTERNAL" } });
  });
  it("rejects a source digest that differs from a pinned reread", async () => {
    expect(await accept(valid, "0".repeat(64))).toMatchObject({ ok: false, error: { code: "MK_INPUT_CHANGED" } });
  });
});

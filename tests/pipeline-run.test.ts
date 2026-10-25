import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { runAnalysis } from "../src/core/pipeline";
import { bytes } from "./zipcraft";

describe("runAnalysis", () => {
  const site = { "s/index.html": bytes('<img src="a.png">'), "s/a.png": bytes("png") };
  it("ZIP and folder selections give the same inventory, with progress", async () => {
    const stages: string[] = [];
    const z = await runAnalysis({ kind: "zip", file: new Blob([zipSync(site)]) }, { stripRoot: true }, (s) => stages.push(s));
    const f = await runAnalysis(
      { kind: "folder", entries: Object.entries(site).map(([path, b]) => ({ path, blob: new Blob([b]) })) },
      { stripRoot: true },
    );
    expect(z.inv.bundleDigest).toBe(f.inv.bundleDigest);
    expect(z.scan.missing).toEqual([]);
    expect(new Set(stages)).toEqual(new Set(["reading", "hashing", "scanning"]));
  });
  it("refuses an oversized archive from its size alone", async () => {
    const huge = { size: 1e12, arrayBuffer: () => { throw new Error("must not read"); } } as unknown as Blob;
    const r = await runAnalysis({ kind: "zip", file: huge }, {});
    expect(r.intake.issues[0]!.code).toBe("MK_LIMIT_EXCEEDED");
  });
});

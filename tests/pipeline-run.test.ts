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


describe("repeated selection content snapshot", () => {
  it("pins source content independently of root selection", async () => {
    const input = { kind: "zip" as const, file: new Blob([zipSync({ "site/index.html": bytes("same") })]) };
    const original = await runAnalysis(input, {}, () => {});
    const rerooted = await runAnalysis(input, { stripRoot: true, expectedSourceDigest: original.sourceDigest });
    expect(rerooted.intake.issues).toEqual([]);
    expect(rerooted.sourceDigest).toBe(original.sourceDigest);
    expect(rerooted.inv.entries[0]!.path).toBe("index.html");
  });
  it("rejects same-size content changes on a pinned reread and keeps no partial result", async () => {
    let content = "aaaa";
    const blob = { size: 4, arrayBuffer: async () => bytes(content).buffer } as Blob;
    const input = { kind: "folder" as const, entries: [{ path: "site/index.html", blob }] };
    const first = await runAnalysis(input, {});
    content = "bbbb";
    const changed = await runAnalysis(input, { stripRoot: true, expectedSourceDigest: first.sourceDigest });
    expect(changed.intake.issues.map((i) => i.code)).toEqual(["MK_INPUT_CHANGED"]);
    expect(changed.intake.files).toEqual([]);
    expect(changed.inv.entries).toEqual([]);
    expect(changed.scan.dependencies).toEqual([]);
    // A new explicit selection can establish its own different snapshot.
    expect((await runAnalysis(input, {})).sourceDigest).not.toBe(first.sourceDigest);
  });
  it("detects path changes as well as bytes, with equal file sizes", async () => {
    const blob = new Blob(["same"]);
    const first = await runAnalysis({ kind: "folder", entries: [{ path: "site/index.html", blob }] }, {});
    const renamed = await runAnalysis({ kind: "folder", entries: [{ path: "other/index.html", blob }] }, { stripRoot: true, expectedSourceDigest: first.sourceDigest });
    expect(renamed.intake.issues[0]!.code).toBe("MK_INPUT_CHANGED");
  });
  it("gives ZIP and folder sources the same snapshot digest", async () => {
    const zipped = await runAnalysis({ kind: "zip", file: new Blob([zipSync({ "site/index.html": bytes("same") })]) }, {});
    const folder = await runAnalysis({ kind: "folder", entries: [{ path: "site/index.html", blob: new Blob(["same"]) }] }, { stripRoot: true });
    expect(folder.sourceDigest).toBe(zipped.sourceDigest);
  });
});

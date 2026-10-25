import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { analyze, factIssues } from "../src/core/analyze";
import { buildExport, buildPayloadZip } from "../src/core/exporter";
import { intakeFolder, intakeZip, type PickedFile } from "../src/core/intake";
import { artifactId, buildManifest, validateManifest } from "../src/contracts/manifest";
import { buildInventory, canonicalManifest, sha256Hex } from "../src/core/inventory";
import { allowedTransitions, buildPlan, transition } from "../src/core/plan";
import { readZip } from "../src/core/zip";
import { CATALOGUE, filterCatalogue, getProvider } from "../src/providers/catalogue";
import { assess } from "../src/providers/select";
import { bytes, craftZip } from "./zipcraft";

// Synthetic site: includes a script that would be dangerous if executed. The
// pipeline must carry it as opaque bytes.
const SITE = {
  "mysite/index.html": bytes('<!doctype html><script>parent.document.title="pwned"</script><h1>Synthetic</h1>'),
  "mysite/css/a.css": bytes("h1{color:red}"),
  "mysite/img/x.bin": new Uint8Array([0, 255, 13, 10, 0]),
};

describe("intake", () => {
  it("offers the wrapper folder as a root choice but only strips it when asked", async () => {
    const plain = intakeZip(zipSync(SITE));
    expect(plain.candidateRoot).toBe("mysite");
    expect(plain.strippedRoot).toBeNull();
    expect(plain.files.map((f) => f.path)).toContain("mysite/index.html");
    const r = intakeZip(zipSync(SITE), { stripRoot: true });
    expect(r.issues).toEqual([]);
    expect(r.strippedRoot).toBe("mysite");
    expect(r.files.map((f) => f.path)).toEqual(["css/a.css", "img/x.bin", "index.html"]);
    expect(r.files[1]!.bytes).toEqual(new Uint8Array([0, 255, 13, 10, 0]));
  });
  it("reports traversal/absolute names as errors and excludes them", () => {
    const r = intakeZip(craftZip([{ name: "index.html", data: bytes("x") }, { name: "../evil", data: bytes("x") }, { name: "/abs", data: bytes("x") }]));
    expect(r.files.map((f) => f.path)).toEqual(["index.html"]);
    expect(r.issues.filter((i) => i.severity === "error")).toHaveLength(2);
  });
  it("reports case collisions", () => {
    const r = intakeZip(craftZip([{ name: "A.html", data: bytes("1") }, { name: "a.html", data: bytes("2") }]));
    expect(r.issues.some((i) => i.code === "MK_PATH_COLLISION")).toBe(true);
  });
  it("turns fatal archive errors into an issue", () => {
    const r = intakeZip(bytes("garbage"));
    expect(r.files).toEqual([]);
    expect(r.issues[0]!.severity).toBe("error");
  });
  it("reads a picked folder and refuses oversized files before reading them", async () => {
    let reads = 0;
    const pick = (p: string, data: Uint8Array, size = data.length): PickedFile => ({
      webkitRelativePath: p, size, arrayBuffer: async () => { reads++; return data.slice().buffer; },
    });
    const r = await intakeFolder([pick("site/index.html", bytes("hi")), pick("site/huge.bin", new Uint8Array(), 10 ** 9)], { stripRoot: true });
    expect(r.files.map((f) => f.path)).toEqual(["index.html"]);
    expect(r.issues[0]!.message).toBe("file exceeds size limit");
    expect(reads).toBe(1);
  });
});

describe("inventory", () => {
  it("hashes match known SHA-256 and digest is order-independent", async () => {
    expect(await sha256Hex(bytes("abc"))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    const files = intakeZip(zipSync(SITE), { stripRoot: true }).files;
    const a = await buildInventory(files);
    const b = await buildInventory([...files].reverse());
    expect(a.bundleDigest).toBe(b.bundleDigest);
    expect(a.totalBytes).toBe(files.reduce((n, f) => n + f.bytes.length, 0));
    expect(canonicalManifest(a.entries).split("\n")[0]).toMatch(/^[0-9a-f]{64} 13 css\/a\.css$/);
  });
  it("digest changes when one byte changes", async () => {
    const f1 = [{ path: "index.html", bytes: bytes("a") }];
    const f2 = [{ path: "index.html", bytes: bytes("b") }];
    expect((await buildInventory(f1)).bundleDigest).not.toBe((await buildInventory(f2)).bundleDigest);
  });
});

describe("analysis and selection", () => {
  const facts = (paths: string[]) => analyze(paths.map((p) => ({ path: p, size: 10, sha256: "" })));
  it("flags missing index, secrets and server code", () => {
    const f = facts(["about.html", ".env", "api.php", ".git/config"]);
    const msgs = factIssues(f).map((i) => i.severity + ":" + i.message.split(":")[0]);
    expect(msgs).toContain("error:no entry page");
    const chosen = factIssues(analyze([{ path: "about.html", size: 1, sha256: "" }], "about.html"));
    expect(chosen.map((i) => i.severity)).toEqual(["warning"]);
    expect(f.sensitiveFiles).toEqual([".env", ".git/config"]);
    expect(f.serverSideFiles).toEqual(["api.php"]);
  });
  it("never reports unverified limits as compatible", () => {
    for (const p of CATALOGUE) {
      const a = assess(p, facts(["index.html"]));
      if (p.maxFileBytes.value === null || p.maxFiles.value === null) {
        expect(a.verdict).not.toBe("compatible");
        expect(a.unknowns.length).toBeGreaterThan(0);
      }
    }
  });
  it("blocks over a researched limit and cites its evidence", () => {
    const many = analyze(Array.from({ length: 1001 }, (_, i) => ({ path: i ? `f${i}` : "index.html", size: 1, sha256: "" })));
    const a = assess(getProvider("cloudflare-pages")!, many);
    expect(a.verdict).toBe("incompatible");
    expect(a.blockers.join()).toMatch(/file count 1001 exceeds limit 1000 \(researched-lead, 2026-10-25\)/);
  });
  it("blocks bundles with secrets on every provider", () => {
    for (const p of CATALOGUE) expect(assess(p, facts(["index.html", "id_rsa"])).verdict).toBe("incompatible");
  });
  it("warns when _redirects would be ignored", () => {
    const a = assess(getProvider("github-pages")!, facts(["index.html", "_redirects"]));
    expect(a.warnings).toContain("_redirects will be ignored by this destination");
  });
});

describe("catalogue", () => {
  it("no adapter claims browser-direct deployment or tested support", () => {
    for (const p of CATALOGUE) {
      expect(p.browserDirectDeploy.evidence).toBe("unsupported");
      expect(p.browserDirectDeploy.value).toBe(false);
      expect(p.methods.every((m) => m.evidence !== "tested" && m.evidence !== "documented")).toBe(true);
      expect(p.manualSteps.length).toBeGreaterThan(0);
    }
  });
  it("ids are unique", () => expect(new Set(CATALOGUE.map((p) => p.id)).size).toBe(CATALOGUE.length));
  it("anonymity entries are self-hosted and state the browser cannot run them", () => {
    for (const id of ["tor-onion", "i2p-eepsite"]) {
      const p = getProvider(id)!;
      expect(p.methods.map((m) => m.id)).toEqual(["self-host"]);
      expect(p.prerequisites.join(" ")).toMatch(/browser tab cannot/);
    }
  });
  it("filters", () => {
    expect(filterCatalogue({ noAccountOnly: true }).map((p) => p.id)).toEqual(["ipfs", "tor-onion", "i2p-eepsite", "own-server"]);
    expect(filterCatalogue({ methods: ["manual-web-upload"] }).map((p) => p.id)).toEqual(["github-pages", "netlify", "cloudflare-pages", "neocities"]);
    expect(filterCatalogue({ text: "pages" }).length).toBe(4);
    expect(filterCatalogue({ minEvidence: "documented" })).toEqual([]);
  });
});

describe("plan and export", () => {
  it("statuses follow allowed transitions only", async () => {
    const inv = await buildInventory([{ path: "index.html", bytes: bytes("x") }]);
    let plan = buildPlan(inv.bundleDigest, analyze(inv.entries), false, [getProvider("netlify")!]);
    const d = plan.destinations[0]!;
    expect(d.status).toBe("needs-review");
    expect(() => transition(plan, "netlify", "verified-by-user")).toThrow("invalid transition");
    plan = transition(plan, "netlify", "ready-for-manual-export");
    plan = transition(plan, "netlify", "uploaded-by-user");
    plan = transition(plan, "netlify", "verified-by-user");
    expect(plan.destinations[0]!.status).toBe("verified-by-user");
    plan = transition(plan, "netlify", "ready-for-manual-export");
    plan = transition(plan, "netlify", "skipped");
    expect(allowedTransitions(plan.destinations[0]!)).toEqual(["needs-review"]);
    plan = transition(plan, "netlify", "needs-review");
    expect(plan.destinations[0]!.status).toBe("needs-review");
  });
  it("bundle errors block every destination", async () => {
    const inv = await buildInventory([{ path: "index.html", bytes: bytes("x") }]);
    const plan = buildPlan(inv.bundleDigest, analyze(inv.entries), true, CATALOGUE);
    expect(plan.destinations.every((d) => d.status === "blocked")).toBe(true);
  });
  it("export round-trips site bytes exactly and is deterministic", async () => {
    const files = intakeZip(zipSync(SITE), { stripRoot: true }).files;
    const inv = await buildInventory(files);
    const providers = [getProvider("netlify")!, getProvider("tor-onion")!];
    const m = buildManifest("site", inv.entries, "index.html");
    if (!m.ok) throw new Error(m.errors.join());
    const id = await artifactId(m.manifest);
    const plan = buildPlan(id, analyze(inv.entries), false, providers);
    const z1 = buildExport(files, inv, m.manifest, plan, providers);
    expect(buildExport(files, inv, m.manifest, plan, providers)).toEqual(z1);
    const back = readZip(z1);
    expect(back.rejected).toEqual([]);
    const names = back.entries.map((e) => e.name).sort();
    expect(names).toEqual([
      "app/css/a.css", "app/img/x.bin", "app/index.html",
      "mirrorkit-control/MANIFEST.txt", "mirrorkit-control/artifact-manifest.json", "mirrorkit-control/handoff-status.json", "mirrorkit-control/instructions/netlify.txt", "mirrorkit-control/instructions/tor-onion.txt",
    ]);
    const appFiles = back.entries.filter((e) => e.name.startsWith("app/")).map((e) => ({ path: e.name.slice(4), bytes: e.bytes }));
    expect((await buildInventory(appFiles)).bundleDigest).toBe(inv.bundleDigest);
    const instr = new TextDecoder().decode(back.entries.find((e) => e.name === "mirrorkit-control/instructions/tor-onion.txt")!.bytes);
    expect(instr).toContain("did NOT contact this provider");
    expect(instr).toContain("Never upload mirrorkit-control/");
    expect(instr).toContain(`Artifact id (sha256 of mirrorkit-control/artifact-manifest.json): ${id}`);
    // The exported manifest bytes re-hash to the same artifactId (T-ART-09).
    const json = back.entries.find((e) => e.name === "mirrorkit-control/artifact-manifest.json")!.bytes;
    expect(`sha256:${await sha256Hex(json)}`).toBe(id);
    expect(validateManifest(JSON.parse(new TextDecoder().decode(json)))).toEqual([]);
  });
  it("payload ZIP has app files at the root and nothing else, and re-imports identically", async () => {
    const files = intakeZip(zipSync(SITE), { stripRoot: true }).files;
    const inv = await buildInventory(files);
    const again = intakeZip(buildPayloadZip(files));
    expect(again.candidateRoot).toBeNull();
    expect(again.files.map((f) => f.path)).toEqual(["css/a.css", "img/x.bin", "index.html"]);
    expect((await buildInventory(again.files)).bundleDigest).toBe(inv.bundleDigest);
  });
});

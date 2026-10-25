import { describe, expect, it } from "vitest";
import { validateIntendedUse, type IntendedUse } from "../src/contracts/intended-use";
import { artifactId, buildManifest } from "../src/contracts/manifest";
import { buildPublishPlan, isExpired, PLAN_TTL_MS, verifyPlanId } from "../src/contracts/publish-plan";
import { analyze } from "../src/core/analyze";
import { buildInventory } from "../src/core/inventory";
import { buildPlan } from "../src/core/plan";
import { scanBundle } from "../src/core/scan";
import { CATALOGUE, getProvider } from "../src/providers/catalogue";
import { assess } from "../src/providers/select";
import { bytes } from "./zipcraft";

const use = (category: IntendedUse["category"], ownerHasRights = true): IntendedUse => ({ category, containsPrivateData: false, ownerHasRights, description: "" });
const facts = analyze([{ path: "index.html", size: 1, sha256: "" }]);

describe("intended-use policy (MK-POL-003, T-POL-03)", () => {
  it("blocks payment and token apps on every destination", () => {
    for (const c of ["payment", "token"] as const)
      for (const p of CATALOGUE) expect(assess(p, facts, undefined, use(c)).verdict).toBe("incompatible");
  });
  it("blocks GitHub Pages for commercial use with a cited source, but not other hosts", () => {
    const gh = assess(getProvider("github-pages")!, facts, undefined, use("commercial"));
    expect(gh.blockers.join()).toMatch(/provider terms exclude commercial use \(researched-lead, 2026-10-25\)/);
    expect(assess(getProvider("netlify")!, facts, undefined, use("commercial")).blockers).toEqual([]);
  });
  it("requires the owner to confirm rights", () => {
    expect(assess(getProvider("neocities")!, facts, undefined, use("public-demo", false)).blockers.join()).toMatch(/rights/);
  });
  it("treats an undeclared use as unknown, never as permission", () => {
    expect(assess(getProvider("neocities")!, facts).unknowns).toContain("intended use not declared");
  });
  it("validates the declaration", () => {
    expect(validateIntendedUse(use("personal"))).toEqual([]);
    expect(validateIntendedUse({ ...use("personal"), country: "usa" }).join()).toMatch(/country/);
    expect(validateIntendedUse({ ...use("personal"), containsPrivateData: true as unknown as false }).join()).toMatch(/private data/);
  });
});

describe("PublishPlan (MK-CTR-005)", () => {
  const make = async (now: number, category: IntendedUse["category"] = "public-demo") => {
    const files = [{ path: "index.html", bytes: bytes("<h1>x</h1>") }, { path: "a.js", bytes: bytes('fetch("https://api.example.org/x")') }];
    const inv = await buildInventory(files);
    const m = buildManifest("site", inv.entries, "index.html");
    if (!m.ok) throw new Error();
    const id = await artifactId(m.manifest);
    const scan = scanBundle(files);
    const providers = [getProvider("netlify")!, getProvider("github-pages")!];
    const dry = buildPlan(id, analyze(inv.entries), false, providers, scan, use(category));
    return buildPublishPlan(m.manifest, id, use(category), dry, providers, scan, now);
  };
  it("is deterministic for a fixed time, self-verifying and tamper-evident", async () => {
    const t = Date.parse("2026-10-25T12:00:00.000Z");
    const a = await make(t);
    expect(await make(t)).toEqual(a);
    expect(a.planId).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(await verifyPlanId(a)).toBe(true);
    expect(await verifyPlanId({ ...a, policyVersion: "other" })).toBe(false);
    expect(a.createdAt).toBe("2026-10-25T12:00:00.000Z");
    expect(isExpired(a, t + PLAN_TTL_MS - 1)).toBe(false);
    expect(isExpired(a, t + PLAN_TTL_MS)).toBe(true);
  });
  it("lists exactly the manifest files, manual-only non-mutating operations and unknown cost", async () => {
    const p = await make(0);
    for (const d of p.destinations) {
      expect(d.publicFiles).toEqual(["a.js", "index.html"]);
      expect(d.operations.every((o) => o.remoteMutation === false)).toBe(true);
      expect(d.costSnapshot.status).toBe("unknown");
      expect(d.externalDependencies).toEqual([{ urlPattern: "https://api.example.org", role: "api", discovery: "literal", required: "unknown" }]);
    }
  });
  it("marks blocked destinations disabled with a blocker diagnostic", async () => {
    const p = await make(0, "commercial");
    const gh = p.destinations.find((d) => d.destination.targetId === "github-pages")!;
    expect(gh.mode).toBe("disabled");
    expect(gh.diagnostics.some((x) => x.severity === "blocker" && x.code === "MK_POLICY_BLOCKED")).toBe(true);
    expect(p.destinations.find((d) => d.destination.targetId === "netlify")!.mode).toBe("manual");
  });
});

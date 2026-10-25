// Manual-export package: site/ (exact bytes), MANIFEST.txt (canonical hashes),
// plan.json and one instructions file per destination. Metadata lives outside
// site/ so it is never uploaded by accident.

import { zipSync, type Zippable } from "fflate";
import type { ProviderAdapter } from "../providers/types";
import type { BundleFile } from "./intake";
import { canonicalManifest, type Inventory } from "./inventory";
import type { DryRunPlan } from "./plan";

// Fixed timestamp => identical inputs give an identical export ZIP.
const FIXED_MTIME = new Date("1980-01-01T00:00:00Z");

export function instructionsText(p: ProviderAdapter, inv: Inventory, statusLine: string): string {
  const lines = [
    `Replikrazy manual export — ${p.name}`,
    `Bundle digest (sha256 of MANIFEST.txt): ${inv.bundleDigest}`,
    `Planned status: ${statusLine}`,
    "",
    "Replikrazy did NOT contact this provider and did NOT deploy anything.",
    "Evidence level for every step below: unreviewed — confirm against the provider's current docs.",
    "",
    "Prerequisites:",
    ...p.prerequisites.map((s) => `  - ${s}`),
    "",
    "Steps:",
    ...p.manualSteps.map((s, i) => `  ${i + 1}. ${s}`),
  ];
  if (p.caveats.length) lines.push("", "Caveats:", ...p.caveats.map((s) => `  - ${s}`));
  return lines.join("\n") + "\n";
}

export function buildExport(
  files: readonly BundleFile[],
  inv: Inventory,
  plan: DryRunPlan,
  providers: readonly ProviderAdapter[],
): Uint8Array {
  const enc = new TextEncoder();
  const tree: Zippable = {};
  const opt = { level: 0 as const, mtime: FIXED_MTIME };
  for (const f of files) tree[`site/${f.path}`] = [f.bytes, opt];
  tree["MANIFEST.txt"] = [enc.encode(canonicalManifest(inv.entries)), opt];
  tree["plan.json"] = [enc.encode(JSON.stringify(plan, null, 2) + "\n"), opt];
  for (const d of plan.destinations) {
    if (d.status === "skipped") continue;
    const p = providers.find((x) => x.id === d.providerId);
    if (p) tree[`instructions/${p.id}.txt`] = [enc.encode(instructionsText(p, inv, d.status)), opt];
  }
  return zipSync(tree);
}

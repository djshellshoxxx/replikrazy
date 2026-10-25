// Manual-export packages (research MK-ART-006, T-ART-09).
//
// Handoff ZIP:  app/ (exact bytes, the only deployable part) plus a sibling
//               mirrorkit-control/ with MANIFEST.txt, plan.json, scan.json and
//               per-destination instructions. The control folder keeps its
//               historical MirrorKit name for spec compatibility; it must
//               never be uploaded.
// Payload ZIP:  the app files at the archive root and nothing else, for hosts
//               that accept a ZIP upload directly.
// File bytes are never rewritten: no banner, analytics, service worker or
// manifest is injected.

import { zipSync, type Zippable } from "fflate";
import type { ProviderAdapter } from "../providers/types";
import type { BundleFile } from "./intake";
import { canonicalManifest, type Inventory } from "./inventory";
import type { DryRunPlan } from "./plan";
import type { ScanReport } from "./scan";

// Fixed timestamp => identical inputs give an identical export ZIP.
const FIXED_MTIME = new Date("1980-01-01T00:00:00Z");
const OPT = { level: 0 as const, mtime: FIXED_MTIME };
export const APP_DIR = "app";
export const CONTROL_DIR = "mirrorkit-control";

const fmtClaim = (label: string, c: { value: unknown; evidence: string; note?: string; source?: string; observed?: string }) =>
  `  - ${label}: ${c.value === null ? "unknown" : String(c.value)} [${c.evidence}${c.observed ? `, read ${c.observed}` : ""}]${c.note ? ` — ${c.note}` : ""}${c.source ? `\n      source: ${c.source}` : ""}`;

export function instructionsText(p: ProviderAdapter, inv: Inventory, statusLine: string, assessment?: DryRunPlan["destinations"][number]["assessment"]): string {
  const lines = [
    `Replikrazy manual export — ${p.name}`,
    `Bundle digest (sha256 of ${CONTROL_DIR}/MANIFEST.txt): ${inv.bundleDigest}`,
    `Planned status: ${statusLine}`,
    "",
    "Replikrazy did NOT contact this provider and did NOT deploy anything.",
    `Upload ONLY the contents of ${APP_DIR}/. Never upload ${CONTROL_DIR}/.`,
    "Evidence levels: unreviewed < researched-lead < documented < tested. Re-check provider docs before relying on any claim.",
    "",
    "Provider claims:",
    fmtClaim("account required", p.requiresAccount),
    fmtClaim("max file size (bytes)", p.maxFileBytes),
    fmtClaim("max files", p.maxFiles),
    fmtClaim("index.html fallback for unknown paths", p.spaFallback),
    fmtClaim("default URL under a sub-path", p.defaultUrlNested),
    "",
    "Prerequisites:",
    ...p.prerequisites.map((s) => `  - ${s}`),
    "",
    "Steps:",
    ...p.manualSteps.map((s, i) => `  ${i + 1}. ${s}`),
  ];
  if (assessment) {
    const notes = [
      ...assessment.blockers.map((s) => `  - BLOCKER: ${s}`),
      ...assessment.warnings.map((s) => `  - warning: ${s}`),
      ...assessment.unknowns.map((s) => `  - check: ${s}`),
    ];
    if (notes.length) lines.push("", "Compatibility notes for this bundle:", ...notes);
  }
  if (p.caveats.length) lines.push("", "Caveats:", ...p.caveats.map((s) => `  - ${s}`));
  lines.push("", "A successful upload does not prove the mirror works: open it and test the pages and features you rely on.");
  return lines.join("\n") + "\n";
}

export function buildPayloadZip(files: readonly BundleFile[]): Uint8Array {
  const tree: Zippable = {};
  for (const f of files) tree[f.path] = [f.bytes, OPT];
  return zipSync(tree);
}

export function buildExport(
  files: readonly BundleFile[],
  inv: Inventory,
  plan: DryRunPlan,
  providers: readonly ProviderAdapter[],
  scan?: ScanReport,
): Uint8Array {
  const enc = new TextEncoder();
  const tree: Zippable = {};
  for (const f of files) tree[`${APP_DIR}/${f.path}`] = [f.bytes, OPT];
  tree[`${CONTROL_DIR}/MANIFEST.txt`] = [enc.encode(canonicalManifest(inv.entries)), OPT];
  tree[`${CONTROL_DIR}/plan.json`] = [enc.encode(JSON.stringify(plan, null, 2) + "\n"), OPT];
  if (scan) tree[`${CONTROL_DIR}/scan.json`] = [enc.encode(JSON.stringify(scan, null, 2) + "\n"), OPT];
  for (const d of plan.destinations) {
    if (d.status === "skipped") continue;
    const p = providers.find((x) => x.id === d.providerId);
    if (p) tree[`${CONTROL_DIR}/instructions/${p.id}.txt`] = [enc.encode(instructionsText(p, inv, d.status, d.assessment)), OPT];
  }
  return zipSync(tree);
}

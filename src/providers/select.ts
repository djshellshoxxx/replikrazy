// Capability-aware compatibility check of one bundle against one provider.
// "unknown" is a first-class verdict: a limit we have not verified must never
// be reported as passing, and a byte-identical upload is not proof the site
// works there (research MK-POL-001/002).

import type { BundleFacts } from "../core/analyze";
import { SENSITIVE_USES, type IntendedUse } from "../contracts/intended-use";
import type { ScanReport } from "../core/scan";
import type { ProviderAdapter } from "./types";

export type Verdict = "compatible" | "incompatible" | "unknown";

export interface Assessment {
  providerId: string;
  verdict: Verdict;
  blockers: string[];
  warnings: string[];
  unknowns: string[];
}

export function assess(p: ProviderAdapter, f: BundleFacts, scan?: ScanReport, use?: IntendedUse): Assessment {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const unknowns: string[] = [];

  if (!f.entrypoint) blockers.push("no entry page selected");
  else if (!f.hasRootIndex) warnings.push(`no root index.html: the site root URL will not show ${f.entrypoint}`);
  if (f.sensitiveFiles.length) blockers.push("bundle contains possible secrets/private files");
  if (f.serverSideFiles.length && p.runsServerCode.value !== true)
    blockers.push("server-side files would not run and could be exposed as source");

  const lim = (label: string, actual: number, c: ProviderAdapter["maxFileBytes"]) => {
    if (c.value === null) unknowns.push(`${label} limit not verified`);
    else if (actual > c.value) blockers.push(`${label} ${actual} exceeds limit ${c.value} (${c.evidence}${c.observed ? `, ${c.observed}` : ""})`);
  };
  lim("largest file size", f.largestFileBytes, p.maxFileBytes);
  lim("file count", f.fileCount, p.maxFiles);

  if (f.hasRedirectsFile) {
    if (p.redirectsFile.value === false) warnings.push("_redirects will be ignored by this destination");
    else if (p.redirectsFile.value === null) unknowns.push("_redirects support not verified");
  }
  if (f.hasHeadersFile) {
    if (p.headersFile.value === false) warnings.push("_headers will be ignored by this destination");
    else if (p.headersFile.value === null) unknowns.push("_headers support not verified");
  }
  if (f.hasCnameFile && p.id !== "github-pages") warnings.push("CNAME file is a GitHub Pages convention and has no effect here");

  if (use) {
    if (!use.ownerHasRights) blockers.push("you have not confirmed you have the rights to publish this site");
    if (SENSITIVE_USES.includes(use.category))
      blockers.push(`no destination is qualified for ${use.category} apps (sensitive profile: needs a verified no-injection, header and origin-isolation review)`);
    const banned = p.blockedUses?.value ?? [];
    if (banned.includes(use.category))
      blockers.push(`provider terms exclude ${use.category} use (${p.blockedUses!.evidence}${p.blockedUses!.observed ? `, ${p.blockedUses!.observed}` : ""}): ${p.blockedUses!.note ?? ""}`);
  } else unknowns.push("intended use not declared");

  if (scan) {
    // Never strip or neutralise these: the owner must supply a static-only build.
    const executes = scan.reservedPaths.filter((r) => p.serverExecutablePaths.includes(r));
    if (executes.length) blockers.push(`this host would run ${executes.join(", ")} as server code; supply a static-only build`);
    if (scan.findings.some((x) => x.code === "MK_SECRET_SUSPECTED" && x.severity === "blocker"))
      blockers.push("file contents look like live credentials");

    const h = scan.hints;
    if (h.routing === "history") {
      if (p.spaFallback.value === false) warnings.push("history-API routing: deep links/reloads will 404 here (no index.html fallback)");
      else if (p.spaFallback.value === null) unknowns.push("history-API routing: index.html fallback not verified");
      else warnings.push(`history-API routing relies on this host's index.html fallback (${p.spaFallback.note ?? "check provider docs"})`);
    }
    if ((h.assetBase === "root" || h.assetBase === "mixed") && !h.hasBaseTag) {
      if (p.defaultUrlNested.value === true) warnings.push(`root-relative URLs (/...) break at this host's default sub-path URL; use a root/custom domain (${p.defaultUrlNested.note ?? ""})`);
      else if (p.defaultUrlNested.value === null) unknowns.push("root-relative URLs: whether the site is served at a domain root is not verified");
    }
    if (h.serviceWorker === "present") warnings.push("service worker scope/caches are per origin; old caches on other mirrors are not updated");
    if (h.usesOriginStorage) warnings.push("browser storage starts empty on this origin; user data does not carry over");
    if (h.usesRealtime) warnings.push("realtime connections (WebSocket/EventSource/WebRTC) still go to the original backend");
    if (scan.dependencies.length) warnings.push(`${scan.dependencies.length} external origin(s) must stay reachable for the mirror to work`);
    if (scan.missing.length) warnings.push(`${scan.missing.length} referenced file(s) are not in the bundle`);
  }

  const verdict = blockers.length ? "incompatible" : unknowns.length ? "unknown" : "compatible";
  return { providerId: p.id, verdict, blockers, warnings, unknowns };
}

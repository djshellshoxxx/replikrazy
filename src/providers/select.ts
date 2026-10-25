// Capability-aware compatibility check of one bundle against one provider.
// "unknown" is a first-class verdict: a limit we have not verified must never
// be reported as passing.

import type { BundleFacts } from "../core/analyze";
import type { ProviderAdapter } from "./types";

export type Verdict = "compatible" | "incompatible" | "unknown";

export interface Assessment {
  providerId: string;
  verdict: Verdict;
  blockers: string[];
  warnings: string[];
  unknowns: string[];
}

export function assess(p: ProviderAdapter, f: BundleFacts): Assessment {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const unknowns: string[] = [];

  if (!f.hasRootIndex) blockers.push("bundle has no root index.html");
  if (f.sensitiveFiles.length) blockers.push("bundle contains possible secrets/private files");
  if (f.serverSideFiles.length && p.runsServerCode.value !== true)
    blockers.push("server-side files would not run and could be exposed as source");

  const lim = (label: string, actual: number, c: ProviderAdapter["maxFileBytes"]) => {
    if (c.value === null) unknowns.push(`${label} limit not verified`);
    else if (actual > c.value) blockers.push(`${label} ${actual} exceeds limit ${c.value}`);
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

  const verdict = blockers.length ? "incompatible" : unknowns.length ? "unknown" : "compatible";
  return { providerId: p.id, verdict, blockers, warnings, unknowns };
}

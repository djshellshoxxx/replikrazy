// Registry and filtering. Adding a provider = adding one adapter module here.

import { adapter as cloudflarePages } from "./adapters/cloudflare-pages";
import { adapter as codebergPages } from "./adapters/codeberg-pages";
import { adapter as githubPages } from "./adapters/github-pages";
import { adapter as gitlabPages } from "./adapters/gitlab-pages";
import { adapter as i2p } from "./adapters/i2p-eepsite";
import { adapter as ipfs } from "./adapters/ipfs";
import { adapter as neocities } from "./adapters/neocities";
import { adapter as netlify } from "./adapters/netlify";
import { adapter as ownServer } from "./adapters/own-server";
import { adapter as tor } from "./adapters/tor-onion";
import { EVIDENCE_RANK, type Evidence, type MethodId, type ProviderAdapter, type ProviderKind } from "./types";

export const CATALOGUE: readonly ProviderAdapter[] = [
  githubPages, gitlabPages, codebergPages, netlify, cloudflarePages, neocities, ipfs, tor, i2p, ownServer,
];

export interface CatalogueFilter {
  text?: string;
  kinds?: ProviderKind[];
  methods?: MethodId[];
  noAccountOnly?: boolean;
  needsCustomDomain?: boolean;
  // Minimum evidence level for at least one publish method.
  minEvidence?: Exclude<Evidence, "unsupported">;
}

export function filterCatalogue(f: CatalogueFilter, list: readonly ProviderAdapter[] = CATALOGUE): ProviderAdapter[] {
  const text = f.text?.trim().toLowerCase();
  return list.filter((p) => {
    if (text && !`${p.name} ${p.id} ${p.kind}`.toLowerCase().includes(text)) return false;
    if (f.kinds?.length && !f.kinds.includes(p.kind)) return false;
    if (f.methods?.length && !p.methods.some((m) => f.methods!.includes(m.id))) return false;
    if (f.noAccountOnly && p.requiresAccount.value !== false) return false;
    if (f.needsCustomDomain && p.customDomain.value !== true) return false;
    if (f.minEvidence) {
      const min = EVIDENCE_RANK[f.minEvidence];
      if (!p.methods.some((m) => m.evidence !== "unsupported" && EVIDENCE_RANK[m.evidence] >= min)) return false;
    }
    return true;
  });
}

export const getProvider = (id: string) => CATALOGUE.find((p) => p.id === id);

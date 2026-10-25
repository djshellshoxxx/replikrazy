// Reviewed mapper from the MirrorKit v13 research catalogue
// (docs/research/mirrorkit-v13/catalog/consolidated-providers.json) to the
// app's pinned research-lead snapshot (research MK-POL-006).
//
// Rules:
// - Record ids and source pin ids are kept verbatim; nothing is renamed.
// - Only structured fields become typed values (operator country, confirmed
//   doc languages, booleans). Free-text research prose is carried as text,
//   never parsed into limits or permissions; missing facts stay null.
// - Nothing here enables an adapter. Every record is a dated research lead.
//
// Self-contained (no imports) so scripts/build-research-snapshot.ts can run
// it under Node's type stripping.

export interface SourcePin {
  pinId: string;
  url: string;
  checkedUtc: string | null;
}

export interface ResearchLead {
  id: string;
  name: string;
  recordClass: string;
  adapterTier: string;
  evidenceStatus: string;
  directBrowserPublishVerified: boolean;
  manualExportFallback: boolean;
  deploymentApiCorsStatus: string | null;
  canonicalUrl: string | null;
  operator: string | null;
  operatorCountry: string | null; // only from a structured operator field
  market: string | null;
  docsLanguages: string[] | null; // confirmed BCP 47 tags only
  docsLanguagesNote: string | null;
  freeModel: string | null;
  freeLimits: string | null;
  suitability: string | null;
  paymentKeyUiNote: string | null;
  servedAssetIntegrity: string | null;
  checkedUtc: string | null;
  sourcePins: SourcePin[];
}

export interface ResearchSnapshot {
  snapshotVersion: 1;
  source: string;
  sourceSha256: string;
  researchCheckedUtc: string | null;
  recordCount: number;
  records: ResearchLead[];
}

type Rec = Record<string, unknown>;
const MAX_TEXT = 2000;

const obj = (v: unknown): Rec | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : null);
const str = (v: unknown): string | null => {
  if (typeof v !== "string" || !v.trim()) return null;
  const s = v.trim();
  // Contract description cap; a truncated value says so.
  return [...s].length > MAX_TEXT ? [...s].slice(0, MAX_TEXT - 1).join("") + "…" : s;
};
const firstStr = (...vs: unknown[]) => {
  for (const v of vs) {
    const s = str(v);
    if (s) return s;
  }
  return null;
};

function pins(x: Rec): SourcePin[] {
  const seen = new Map<string, SourcePin>();
  for (const list of [x.source_pins, x.write_api_source_pins]) {
    if (!Array.isArray(list)) continue;
    for (const p of list) {
      const o = obj(p);
      const id = o && str(o.pin_id);
      const url = o && str(o.url);
      if (id && url && !seen.has(id)) seen.set(id, { pinId: id, url, checkedUtc: str(o!.checked_utc) });
    }
  }
  return [...seen.values()].sort((a, b) => (a.pinId < b.pinId ? -1 : a.pinId > b.pinId ? 1 : 0));
}

export function mapRecord(x: Rec): ResearchLead {
  const r = obj(x.record) ?? {};
  const operator = obj(r.operator);
  const langs = obj(r.docs_languages);
  const free = obj(r.free_model);
  const suit = obj(r.mirror_suitability);
  const integrity = obj(r.hosted_asset_modification);
  const confirmed = Array.isArray(langs?.confirmed) ? (langs!.confirmed as unknown[]).filter((l): l is string => typeof l === "string" && /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(l)) : null;
  const p = pins(x);
  return {
    id: String(x.id),
    name: firstStr(r.provider, r.name, x.name) ?? String(x.id),
    recordClass: str(x.record_class) ?? "unknown",
    adapterTier: str(x.adapter_tier) ?? "unknown",
    evidenceStatus: str(x.evidence_status) ?? "unknown",
    // Never true in v13; kept typed so a future snapshot cannot silently flip it.
    directBrowserPublishVerified: x.direct_browser_publish_verified === true,
    manualExportFallback: x.manual_export_fallback === true,
    deploymentApiCorsStatus: str(x.deployment_api_cors_status),
    canonicalUrl: str(r.canonical_url),
    operator: operator ? firstStr(operator.name) : firstStr(r.operator_country, r.eligibility_operator_region, r.regions_operator_language),
    operatorCountry: operator ? str(operator.country) : null,
    market: str(r.market),
    docsLanguages: confirmed && confirmed.length ? confirmed : null,
    docsLanguagesNote: firstStr(r.provider_docs_languages, langs ? null : r.regions_operator_language),
    freeModel: free ? str(free.classification) : firstStr(r.free_model, r.free_paid, r.free_status),
    freeLimits: free ? str(free.limits) : null,
    suitability: firstStr(suit?.general_art_docs, r.suitability, r.fit),
    paymentKeyUiNote: firstStr(suit?.ghostpay_p2p_or_payment_key_ui),
    servedAssetIntegrity: integrity ? firstStr(`${str(integrity.status) ?? "unknown"}: ${str(integrity.detail) ?? ""}`) : firstStr(r.asset_injection),
    checkedUtc: str(r.evidence_checked_utc) ?? (p.map((q) => q.checkedUtc).filter((c): c is string => !!c).sort().at(-1) ?? null),
    sourcePins: p,
  };
}

export function buildSnapshot(source: Rec, sourcePath: string, sourceSha256: string): ResearchSnapshot {
  const records = (Array.isArray(source.records) ? source.records : []).map((x) => mapRecord(x as Rec));
  records.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return {
    snapshotVersion: 1,
    source: sourcePath,
    sourceSha256,
    researchCheckedUtc: str(source.checked_utc),
    recordCount: records.length,
    records,
  };
}

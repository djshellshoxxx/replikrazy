# Replikrazy guest HTML / paste-to-web host catalog

**Staging only — checked 2026-10-25.** This is a read-only documentation/data consolidation, not a provider recommendation, adapter approval, or publication. No new research or runtime action was performed.

## What is included

- **31 normalized route records** across **30 provider/domain identities**, including transient previews, unresolved leads, adjacent playgrounds, historical/archive-only routes, and current documentation-only candidates.
- **3 existing-catalog evidence enrichments** (HTMLBox Community profile, plus HTMLy and dochost) kept separate from new route/provider counts.
- **32 raw candidate rows** from the five input JSON files; **12 supporting enrichment/disposition rows** are counted separately. See `guest-hosts.json` for the exact per-file lineage and SHA-256 values.
- Route rows are not equivalent to unique services, legal entities, verified runtimes, or qualified adapters. One duplicate HDply row was merged; Convika's locale/version paths were split.

## Important distinctions

- **HTMLDrop:** `htmldrop.com` and `htmldrop.link` are separate identities; no evidence supports alias/operator equivalence.
- **Convika:** separate locale/path claims remain unresolved: localized tools pages/privacy state a 1-hour link and 24-hour stored-content period; Indonesian homepage search evidence says a 3-minute preview with scripts/forms disabled. Terms also say private links/passwords are paid. Do not flatten this to one universal TTL/JS claim.
- **HTML Cloud:** privacy, encryption, link-key handling and deletion are **unverified vendor claims**; no independent audit or runtime test.
- **HTMLBox Community:** existing provider profile `htmlbox_community_static_free`; enrichment only, not a new route.
- **PreviewShip:** Korean-language UI is language evidence only; operator country remains unknown.
- Legacy/account-required/archive/encoded-playground routes remain separately marked as excluded or adjacent, not qualifying guest hosts.

## Country, language, and evidence limits

Operator/legal country, governing law, hosting/data region, and product language are separate fields. Unknowns stay unknown; a language, TLD, currency, or search locale is not country evidence. Search/page records are public-source claims only. No file uploads, signups, publishing, API/CORS probes, served-byte tests, JS/storage/security tests, deletion tests, or automated crawling were performed. No direct adapter is qualified or enabled.

Alternate-search accounting records **four accessible named interfaces** (Bing, Naver, Cốc Cốc, Yahoo Search). Yahoo explicitly reported “Powered by Bing”; index independence for Bing, Naver, and Cốc Cốc was not assessed. Qwant navigation/content retrieval failed and is not counted as accessible. The web-search tool provider was unspecified and is not counted as another verified engine. Raw query routes are retained in `guest-hosts.json` as actual tool routes, not converted into invented engines or crawls.

## Files

- `guest-hosts.json` — normalized catalog, route facts, source citations, conflicts, dedup lineage, baseline cross-checks, and exclusions.
- `guest-hosts.csv` — one row per normalized route or existing-catalog enrichment; nested fields are compact JSON strings.
- `SOURCE-MANIFEST.json` — exact input/cross-check file paths, byte counts, SHA-256, and row counts.

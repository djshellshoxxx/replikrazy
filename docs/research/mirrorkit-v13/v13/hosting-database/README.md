# Replikrazy hosting research database (derived staging)

**Status:** source-cited research data for review. This is not a runtime backend, deployment catalogue, recommendation list, provider approval, or implementation artifact.

## Start here

- [`hosting-database.json`](hosting-database.json): normalized static data plus exact source record objects and route crosswalks.
- [`exports/hosting-database.csv`](exports/hosting-database.csv): human-friendly flat view of 311 catalog-lead rows, 62 provider/protocol-profile rows, and 20 additive regional offer rows. CSV rows are records, not companies.
- [`schema/hosting-database.schema.json`](schema/hosting-database.schema.json) and [`DATA_DICTIONARY.md`](DATA_DICTIONARY.md): field meanings, allowed null/unknown semantics, and count boundaries.
- [`DATABASE-PUBLICATION-MANIFEST.json`](DATABASE-PUBLICATION-MANIFEST.json): immutable input SHA-256s, output hashes, and transformations.

## Inventory (do not sum as unique hosts)

The source catalog contains **311 lead-register rows** and **62 provider/protocol profiles**. Fourteen IDs are intentionally cross-listed between those two collections. The regional expansions add **20 offer records** (6 Africa/Middle East, 8 Latin America/Caribbean, 6 Asia/Europe) plus **2 enrichments** of existing IDs, not extra provider entities. This yields 393 convenience-CSV rows and 379 distinct record IDs across those three collections, but **not** 379 companies. The number of unique legal companies or eligible providers is unknown.

The database preserves 25 regional market-sweep rows separately from offers. Eight explicit browser workflow records and a 62-row hosting-route-spec index are also separate documentation crosswalks, not hosting records. The workflow route set has zero directly qualified/activated publish routes. The route index shows 8 linked-but-unapproved examples and 54 pending adoptions.

Batch-specific free-status counts are kept separate: Africa/Middle East reports 0 zero-prerequisite recurring-$0 static offers and 1 domain-prerequisite conditional-free hosting offer; Latin America/Caribbean reports 0 recurring zero-price offers and 1 seven-day trial; Asia/Europe reports 0 new general-public free-host records and 2 NGO-only eligibility-specific free offers. Those counts do not mean the same thing and do not describe markets outside the bounded batches. Five legacy market-outcome rows retain their evidence-check date but have no source URL; that gap is explicitly preserved, not filled in.

## Safety and interpretation

No account creation, signup, upload, deploy, live API/CORS probe, runtime/browser test, payment, or provider-contact action was performed. Do not call a published how-to a tested workflow. A record may describe FTP, cPanel, a web file manager, or an API without proving browser suitability or modern-JavaScript app behavior. Prices, quotas, expiry, residency, operator location, serving region, and terms can differ or conflict; source wording is retained.

Country/market, legal operator, service availability/eligibility, documentation language, serving/data-center region, and TLD are independent data dimensions. Do not infer one from another. NGO, student, member, resident, existing-domain/customer, geographic, or other gated $0 programs are not general-public free plans. Trial and paid offers remain clearly distinct. Unknown values remain null/explicitly unknown; missing evidence is not evidence of absence.

The route-spec index is documentation planning only; `onionMode`/`i2pMode` mappings are not provider claims. The associated `tor-onion-existing` and `i2p-tunnel-existing` proposals require an already authorized persistent external operator; a browser cannot create those services/tunnels. Browser pages cannot start or administer Tor/I2P daemons. A separately authorized pre-existing operator/bridge is required for any onion/I2P endpoint; reading clearnet through Tor is not onion hosting. Protocol retrieval, gateways, content identifiers, and archive layers do not establish publisher identity or durable hosting.

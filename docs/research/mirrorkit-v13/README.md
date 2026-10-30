# MirrorKit research catalogue data (v13, 2026-10-25)

Published here with the repository owner's approval (2026-10-25). It is research data, **not** a list of qualified or recommended providers.

## What this is

Catalogue data from the MirrorKit (now Replikrazy) research checkpoint v13. The historical paths are kept unchanged below this folder:

- `catalog/`:
  - `consolidated-providers.json`: 62 provider/protocol profiles.
  - `consolidated-leads.json`: 311 lead-register rows.
  - The country coverage ledger, the global and local provider catalogues, and their Markdown views.
- `v13/hosting-database/`: the normalised static database with its own README, data dictionary, schema, validation report and CSV export. Read its README first; row counts there are not company counts.
- `v13/guest-host-catalog/`: guest / paste-to-web route records with their source manifest.

## How to read it

- Entries are **dated research leads**. Unknown or contradictory values stay explicit.
- Several things are kept distinct and must not be inferred from one another:
  - operator jurisdiction;
  - hosting/data region;
  - account availability;
  - documentation language;
  - free vs trial vs paid.
- **No direct browser publish route is qualified.** A documented manual workflow is not a verified integration.
- No claim of a verified free host in every country, and no "takedown-proof" hosting.
- Onion/I2P routes need operator-run infrastructure; a browser cannot run them.
- Fields such as `ghostpay_p2p_or_payment_key_ui` record the research's suitability notes for payment/key-handling apps. Every such entry is "not vetted / not approved".

## Provenance and changes

- [`IMPORT-MANIFEST.json`](IMPORT-MANIFEST.json) lists each file's original SHA-256, its published SHA-256 and the pack manifest it was checked against. All 19 originals matched the pack's own recorded hashes.
- One change was made: a personal-looking operator contact email in `v13/guest-host-catalog/guest-hosts.{json,csv}` was replaced with a placeholder. Business contact addresses published by providers on their own sites are unchanged.
- Some documents inside link to research files that were not imported (specs, reports, route specs). Those links are expected to be broken here.

## Status and rights

- Some files still describe themselves as "staging, not yet published". That text is historical; this folder is the published copy.
- No licence or rights grant is made for this data, as for the rest of the repository (TBD). Third-party facts and URLs remain their owners'.

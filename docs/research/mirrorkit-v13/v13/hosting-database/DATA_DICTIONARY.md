# Hosting database data dictionary

## Row identity and collection boundaries

`record_id` is copied from the source collection; it is not a legal-company ID. `record_kind` is `lead`, `provider`, `protocol`, or `offer` for the CSV collections. No adapter implementation is represented. The provider-profile record subtype is preserved separately. Leads and profiles sharing the same ID remain two rows linked by `cross_collection_relation`; do not deduplicate away their different evidence roles. New regional offers keep their own source ID and are not merged into v11.

Collections in JSON: `catalog_leads`, `provider_profiles`, `regional_offers`, `record_enrichments`, `market_sweeps`, `browser_workflow_routes`, `hosting_route_spec_index`, and `workflow_source_registry`. The last five are not added to host/company counts.

## Normalized fields

- `record_status`: exact source status/classification text when available; not a workflow completion test.
- `source_evidence_checked_utc`: exact row/input date where the source record states one. It is separate from per-URL citation dates; it is never synthesized for a URL gap.
- `display_name`, `canonical_domain`: source-stated label/domain. Missing hostnames are `null`. No registrable-domain/operator resolution is attempted here.
- `market_or_scope`: target market or scope text. Never substitute operator country.
- `operator_evidence`: source's operator/legal-country structure or text. Confidence and limits remain nested.
- `serving_region_evidence`: source's data-center/serving-region text/structure; provider country is not substituted.
- `documentation_languages`: source-confirmed languages only; discovery language is not treated as UI/docs language.
- `offer_economics`: source-shaped free/paid/trial/price object or exact text. It does not normalize currency, tax, billing period, campaign, or later renewal into a comparable price.
- `resource_caps`, `expiry_retention`, `eligibility_constraints`: copied structures/text where the source schema exposes them. Otherwise `null`; no cap, end date, universal eligibility, or permanence is implied.
- `hosting_type`: source product/offer category, not proof of arbitrary static-file support.
- `documented_setup_or_transfer`: exact provider-profile deploy or offer workflow field; for the 8 linked routes, full manual route is in `browser_workflow_routes`. Documentation does not mean a UI was observed.
- `javascript_compatibility_evidence`: source statement/caveat only; no copied JavaScript app was tested.
- `browser_publishing`: reported tier, write/API/auth/CORS evidence, and direct-publish verification. `false` means the source explicitly says not verified; `null` means no corresponding claim in that record. Neither means browser use is safe. No endpoint was qualified by this data build.
- `onion_i2p_route_reference`: exact entry from the hosting route crosswalk where mapped. `not_mapped` means no provider-specific route crosswalk exists. No onion/I2P host or bridge is inferred from a protocol name.
- `source_evidence`: URL/date/evidence metadata as present in source rows. Source check date is not a guarantee that an offer remains available. Five legacy market-outcome rows have a dated record but no URL; the source gap remains explicit and no citation is synthesized.
- `source_record`: complete original JSON object selected from the source input, retained for audit. Where only a nested offer/enrichment/sweep is selected, its source path is listed in the manifest.

## Missing/unknown semantics

- JSON `null`: no normalized claim was made / field absent in the selected source object.
- Literal source text such as `unknown`, `not verified`, or `not found`: retained wording from the research record, not silently converted to a conclusion.
- Empty array: the source provided no values in that collection; it is not a universal negative.
- `not_mapped`: the exact relation was not present in the route index; no fuzzy join was attempted.
- `not_tested_or_qualified`: documentation research only; no account, API-origin, CORS, upload, runtime, or deployment test.

## CSV columns

CSV contains the normalized fields listed above except `source_record` (large nested objects stay in JSON). Structured cells such as economics, operator evidence, citations, and workflow references are compact JSON text. `record_kind`, `record_id`, `source_collection`, and `record_status` are mandatory for interpretation. CSV has one row per collection record; it intentionally repeats the 14 shared lead/profile IDs.

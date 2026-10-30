# Manifest admission and digest boundary — 2026-10-27

Disjoint from the broker-owned scanner review. Changed only manifest admission,
its tests and these restart notes; scanner source and policy thresholds unchanged.

Existing accepted contracts MK-CTR-003/008 and MK-ART-002/003 require exact
manifest records, admitted paths and validation before canonical hashing.
The validator previously accepted arrays decorated as records and inherited
file fields, lacked the existing intake count cap and did not reject case or
file/directory collisions. `artifactId` previously hashed typed-but-invalid
runtime values, including unsupported schema versions.

Now require plain or null-prototype records with own required fields; reject
more than DEFAULT_ZIP_LIMITS.maxEntries before entry traversal; apply existing
intake collision rules; validate before artifact digest generation. No schema
migration/import UI, new error algebra, stricter provider limit or detector
policy was invented. Full pinned Unicode case folding remains a separate gap;
this uses the same existing conservative approximation as intake. These are
JSON/data-record validators, not a sandbox for executable JS proxies/accessors.

Original focused tests: seven failures / one pass for admission; then one
failure / eight passes for the digest guard. Logs preserved outside git as
/workspace/checkpoints/manifest-boundary-original-failures.log and
/workspace/checkpoints/manifest-digest-original-failure.log. No original oracle
or threshold changed. Nine new regression cases retained in
`tests/manifest-boundary.test.ts`.

Final validation: 199 tests / 15 files passed; typecheck and production build
passed; diff whitespace check passed. Installed Playwright core 1.57.0 and
Chromium ran the unchanged browser regression script: 35 checks, zero page
errors/external requests. No downloads, remote writes, paid calls or provider
activity. No new axe/manual screen-reader/cross-browser/full-audit claim.

Broker packet remains explicitly pinned to 43382e6 for scanner review; this
new manifest boundary is integrator-owned and does not change scanner parsing.
Missing source-pinned 09_ACCEPTANCE.md/T-ART-08 and synthetic fixtures still
restrict detector expansion. Await the parent's verified native-text findings;
do not duplicate the broker review.

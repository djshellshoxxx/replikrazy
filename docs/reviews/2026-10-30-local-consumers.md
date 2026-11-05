# Local consumer modules — approved initial milestone

Base main ee90c88de73b4d49698a3575d73373007d41c51f, reconciled before work; existing main CI 41045376609 succeeded. No open PRs or new external branch activity observed. Sole integrator on chatgpt/local-consumers-20261030; previous branches preserved. Owner approved the recommended scope: structured comparison reports and canonical offline bundle validation as local modules, without UI or what-if planning, then requested continuation through the next milestone.

## Delivered

- createComparisonReport: validates bounded comparison data, preserves exact changed-file sizes/hashes, sorts paths by UTF-8 order, copies before awaiting, hashes canonical report bytes excluding reportId. No live verification claim or authority.
- checkCanonicalBundle: snapshots ZIP bytes, reuses strict bounded ZIP reader, canonical manifest/hash logic, duplicate-key-safe record parser, credential-field exclusions and existing recovery-plan validation. Binds exact payload paths/sizes/hashes, plan identity/public-file references, expiry and declared-use blockers. No raw input or source snippets enter errors.
- Checks implicit directories with existing full/legacy Unicode folds. Fixed an adversarial file/directory ancestor collision found during implementation; avoids files-times-directories scanning.
- Reports remain metadata only with publishAuthorized:false/liveVerified:false. Other control sidecars are explicitly unchecked; unsupported source remains with the caller unchanged. No provider execution or assumed owner review.

API contracts, limits and integration requirements are in src/consumers/README.md. Differences from the earlier proposal are deliberate for this approved slice: canonical reader only, no dry-run steps/CLI, no standalone schema conversion, no UI/worker integration. Result.ok describes interpretable input; report.valid describes integrity/expiry/declared-policy checks, never permission to publish. Whole-container ZIP caps include control files; some maximum-sized exports may exceed these caps and reject. No limits were raised.

## Evidence

- Initial missing-module test failure retained in /workspace/checkpoints/local-consumers-original.log (no tests executed; feature absent).
- Actual folded directory conflict regression: one failing case / 23 passing, retained in local-consumers-directory-original.log; fixed without threshold changes.
- Final npm run test:all: 427 canonical tests (32 new), 166 planner tests; samples unchanged.
- npm run build: typecheck and production build passed. No dependencies or lockfiles changed; app build does not wire these modules into UI.
- Browser module harness scripts/browser-local-consumers.mjs: 10 Chromium assertions against trusted Vite dev modules, real canonical exporter roundtrip and expiry rejection; zero page errors/external requests. No uploaded source executed. No denied planner navigation/download retried.
- Tests include same-size payload changes, missing/extra paths, unknown/duplicate records, unsupported schema, unsafe/colliding paths, noncanonical manifest bytes, malformed UTF-8, oversized records, stale/future plans, rehashed rights/payment/mutation violations, source retention and no fetch/execution.

This is focused AI review and automated evidence, not independent security or manual accessibility acceptance. No export-capacity benchmark was completed in this slice; approved feature work took priority. New untrusted parsing must be placed behind the existing worker/cancellation model before future UI integration.

## Restart / next gates

Working tree /workspace/replikrazy-integration; branch chatgpt/local-consumers-20261030. Commands: npm run test:all; npm run build. Browser smoke needs existing installed Chromium and canonical Vite dev server at 127.0.0.1:4175: BROWSER_TEST_TOOLS=/opt/codex/cua_node/lib node scripts/browser-local-consumers.mjs. Do not expose publicly or assume old servers remain running.

Next engineering decision: UI integration, CLI, standalone reader and what-if remain unapproved/unimplemented, not hidden completed features. Next review step: a new draft PR for this branch, subject to specific publication approval required by previous review denials. Do not reuse old PR-specific approvals. Pushes/checkpoints are authorized; no PR approval review, merge, deployment or release in this slice.

Unchanged qualification gates: authoritative T-ART-08 and referenced fixture bytes; manual screen-reader/accessibility; independent security; broader browser/OS testing. Private archive retry exhaustion and local browser denials remain binding. No extra workers or paid calls.

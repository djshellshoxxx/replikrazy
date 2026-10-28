# Isolated planner integration — 2026-10-28

Intent recorded before the local merge in
/workspace/checkpoints/planner-integration-intent.json:
- Target: a09d7b1412d7ef11d71e68dbc26630579715062d.
- Source: abb7c31d13bec21be5807bbfdb3b2b9e534fdf15 (planner CI branch), including
  edf6783fdf3c0eb8b59c12647ea1c489cc209811 (latest implementation).
- Isolated branch/worktree: chatgpt/planner-integration-20261028,
  /workspace/replikrazy-integration. Original app worktree remains clean/preserved.
- Live refs and draft PR3 were unchanged at reconciliation. The supplied Claude
  resume state marked its implementation complete; no active conflicting writer
  was observed. PR2 still refers to the older bc0d310 scaffold.

The local merge was conflict-free. No main/owner branch merge or PR approval is
performed. This is bounded side-by-side source integration, not schema or policy
unification. The canonical app and standalone planner retain separate runtimes,
records, identities and trust boundaries. Main Vite build does not bundle/deploy
this tool. See tools/offline-mirror-planner/INTEGRATION.md for exact differences.

## Integration checks and fixes

Vitest initially discovered the planner's node:test files: nine suite failures
with all 385 canonical tests passing. An explicit canonical test include and
`npm run test:all` now run both suites without dropping tests. Planner push CI
also covers chatgpt branches; read-only permissions and skipped browser job on
non-main pushes are unchanged. No workflow dispatch or browser install occurred.

Read-only review found concrete planner issues, then disjoint writers fixed:
- Integrator: core.js/zip.js reject lone-surrogate names and file/directory prefix
  collisions; ZIP duplicate tracking accepts ordinary prototype-like filenames.
- Core reviewer: app.js and drop-lifecycle.test.js bound dropped-directory
  enumeration (5,000 entries including directories, depth 33, 60 seconds),
  invalidate old selections and ignore late callbacks. Later hashing is not
  covered by this traversal bound.
- Contract reviewer: plan.js/import/template tests reject explicit unsupported
  versions while preserving missing-version legacy, validate destination-list
  shape before mapping, and omit unsafe cross-destination key-directory values
  from exported records/commented templates.
No overlapping writers. Root integrated/reviewed/staged all results. No paid calls.

Final local aggregate: 392 canonical tests / 32 files; 166 planner tests; committed
samples unchanged/up to date; typecheck/build and diff checks pass. Original
failures/reproductions retained under /workspace/checkpoints/planner-*.

Planner browser check is BLOCKED, not passed: installed Chromium navigation to
file:///workspace/replikrazy-integration/tools/offline-mirror-planner/index.html
returned net::ERR_BLOCKED_BY_ADMINISTRATOR. See planner-integration-browser.log.
No retry, HTTP/domain substitution, browser download or environment replacement.
The optional existing-browser executable argument is a harness capability only;
it does not change security policy. Prior owner-reported 20 browser cases are
historical claims, not this executor's verification.

## T-ART-08 fixture provenance and exact missing input

Seven new cases in tests/public-data-contract-fixtures.test.ts are legitimately
synthesized from the supplied MK-ART-005/no-value-reporting contract and existing
implemented detector classes. They use nonfunctional repeated placeholder text,
not private keys/accounts or recovered pack bytes. They check blocker class/path,
no synthetic matched value in scan/report output, and retained known private-path
inventory with a blocking fact. No detector rules or thresholds changed.

Reference hashes supplied by parent (full documents remain private):
- 01_CONTRACTS.md: 9fce42b86644a7f9a20d9096c156276b3ce1da337d15edf87511d19eabc318b4
- 02_ARTIFACTS.md: 623f6c885d3a4a58f288e9998d3a06ea43fd9c2e95ba8228dcbf016cd6e2987d

These cases are NOT the unavailable authoritative T-ART-08 fixture suite and do
not establish general secret/personal-data absence. Needed to close that exact
gate: complete source-pinned 09_ACCEPTANCE.md T-ART-08 section and every synthetic
fixture it normatively references, including expected outcomes/classification
and any stated limits or false-positive-review semantics. Their filenames/hashes
are not known here; none are invented. The missing pack transfer is not retried.

Remaining integration gates: permitted planner browser acceptance, reconciliation
of the intentionally different filtering/schema policies before any shared-engine
use, and human/independent acceptance. No provider execution, provisioning,
credentials, hosting purchases, releases or deployment are introduced.

> Current source reconciliation: [PR7 + consumer consolidation](CONSOLIDATION_20261101.md). Earlier branch/status notes below are preserved history.

> Update: comparison reports and canonical bundle checking are now implemented as approved local modules; see [milestone](../reviews/2026-10-30-local-consumers.md). What-if, CLI, planner reader and UI wiring remain deferred. PR6 is merged; older status below is historical.

# Accepted local-product completion checklist

Current tested integrated implementation: `1fc62cfd99801d50285e85902f8c6a5d497e6b0b` on `chatgpt/consolidation-20261101`, combining PR7 source `d9d296399b425fd1ac41a066715c94397b1e452a` and approved consumer source `988b721d69138adc517ab6a127782229e8d101db`. Documentation-only head `f23cfe8` was pushed and PR8 is ready for review, not merged. Main remains `ee90c88de73b4d49698a3575d73373007d41c51f` at this reconciliation. [Current evidence and restart](CONSOLIDATION_20261101.md).

Historical reliability implementation `576473ad050fbd5cf50622e8c1a739c78f793336` on local branch `work` supplied the wrapped-copy path admission and dark-mode link fixes; it does not include consumers. Its original [verification evidence](../reviews/2026-10-30-local-verification.md) remains preserved, not the current checkout instruction. PR6 is already merged. No release or deployment is claimed.

## Implemented with recorded evidence

| Accepted capability | Evidence and limits |
| --- | --- |
| Bounded folder/ZIP intake | Path/collision/type/header/CRC/size admission, worker deadlines/cancel, explicit root and HTML entrypoint preflight; existing intake/ZIP regression fixtures. |
| Original-byte identity | Per-file SHA-256, canonical manifests, same-size change evidence and repeat-read binding; no content normalization. |
| Public-data/use gates | Heuristic scan, contract reports, complete severity counts and fail-closed truncation; rights/public review/payment-token restrictions retained. No general secret-absence claim. |
| Manual exports | Payload/control separation, manual instructions; byte round-trip and timezone regression evidence. No provider writes. |
| Research browsing | Existing catalogue and evidence/compatibility labels; no automatic prose-to-capability qualification. |
| Offline comparison | Exact size/hash differences, disclosed wrapper interpretation, all results reachable with at most 1,000 rows per list. PR6 presentation fixes plus PR7 wrapped-path admission fix are included in PR8. |
| Recovery | Original-source retention, unsupported records read-only, optional local profile, actual payload bytes bound to manifest, identity-only restore and metadata export. No imported execution authority. |
| Keyboard workflows | Recorded recovery focus/reflow coverage; PR6 adds intake/comparison cancellation focus and paging navigation. Automated checks are not manual acceptance. |
| Local consumer modules | Structured comparison reports and canonical bundle validation implemented and tested; no UI/CLI/what-if integration or provider authority. |
| Standalone planner | Preserved engine/tests/samples and attributed browser evidence; distinct schema/filtering/identity retained. |

## Known reproducible defects still open

None remain from this bounded follow-up; this is not a defect-free warranty. PR6's fixes are merged in main. The two additional reliability defects are included in pushed PR8, with regression evidence in the historical reliability review. Earlier logs and committed regressions remain preserved.

Focused AI review at unchanged implementation source covered comparison selection/paging and focus changes, text rendering, worker result bounds, repeated-read digest binding, recovery payload binding, record-parser limits and manual export layout. It found no new reproduced defect. This reuses earlier reviews, not a fresh independent audit. Synchronous export is bounded by admitted input, but maximum-capacity responsiveness is not newly measured.

## Exact verification status

- Integrated source `1fc62cf`: 427 canonical tests and 166 standalone-planner tests passed; committed samples unchanged; build/typecheck passed.
- Integrated Chromium checks: 20 comparison-root assertions, 46 main checks, 11 paging assertions, 8 cancellation-focus checks and 10 consumer assertions. Zero page errors/external requests. Computed link/body contrast: 16.31:1 light and 15.44:1 dark.
- Historical reliability source `576473a`: 395 canonical/166 planner tests; separate accessibility evidence of 16 axe scans, 16 reflow checks and 184 keyboard controls. These are attributed earlier results, not a fresh integrated axe run; axe-core is unavailable in this executor.
- Historical separate AI reviewer: 57 focused tests passed and no remaining actionable findings in the comparison fix. This is focused AI evidence, not independent human security acceptance.
- Main CI 41045376609 passed at `ee90c88`. Consolidation push CI 41409033963 passed at documentation-only head `f23cfe8`; its PR test and Sonar checks also passed. CodeRabbit reported two documentation findings; this documentation correction addresses both. Read checks/review on the new head before merging; earlier success is not proof of later-head success.

## Acceptance and access gates

1. Missing: complete source-pinned 09_ACCEPTANCE.md/T-ART-08 and every referenced fixture, expected classification and limits. Seven synthetic cases are not that authoritative suite. Do not invent missing bytes or detector requirements.
2. Human qualification: manual screen-reader/accessibility and independent security acceptance. AI checks cannot close these.
3. Environment: local planner file navigation administratively denied; Firefox downloads denied. No retries/alternate routes. Claude browser evidence stays attributed. Real suspended-tab/OS and broader browser qualification remain unexecuted here.
4. Private archive transfer retry allowance exhausted; full archive never recovered here. Do not retry or publish private source text.
5. Integration: PR6 is merged. PR8 combines PR7 reliability and approved local consumer work (988b721), preserving both source branches. PR8 remains unmerged at this update. Consumer modules extend the local product; they do not replace canonical identity, planner schemas or safety gates.

## Optional/deferred

Local comparison-report and canonical bundle-checking modules are implemented under the approved bounded scope. Broader package distribution/schema productization, what-if planning, CLI, standalone-planner bundle reader and UI wiring remain deferred proposals in docs/plans/2026-10-29-consumer-packages.md; the implemented modules do not approve that broader scope. Shared-engine migration, ZIP64 expansion, more hosting research and live provider execution are not required for the accepted local product. No credentials, accounts, purchases, security-setting changes, deployments or releases.

## Next actions and restart

1. Review PR8 and its latest documentation head against integrated tested source 1fc62cf. Reconcile the two documentation findings and final-head checks before an exact-head-guarded merge. Commits 37553f6 and 576473a are historical reliability evidence, not the integration target.
2. Obtain exact missing acceptance inputs and arrange human qualification. Continue independent engineering when a concrete defect is found; otherwise report implementation present with acceptance incomplete.
3. Keep tested source and documentation-only heads distinct. See the linked latest review for exact commands, coordination and resource cleanup. Older contradictory next steps are historical.

Executor: /workspace/replikrazy-integration, branch `chatgpt/consolidation-20261101`. Reconcile live refs and ownership before editing; preserve the original reliability and consumer branches. Run `npm run test:all` and `npm run build`. Browser scripts use installed Chromium; no browser download needed. Use /opt/codex/cua_node/lib for BROWSER_TEST_TOOLS; consumer smoke requires the existing canonical dev server on localhost:4175. Follow the two-terminal setup in the consolidation handoff. Main regressions/accessibility expect a canonical preview at localhost:4173; root/focus/paging scripts default to localhost:4174. No alternate route to the denied standalone planner is authorized.

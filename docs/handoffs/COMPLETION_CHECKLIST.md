# Accepted local-product completion checklist

Implementation source: 4be1a4d21d43cf5fd4812b7911d7d7328521ce04 on chatgpt/local-workflow-20261030, draft PR6 into main 3ccb71ab060718f4f2a9223d6dd8eaed448a31d9. This checklist changes documentation only, not the tested implementation. Recheck live refs/ownership. Older branch tips are incorporated into main; no duplicate consolidation is needed. One integrator, no extra workers or paid calls. Source was clean and pushed before this update.

## Implemented with recorded evidence

| Accepted capability | Evidence and limits |
| --- | --- |
| Bounded folder/ZIP intake | Path/collision/type/header/CRC/size admission, worker deadlines/cancel, explicit root and HTML entrypoint preflight; existing intake/ZIP regression fixtures. |
| Original-byte identity | Per-file SHA-256, canonical manifests, same-size change evidence and repeat-read binding; no content normalization. |
| Public-data/use gates | Heuristic scan, contract reports, complete severity counts and fail-closed truncation; rights/public review/payment-token restrictions retained. No general secret-absence claim. |
| Manual exports | Payload/control separation, manual instructions; byte round-trip and timezone regression evidence. No provider writes. |
| Research browsing | Existing catalogue and evidence/compatibility labels; no automatic prose-to-capability qualification. |
| Offline comparison | Exact size/hash differences, disclosed wrapper interpretation, all results reachable with at most 1,000 rows per list. Latest fixes in PR6. |
| Recovery | Original-source retention, unsupported records read-only, optional local profile, actual payload bytes bound to manifest, identity-only restore and metadata export. No imported execution authority. |
| Keyboard workflows | Recorded recovery focus/reflow coverage; PR6 adds intake/comparison cancellation focus and paging navigation. Automated checks are not manual acceptance. |
| Standalone planner | Preserved engine/tests/samples and attributed browser evidence; distinct schema/filtering/identity retained. |

## Known reproducible defects still open

None identified in this bounded follow-up; this is not a defect-free warranty. PR6's three reproduced defects are fixed on the branch, not yet main. Original logs remain under /workspace/checkpoints: comparison-root-original.log, analysis-focus-original.log and comparison-pages-original.log. Committed regression scripts/tests preserve reproduction logic.

Focused AI review at unchanged implementation source covered comparison selection/paging and focus changes, text rendering, worker result bounds, repeated-read digest binding, recovery payload binding, record-parser limits and manual export layout. It found no new reproduced defect. This reuses earlier reviews, not a fresh independent audit. Synchronous export is bounded by admitted input, but maximum-capacity responsiveness is not newly measured.

## Exact verification status

- Local at 4be1a4d: 395 canonical tests, 166 planner tests, samples unchanged, typecheck/build passed.
- Paging browser fixture at that source: 11 assertions, zero page errors/external requests.
- Earlier slices separately passed 10 comparison-root assertions and eight LTR/RTL focus assertions; not a fresh combined browser run.
- PR CI 41042004227 succeeded at 4be1a4d.
- Separate push CI 41041995994 was still queued at review. Cause unknown; neither passed nor failed. No duplicate dispatch/cancellation/retry.
- Main CI 41032154581 and 41032154579 passed at 3ccb71a.
- No tests rerun solely for this documentation update; automatic CI for its head must be reported separately.

## Acceptance and access gates

1. Missing: complete source-pinned 09_ACCEPTANCE.md/T-ART-08 and every referenced fixture, expected classification and limits. Seven synthetic cases are not that authoritative suite. Do not invent missing bytes or detector requirements.
2. Human qualification: manual screen-reader/accessibility and independent security acceptance. AI checks cannot close these.
3. Environment: local planner file navigation administratively denied; Firefox downloads denied. No retries/alternate routes. Claude browser evidence stays attributed. Real suspended-tab/OS and broader browser qualification remain unexecuted here.
4. Private archive transfer retry allowance exhausted; full archive never recovered here. Do not retry or publish private source text.
5. Integration: PR6 remains draft/unmerged. Creation approved; do not infer ready/merge/review authority from earlier PR-specific approvals or bypass denials. Verify current head, CI and applicable authority.

## Optional/deferred

Consumer comparison reports, what-if and offline bundle packages remain proposals in docs/plans/2026-10-29-consumer-packages.md. Presence in main is not implementation or schema approval. Shared-engine migration, ZIP64 expansion, more hosting research and live provider execution are not required for the accepted local product. No credentials, accounts, purchases, security-setting changes, deployments or releases.

## Next actions and restart

1. Reconcile PR6/main and existing CI; preserve failure evidence if any. Review the complete diff and fix concrete findings only. Integrate when evidence and applicable authority permit.
2. Obtain exact missing acceptance inputs and arrange human qualification. Continue independent engineering if a concrete defect is found; otherwise report implementation present with acceptance incomplete rather than inventing features.
3. Keep tested source and documentation-only heads distinct in handoffs. Older contradictory next steps are historical.

Executor: /workspace/replikrazy-integration, branch chatgpt/local-workflow-20261030. Original worktree /workspace/replikrazy preserved. Reuse installed dependencies and lockfile. Commands: npm run test:all; npm run build. Local preview: npm exec vite preview -- --host 127.0.0.1 --port 4174 --strictPort. Verify served build; old process may have expired.

Existing browser tooling: BROWSER_TEST_TOOLS=/opt/codex/cua_node/lib node scripts/browser-comparison-pages.mjs; also browser-comparison-root.mjs and browser-analysis-focus.mjs. TEST_ORIGIN selects a canonical localhost preview only, never a workaround for the denied standalone planner. No downloads to recreate old results.

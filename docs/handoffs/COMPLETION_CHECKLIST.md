# Accepted local-product completion checklist

Current tested implementation: 576473ad050fbd5cf50622e8c1a739c78f793336 on local branch `work`, based on merged main ee90c88de73b4d49698a3575d73373007d41c51f. PR6 merged on 2026-10-30; GitHub CI 41045376609 passed at that merge. Two local fixes address wrapped-copy path admission and dark-mode link contrast. [Evidence and restart](../reviews/2026-10-30-local-verification.md). No push, PR, merge, release or deployment occurred in this continuation. Earlier integration claims below are superseded by this paragraph.

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

None remain from this bounded follow-up; this is not a defect-free warranty. PR6's fixes are merged in main. The two additional defects reproduced during this continuation are fixed locally, with regression evidence in the linked review. Earlier logs and committed regressions remain preserved.

Focused AI review at unchanged implementation source covered comparison selection/paging and focus changes, text rendering, worker result bounds, repeated-read digest binding, recovery payload binding, record-parser limits and manual export layout. It found no new reproduced defect. This reuses earlier reviews, not a fresh independent audit. Synchronous export is bounded by admitted input, but maximum-capacity responsiveness is not newly measured.

## Exact verification status

- Canonical tests: 395 passed; standalone planner: 166 passed; committed samples unchanged. Full suites ran after the comparison fix; subsequent product change is one CSS rule only.
- Final build/typecheck passed at source 576473a.
- Chromium comparison-root regression: 20 assertions; main regressions: 46 checks; comparison paging: 11 assertions; cancellation focus: 8 checks. Zero page errors/external requests.
- Final accessibility run: 16 axe scans, 16 reflow checks, 184 keyboard controls; zero violations/page errors/external requests. It explicitly opens optional controls before traversing them; hidden controls are excluded using visibility checks.
- Separate AI reviewer: 57 focused tests passed and no remaining actionable findings in comparison fix. This is focused AI evidence, not independent human security acceptance.
- Remote main CI 41045376609 passed at ee90c88. New local fixes are not pushed and have no remote CI result.

## Acceptance and access gates

1. Missing: complete source-pinned 09_ACCEPTANCE.md/T-ART-08 and every referenced fixture, expected classification and limits. Seven synthetic cases are not that authoritative suite. Do not invent missing bytes or detector requirements.
2. Human qualification: manual screen-reader/accessibility and independent security acceptance. AI checks cannot close these.
3. Environment: local planner file navigation administratively denied; Firefox downloads denied. No retries/alternate routes. Claude browser evidence stays attributed. Real suspended-tab/OS and broader browser qualification remain unexecuted here.
4. Private archive transfer retry allowance exhausted; full archive never recovered here. Do not retry or publish private source text.
5. Integration: PR6 is merged. This continuation has local commits only; no new remote integration or publication is claimed. Preserve unrelated remote consumer work (988b721), which is not main or an approved replacement scope.

## Optional/deferred

Consumer comparison reports, what-if and offline bundle packages remain proposals in docs/plans/2026-10-29-consumer-packages.md. Presence in main is not implementation or schema approval. Shared-engine migration, ZIP64 expansion, more hosting research and live provider execution are not required for the accepted local product. No credentials, accounts, purchases, security-setting changes, deployments or releases.

## Next actions and restart

1. Review local commits 37553f6 and 576473a against main ee90c88. No unresolved finding remains from this slice. Remote publication/integration is separate.
2. Obtain exact missing acceptance inputs and arrange human qualification. Continue independent engineering when a concrete defect is found; otherwise report implementation present with acceptance incomplete.
3. Keep tested source and documentation-only heads distinct. See the linked latest review for exact commands, coordination and resource cleanup. Older contradictory next steps are historical.

Executor: /workspace/replikrazy, branch `work`. Dependencies installed using /workspace/scratch/npm-cache. Run `npm run test:all` and `npm run build`. Browser scripts use installed Chromium; no browser download needed. Use /workspace/scratch/browser-check-tools for BROWSER_TEST_TOOLS. Main regressions/accessibility expect a canonical preview at localhost:4173; root/focus/paging scripts default to localhost:4174. No alternate route to the denied standalone planner is authorized.

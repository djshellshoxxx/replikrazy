# Local verification and defect fixes — 2026-10-30

## Delivered scope and source

Accepted product remains the browser-only static-site planner, with manual exports and local comparison/recovery. Tested source: `576473ad050fbd5cf50622e8c1a739c78f793336`, branch `work`, checkout `/workspace/replikrazy`. Base `ee90c88de73b4d49698a3575d73373007d41c51f` matches remote main when checked. GitHub reports PR6 merged; main CI run 41045376609 succeeded. A separate remote consumer commit 988b721 exists; no open PR was returned. It was inspected for ownership context only and was not integrated. Optional proposals are not inferred requirements.

## Reproduced defects and changes

1. Commit `37553f6`: comparison rejected a valid wrapped copy before root removal when its payload path was 240 bytes and its original wrapped path was 245 bytes. Actual Chromium regression failed with `Could not read this input.` instead of an identical comparison. Original intake already admitted that payload after explicit wrapper selection. Comparison now performs one validated stripped analysis and derives both interpretations from that admitted byte snapshot. Reconstructed original paths must pass existing validation; every intake error still rejects. Existing overlap/match/tie preference is retained. No intake, identity, consent or export contracts changed. The committed browser test covers the boundary, unchanged artifact identity, plain interpretation preference, traversal rejection and payload overlimit rejection.
2. Commit `576473a`: an unstyled recovery anchor had insufficient dark-mode contrast. A separately archived/build baseline at ee90c88 reproduced axe `color-contrast` on dark/LTR/empty/320. Links now use the theme foreground, retaining underline/focus styling. The accessibility runner also counted a checkbox in closed details because this Chromium reports its rectangles. The runner explicitly opens optional controls before Tab traversal and additionally checks rendered visibility. It does not drop that checkbox from coverage or relax axe rules.

## Verification

| Check | Result |
|---|---|
| Baseline and post-comparison full suites | PASS: 395 canonical tests, 166 planner tests; samples unchanged |
| Final build/typecheck | PASS at 576473a |
| Chromium comparison-root | PASS: 20 assertions, including newly red/green reproduced boundary |
| Chromium main regressions | PASS: 46 checks |
| Chromium comparison paging | PASS: 11 assertions |
| Chromium cancellation focus | PASS: 8 checks, LTR/RTL |
| Final axe/reflow/keyboard matrix | PASS: 16 axe scans, 16 reflow checks, 184 controls, light/dark and LTR/RTL |
| Page errors / external browser requests | Zero in passing browser suites |
| Separate focused AI review | PASS: 57 focused tests; no unresolved actionable finding on either fix |
| Diff / script syntax | PASS |
| Full product release qualification | BLOCKED: authoritative T-ART-08 source and fixtures, manual screen-reader and independent security acceptance |

Full suites ran after the comparison change; subsequent product change is CSS only. They were not redundantly rerun after documentation changes. Initial dependency setup used an unwritable default home cache and overlapping installs; a partial run failed with missing Vitest worker module and subprocess EPERM. Those results were retained and discarded as invalid baseline evidence; clean install with a workspace cache and supported process/network permissions yielded the passing baseline and integrated suites. Browser main runner first targeted an unstarted 4173 server; a canonical preview on that port resolved setup. Optional axe tooling was absent and was installed outside the application. No app dependencies/lockfile changed. No browser binary download, private archive retry or denied standalone planner navigation occurred.

## Coordination / durable handoff

The [completion checklist](../handoffs/COMPLETION_CHECKLIST.md) is authoritative for accepted scope and open gates. Session scratch coordination/evidence is in `/workspace/replikrazy/work/` and excluded from commits.

| Task | Owner | Final state | Files / dependencies / acceptance |
|---|---|---|---|
| RZ-01 discovery | lead | DONE | Read-only repo/runtime/remote reconciliation; main/PR/CI established |
| RZ-02 focused review | reviewer | DONE | Read-only comparison/focus review; concrete P2 reproduction, 57 tests |
| RZ-03 comparison fix | lead | DONE | main.ts + browser-comparison-root.mjs; RZ-02 dependency; red/green browser, full suites/build |
| RZ-04 fix review | reviewer | DONE | Read-only RZ-03 diff; no unresolved finding |
| RZ-05 integration/evidence | lead | DONE | Current checklist/restart/review; exact source, results and blockers recorded |
| RZ-06 contrast fix/review | lead / reviewer | DONE | style.css + accessibility runner; baseline repro, full accessibility matrix, separate read-only review |

Lead was the only writer in one delivery workspace; reviewer owned no shared files. No concurrent implementation worktrees were needed. No additional cloud instances or paid infrastructure were provisioned. Temporary localhost preview processes are stopped at handoff; the original managed development instance and installed dependencies/tooling are retained for resumption. No deployment, push, remote merge, publication or external messages occurred. Next: review local commits for remote integration when authorized, obtain exact missing acceptance inputs, and arrange human qualification. No known remaining reproduced implementation defect is claimed from this bounded review.

To reproduce:

```sh
npm ci --cache /workspace/scratch/npm-cache
npm run test:all
npm run build
npm exec vite preview -- --host 127.0.0.1 --port 4173 --strictPort
BROWSER_TEST_TOOLS=/workspace/scratch/browser-check-tools node scripts/browser-regressions.mjs
BROWSER_TEST_TOOLS=/workspace/scratch/browser-check-tools node scripts/browser-accessibility.mjs
TEST_ORIGIN=http://127.0.0.1:4173 BROWSER_TEST_TOOLS=/workspace/scratch/browser-check-tools node scripts/browser-comparison-root.mjs
TEST_ORIGIN=http://127.0.0.1:4173 BROWSER_TEST_TOOLS=/workspace/scratch/browser-check-tools node scripts/browser-analysis-focus.mjs
TEST_ORIGIN=http://127.0.0.1:4173 BROWSER_TEST_TOOLS=/workspace/scratch/browser-check-tools node scripts/browser-comparison-pages.mjs
```

## 2026-10-27 user-facing recovery preview

Optional step 7 now inspects recovery JSON in a dedicated bounded/cancellable worker, presents safe counts/messages and preserves exact original downloads. Explicit profile opt-in; no active-state writes. [Evidence and workflow](../reviews/2026-10-27-recovery-preview.md). Latest: 341 unit tests / 26 files, typecheck/build, 39 existing and 25 recovery Chromium checks passed. Local production preview at 127.0.0.1:4173, not externally published.

## 2026-10-27 opt-in local validation profile

Defined `replikrazy-local-verify/1` after reconciling preserved contracts/producers; exact JCS/SHA-256 keys and conservative snapshot/pair validation, no legacy rewrite. [Contract](../contracts/LOCAL_VERIFY_PROFILE_1.md), [evidence](../reviews/2026-10-27-local-verify-profile.md). Latest: 333 tests / 25 files, typecheck/build and 39 Chromium checks passed. Mechanical local-profile definitions are resolved; hydration/provider execution remain separately gated.

## 2026-10-27 read-only plan/operation boundary

Manual-plan and non-mutating operation structural validation, references and credential-field exclusions added; source retained and disposition remains read-only-unvalidated. [Evidence and exact missing lifecycle definitions](../reviews/2026-10-27-recovery-plan-operation.md). Latest: 316 tests / 24 files, typecheck/build and 39 Chromium checks passed. No recovery hydration/import UI or remote authority.

## 2026-10-27 provenance metadata checkpoint

Continued from ArtifactHandle checkpoint 0baa4498f89db1f1e2b321d14ad7f39575ded506: validate owner-claim fields and included-artifact references; signatures stay opaque/untrusted. [Evidence and remaining import gates](../reviews/2026-10-27-artifact-binding.md). Latest: 276 tests / 21 files, typecheck/build and 39 Chromium checks passed. Inspection remains read-only-unvalidated; no hydration authority.

## 2026-10-27 ArtifactHandle binding checkpoint

Read-only recovery inspection validates ArtifactHandle metadata and canonical manifest identity. No payload verification or hydration. [Evidence](../reviews/2026-10-27-artifact-binding.md). Latest: 265 tests / 20 files, typecheck/build and 39 Chromium checks passed. Scanner unchanged.

## 2026-10-27 strict recovery-source checkpoint

Added duplicate-key-safe bounded record JSON parsing, integrated into saved statuses, plus source-preserving read-only recovery-envelope inspection (no hydration/import UI). Broker scanner proposal evaluated: original timing gate passes; scanner unchanged. [Evidence and next boundary](../reviews/2026-10-27-recovery-source.md). Latest: 251 tests / 19 files, typecheck/build and 39 Chromium checks passed.

## 2026-10-27 internal-result and retention checkpoint

Same local continuation branch. Internal worker result structure is validated; existing manual-status persistence has a version/identity boundary, preserves legacy and rejected source, and offers read-only source backup. [Scope and evidence](../reviews/2026-10-27-result-retention.md). Latest: 230 tests / 17 files, typecheck/build and 39 Chromium checks passed. Full RecoveryRecord import remains unimplemented; scanner stays broker-owned.

## 2026-10-27 analysis lifecycle checkpoint

Same local continuation branch. Added monotonic deadline alongside wall-clock limit and safe worker envelope/progress handling. [Evidence and limitations](../reviews/2026-10-27-analysis-envelope.md). Latest: 208 tests / 15 files, typecheck/build and 35 Chromium checks passed. Scanner untouched and broker-owned.

## 2026-10-27 manifest boundary checkpoint

Same local branch `chatgpt/intake-read-bounds-20261027`: exact manifest records, existing intake count/collision checks, validation before digest. [Evidence and limits](../reviews/2026-10-27-manifest-boundary.md). Latest: 199 tests / 15 files, typecheck/build, 35 Chromium checks passed. Scanner review remains broker-owned; no remote writes.

## 2026-10-27 local continuation

Resume `chatgpt/intake-read-bounds-20261027`; preserve the published checkpoint and Claude branch. See [read-boundary results](../reviews/2026-10-27-read-boundary.md). Latest validation: 190 tests, typecheck within build, production build and 35 Chromium regressions passed. Broker scan review packet is saved as native Library text outside git and awaits parent relay; missing T-ART-08 source remains unavailable. No push/merge/deployment in this slice.

# Replikrazy — restart handoff

> Current owner-requested GitHub checkpoint: `checkpoint/chatgpt-lean-handoff-20261025`.
> Read [the checkpoint handoff](GITHUB_CHECKPOINT_20261025.md) first. Earlier
> local-only instructions below are historical and superseded only for this
> explicitly authorized source checkpoint. Other restrictions remain in force.

## Latest local ZIP boundary and transfer checkpoint — 2026-10-25

Continue `chatgpt/lean-reliability-20261025`; inspect local `git log` after
`1cf27b0`. Narrow ZIP-directory/metadata fixes preserve the original gates and
add actual-output overflow detection with one bounded sentinel byte. Full
failure evidence, review results, remaining conformance gaps and exact next code
ranges are in [`../reviews/2026-10-25-zip-boundary.md`](../reviews/2026-10-25-zip-boundary.md).

Results: **176 tests / 13 files**, typecheck/build/diff check pass; Chromium
**35 checks**, **16 axe / 16 reflow checks**, **156 keyboard controls**, zero
violations/page errors/external requests. Disjoint reviewer verified fixes with
**58 focused tests**; not a full audit. Reuse these results; avoid redundant
whole-repo scans/reruns unless subsequent code changes require them.

A small source-only incremental Git bundle/diff and result manifest is being
prepared outside the repo under `/workspace/checkpoints/`. Its manifest records
the exact source SHA and base prerequisite `3233bb4a88fb254ba16ffc32c6e157aeb85750f5`.
Private reference text, transfer metadata, node_modules, browser/build binaries
and the research archive are excluded. This is local preparation for a private
Library checkpoint, not GitHub publication or deployment.

No new spec input needed for this completed batch. A broader private-data
scan slice needs `09_ACCEPTANCE.md` T-ART-08 plus its referenced synthetic
fixtures; a policy expansion needs `03_POLICY_AND_TARGETS.md` relevant numbered
sections. Request source-pinned text, not archive-recovery workarounds.
Download restrictions and stricter policy remain in force.

## Latest local contract slice — 2026-10-25

Continue local branch `chatgpt/lean-reliability-20261025` after `432870e`; inspect
`git log` for the newest checkpoint. Claude/main/PR refs remain unchanged.
No source publication, provider operation or additional download attempt.

The parent supplied **01_CONTRACTS.md and 02_ARTIFACTS.md directly in a private
message**. This unblocked only their small contract slice; this executor did
not recover/hash the archive and does not have the broader pack. Exact source
hashes, provenance distinction, original review failure and remaining normative
differences are in [`../reviews/2026-10-25-contract-boundary.md`](../reviews/2026-10-25-contract-boundary.md).
Full private reference text is not in git.

Completed: canonical contract ScanReport export bound to artifact identity;
shared Diagnostic/MKError/Result types and bounded validators; safe code/key
mapping; complete severity counts before truncation plus deterministic warning
and blocking summaries; safe dependency roles/origins; typed worker failures.
No MIME verification is claimed (`fileMetadata` empty). Artifact bytes/identity,
rights/public-data/payment/token gates and manual-only scope remain unchanged.

Validation: **167 tests / 13 files**, typecheck/build/diff check pass. Chromium
**33 regression checks** (including handoff sidecar download), **16 axe/reflow
scans**, **156 keyboard controls**, zero violations/page errors/external requests.
Independent focused reviewer verified the fixed URL-bound regression and found
no remaining concrete issue in this slice; not a full audit.

Still open: exact full Unicode fold, intake ordering versus proposed spec,
active-time/continue semantics, full public-operation Result migration, other
record/version boundaries and broader detector coverage. Do not infer policy
from absent specs. Manual screen reader/cross-browser/real suspension remain
unverified; prior download denial and exhausted Library retry remain stopped.

## Latest local browser/transfer follow-up — 2026-10-25

Continuation remains `chatgpt/lean-reliability-20261025`; inspect local `git log`
for the latest tip after `78bc63c`. No source pushes or remote mutations. Final
live refs remain unchanged, including Claude at `3233bb4`.

New verified slice:
- Chromium real folder picker + explicit root selection produces the same
  artifact identity as the equivalent ZIP.
- Browser test holds two identity hashes and releases newest first, proving
  the older completion cannot overwrite the latest identity.
- Fixed a saved-status restoration edge case when a fresh plan is already
  ready for manual export. Original regression failed with expected
  `uploaded-by-user`, received `ready-for-manual-export`; retained test now
  passes. Restoration still cannot override policy blockers or unknown values.
- Browser runners share an explicit `BROWSER_ENGINE` selector (chromium,
  firefox, webkit) and optional `BROWSER_EXECUTABLE`. They never download
  browsers. Chromium uses the existing executable by default.

Results: **158 tests / 12 files**, typecheck, build and diff check pass.
Chromium: **28 regression checks**, **16 axe scans**, **16 reflow checks**,
**156 visible keyboard controls**; zero violations/page errors/external requests.
No fixture oracle, threshold or original failure was weakened.

### Exact remaining external blockers

1. **Library retry exhausted.** Parent authorized one retry after the original
   transfer error. Refreshed current resolved-reference documentation/helpers;
   pinned prior returned file id plus Library id/name. `prepare_materialize`
   succeeded for v13, size 2,573,317, using executor-local destination
   `/workspace/library-files/replikrazy-private-retry`. Passed the complete
   returned transfer object unchanged to the supported helper, targeting
   `checkpoint.zip` there. Helper exited 1 with exactly:
   `library file transfer failed: download failed`.
   No archive exists, no bytes or SHA-256 verified, no schemas read. This is a
   **transfer error, not an explicit access denial**. Complete structured
   preparation result is privately preserved outside git in that directory
   as `transfer-result.json` (mode 0600); do not publish it. Total helper
   attempts across this continuation: initial attempt plus **one retry**.
   **Stop further transfer attempts.** No routes were mixed or URLs invented.
2. **Additional browser installation denied.** Neither Firefox nor WebKit was
   installed. A single standard Playwright `install firefox webkit` invocation
   targeted `/workspace/scratch/replikrazy-browsers`. Firefox download returned
   HTTP **403 `Domain forbidden`**. The installer automatically tried its
   mirrors five times and exited 1 before a termination attempt found a live
   process. No separate retry/fallback/environment change followed; WebKit
   installation was not reached. Cross-browser execution remains **blocked**,
   not passed. Do not retry this denial without materially new authorization.

Contract ScanReport/Diagnostic alignment remains blocked on missing private
spec bytes. Manual screen-reader, real suspended-tab and full audit work remain
unverified. Prior independent review was focused, not release qualification.

## Latest local snapshot and accessibility batch — 2026-10-25

Continue **local** branch `chatgpt/lean-reliability-20261025`; inspect `git log`
for its current tip. Local checkpoint `9c57cda` fixed the five review findings;
this next checkpoint adds snapshot consistency and RTL/browser regressions.
Claude's remote tip remains `3233bb4`; main and PR refs were also unchanged at
final inspection. No source push/publication, CI dispatch or deployment occurred.

Completed:
- A source digest binds original normalized paths and SHA-256 file content.
  Root-choice reanalysis and a comparison's second (stripped-root) read must
  match the first read. Same-size byte edits and path changes produce
  `MK_INPUT_CHANGED` with no retained files or inventory. A new explicit input
  selection intentionally establishes a new snapshot.
- This is a reread-consistency invariant, **not** filesystem monitoring: a
  browser File/Blob snapshot may not expose later disk edits. No claim that
  arbitrary edits before the first read or behind immutable snapshots are detected.
- Changed-copy results show exact expected/actual hashes even for equal sizes.
- Independent comparison Cancel control; invalid intake status explicitly says
  export is blocked.
- Logical CSS spacing/alignment for RTL; isolated LTR hashes and automatic
  filename direction. UI remains English; this is layout support, not localization.

Final verification:
- 12 test files / **157 tests passed**, preserving all original 144 tests,
  fixture oracles, hostile regex budgets and fuzz seed.
- Typecheck, production build and `git diff --check` pass.
- `scripts/browser-regressions.mjs`: **24 checks**, zero page errors and external
  requests. Covers export policy, malformed storage, storage denial, invalid
  comparison inputs, comparison cancellation and unavailable workers.
- `scripts/browser-accessibility.mjs`: **16 axe scans / 16 reflow checks**
  (light/dark × LTR/RTL × empty/loaded × 320/960 px), zero violations;
  **156 visible controls reached** over four keyboard traversals. Expanded
  same-size difference details expose the exact expected/actual hashes.
  Zero page errors and external requests.
- Optional external tools: Playwright core and axe-core 4.10.2 in
  `/tmp/replikrazy-browser`; Chromium `/usr/bin/chromium`. Build and run Vite
  preview on 127.0.0.1:4173, then:
  `BROWSER_TEST_TOOLS=/tmp/replikrazy-browser node scripts/browser-accessibility.mjs`.

Independent review of the security fixes additionally reran **49 focused tests**
and Chromium policy/invalid-reference reproductions, with zero page errors;
reviewer found all five issues addressed and made no edits. This is focused
review, not full audit or release qualification. Manual screen reader,
cross-browser and real suspended-tab checks remain open. ScanReport/Diagnostic
contract alignment remains blocked on the unavailable private specs. No further
Library transfer was attempted in this batch (details below).

## Continued local security batch — 2026-10-25

A disjoint read-only reviewer found five reproducible issues at `d54a3f7`.
All five now have fixes and regressions: global policy gates on both export
forms; safe stored-status parsing; exact prototype-related ZIP filenames;
fail-closed scan truncation with bounded origin/file relationships; rejection
of invalid reference bundles in comparison. See
[`../reviews/2026-10-25-focused-security.md`](../reviews/2026-10-25-focused-security.md)
for original reproductions, failed first fix and scope limitations.

Validation: 152 tests / 12 files, typecheck, build and diff check pass. Committed
browser runner gives 22 checks, zero page errors and zero external requests.
Run `BROWSER_TEST_TOOLS=/tmp/replikrazy-browser node scripts/browser-regressions.mjs`
against production preview on port 4173; tooling is external to the repo.

Library clarification: resolved-reference `prepare_materialize` targeted
`/workspace/library-files/replikrazy-private`; preparation was called twice,
then the current bundled helper ran **once**, targeting `checkpoint.zip` in
that directory. It returned `library file transfer failed: download failed`.
No transfer retry has been attempted. The directory remains empty. This is a
transfer error, not an explicit access denial; no bytes/hash were recovered.
Parent is examining supported options; do not retry or invent storage URLs.

## ChatGPT local continuation — 2026-10-25

Current continuation branch: `chatgpt/lean-reliability-20261025`, based on
`3233bb4a88fb254ba16ffc32c6e157aeb85750f5`. This section supersedes the older
session's ownership and "all pushed" statements below for this continuation.
No pushes, PR changes, merges, research publication or provider writes were made.
Live refs and draft PR #1 were inspected before changes; refs were unchanged
at the final check. No AGENTS.md or local skill files were present.

Completed bounded reliability batch:
- Separate intake/comparison worker ownership; replacing a job terminates it,
  and queued messages cannot affect its replacement.
- 60-second worker budget, including a wall-clock deadline check on messages
  after tab suspension. Worker creation failure now fails closed instead of
  doing uninterruptible work on the page thread.
- New intake clears previous artifact/export/comparison state immediately and
  resets public-data review. Identity hashes and asynchronous exports cannot
  commit stale results after their inputs change.
- Comparisons pin their reference inventory, reject intake errors rather than
  comparing a valid subset, and discard stale results/progress.
- Export handlers recheck rights/intended-use/public-data gates.

Verification in this environment:
- Baseline: 11 test files / 137 tests passed; typecheck and build passed.
- Changed: 12 test files / 144 tests passed; typecheck and build passed.
  Existing fuzz, hostile regex budgets, fixtures and thresholds are unchanged.
- Chromium via Playwright against production preview: 8 assertions covering
  valid comparison, malformed-copy rejection, export invalidation, public-data
  reset, hostile-script nonexecution and worker-unavailable failure. Zero page
  errors and zero external requests. Smoke script retained outside git at
  `/workspace/scratch/replikrazy-validation/check.mjs`; its Playwright tooling
  is in `/tmp/replikrazy-browser` (import resolution needs that directory).
- Initial npm ci failed because its default cache could not be created;
  `npm ci --cache /tmp/replikrazy-npm-cache` succeeded without lockfile changes.
- `git diff --check` passed.

Private specs blocker: Library preparation resolved version 13, but the
supported executor-local materialization helper returned exactly
`library file transfer failed: download failed`. No bytes were recovered or
hash-verified; no invented URL/fallback or publication was attempted. The
contract-shaped ScanReport and Diagnostic keys remain deferred pending specs.

Remaining: exact same-size input-change detection (not proved by immutable
Blob metadata), contract records, manual workflow/RTL review, manual screen
reader and independent security review. Deadline tests use controlled workers;
real browser suspension and cross-browser testing remain open. No live-browser
publishing is verified. Continue from this local branch, preserving this batch;
source publication still requires owner authorization.

_Last updated: 2026-10-25 ~11:15 UTC, after milestone 2 (Claude Code cloud session `01YP9ZPr`)._

## Ownership

| Scope | Owner | Branch |
| --- | --- | --- |
| Replikrazy (all files in this repo) | session `01YP9ZPr` (single integrator, no sub-workers) | `claude/trusting-goodall-9jdwxu`, draft PR #1 → `main` |
| GhostPay, p2p-offramp | coordinated by session `01SuN5`; **not touched here** | see those repos' handoffs |

Model routing: all Replikrazy work was done by this session on one model; no
Haiku/Sonnet workers were spawned. Do not claim otherwise.

## Refs

- `main` = `b6b763e` (owner's research-only landing README).
- `docs/research-intake-20261025` = `b6b763e` at last check (owner's review
  branch for the research; empty so far; agents do not push to it).
- Milestone 1 = `1172011`; merge of `main` = `2887c52` (CI green).
- Milestone 2 = `beffd0d` — CI `test` green on GitHub Actions (runs 40187654299, 40187652192). PR #1 is a draft, mergeable, no reviews; waiting on the owner.
- `60562e4`: docs-only handoff refresh (CI green).
- Milestone 3 (contract identity): see `git log` after `60562e4`.

## Research

The owner supplied the MirrorKit research checkpoint v13 (2026-10-25)
privately. It is marked unpublished, so it is **not** in this repo; see
`docs/research/PROVENANCE.md` for exactly what was used (spec IDs, error-code
names, Cloudflare/Netlify facts with official URLs). Next agent: if the pack
is not available to you, ask the owner; do not regenerate the research.

Pack contents (for orientation): `CURRENT_README.md`, `BUILD_PLAN.md`
(canonical plan, Tasks 1–10, Gate M), `specs/00–10, 99`,
`catalog/consolidated-providers.json` (62 profiles), `consolidated-leads.json`
(311 lead rows), `v13/hosting-database`, `v13/hosting-routes` (11 route specs,
ROUTE_CONTRACT, browser-profile addendum), `v13/guest-host-catalog`,
`v13/workflows/provider-notes`, and the reference-only licensed copies
`references/aws4fetch` (MIT) and `v13/references/browser-fs-access` (Apache-2.0).

## Gap list vs research (after milestone 2)

| # | Requirement | State |
| --- | --- | --- |
| 1 | MK-ART-002 path rules (bidi, `#%?`, UTF-8 byte limits 120/240, NFC + case-fold collisions) | **done**. The case fold is approximated with upper-then-lower casing (JS has no full case-fold API). |
| 2 | MK-ART-003 ZIP caps, metadata cap, ratio above 1 MiB, local/central name match, Unicode-path field, archive-level rejection | **done**; ZIP64 still refused (spec allows it only once fixtures prove it) |
| 3 | Manifest order = UTF-8 byte order | **done** (`compareUtf8`) |
| 4 | T-ART-02 explicit root selection | **done** (checkbox; off by default) |
| 5 | MK-ART-005 content secret gate, source-map warning | **done** (pattern-based; class + path only) |
| 6 | MK-ART-004 / MK-POL-002 / T-ART-10 compatibility hints | **done (heuristic)**: missing assets, external origins, asset base, `<base>`, routing, SW, storage, realtime, WASM, CSP meta |
| 7 | T-POL-02 provider-reserved executables | **done** for Cloudflare (`_worker.js`, `functions/`, `_routes.json`); others warn only |
| 8 | MK-ART-006 export layout `app/` + `mirrorkit-control/`, payload-only ZIP | **done** |
| 9 | Research catalogue mapper (MK-POL-006) | **done for the 62 profiles**. The owner approved publication on 2026-10-25; data is in `docs/research/mirrorkit-v13/`. `src/research/mapper.ts` maps it to `src/research/catalogue-snapshot.json` (ids/pins verbatim, source sha256). The UI shows it as a lazy, read-only lead browser. The 311-row lead register and the hosting database are published as data but not mapped into the app. |
| 10 | MK-POL-003/004 | **partial**. Done: IntendedUse, payment/token blocked everywhere, GitHub Pages exclusion, rights/public-data confirmations; research leads show operator country, market, doc languages and free model as researched text. **Open:** typed free/trial/paid and country-eligibility filters. The research prose would need per-record human review before it could be turned into typed fields. |
| 11 | T-ART-06 cancel, worker-thread work, changed input | **mostly done**: intake, hashing and scan run in a module worker with progress; Cancel terminates it and keeps nothing; a newer selection supersedes an older run; a folder file whose size changes fails with `MK_INPUT_CHANGED`. **Open:** content-change detection beyond size, a 60 s soft time limit, tab-suspension and storage-denied cases. |
| 12 | T-ART-01 folder and ZIP give the same artifact | **done** at unit level (stored/deflated/reordered ZIP and folder → one artifactId); no browser folder-picker test |
| 13 | Gate M: accessibility, RTL, keyboard, independent security review | **partial**: automated axe-core 4.10.2 (WCAG 2.0/2.1 A/AA + best practice) finds 0 violations, light and dark, before and after a site is loaded; every control is reachable by Tab (the export button only once enabled); no horizontal scroll at 320 px. **Open:** manual screen-reader test, RTL layout, independent security review. |
| 14 | Contract records | **ArtifactManifest + artifactId done** (`src/contracts/`, RFC 8785 subset, T-ART-01 test). `PublishPlan` with planId/24 h expiry/catalogDigests **done** (`src/contracts/publish-plan.ts`, manual/disabled modes only). **Open:** ConsentReceipt (only needed for future API writes), a contract-shaped ScanReport, and Diagnostic message keys. |

## Completed

Milestone 1: intake, bounded ZIP reader, paths, inventory/hashes, analysis,
10 adapters, assessment, dry-run plan, export, UI under strict CSP, CI.

Milestone 2 (this update):
- `src/core/paths.ts`: spec-aligned rules, `foldKey`, `compareUtf8`.
- `src/core/zip.ts`: spec caps, `ZipCode` diagnostic codes, name-match, Unicode-path field, strong-encryption bit, archive-level failures.
- `src/core/intake.ts`: `stripRoot` option + `candidateRoot`; codes on issues; folder size-change check.
- `src/core/scan.ts` (new): read-only compatibility and secret scan.
- `src/providers/*`: `serverExecutablePaths`, `spaFallback`, `defaultUrlNested`, `researchId`, claim `source`/`observed`; Cloudflare/Netlify researched-lead facts.
- `src/providers/select.ts`: scan-aware assessment (reserved paths block, routing/nesting/storage/realtime/deps/missing warnings).
- `src/core/exporter.ts`: `app/` + `mirrorkit-control/` handoff (adds `scan.json`, per-destination compatibility notes), `buildPayloadZip`.
- UI: root choice, "Will the copy still work?" panel, app-only ZIP button, limit/evidence lines on provider cards.

## Milestone 9 (research catalogue published + mapped), 2026-10-25

- **Publication:** commit `5f93121` imported, with owner approval, `catalog/`, `v13/hosting-database/` and `v13/guest-host-catalog/` under `docs/research/mirrorkit-v13/`.
  - All 19 originals match the pack's own recorded SHA-256 values (`IMPORT-MANIFEST.json`).
  - One personal-looking operator email was redacted.
  - No secrets or local paths; every "/root/" hit was inside a URL or prose.
  - Specs, reports, reviews, route specs and reference code are still unpublished.
- **Mapper:** `src/research/mapper.ts` plus `scripts/build-research-snapshot.ts` (run with `node --experimental-strip-types`). Only structured fields become typed values: operator country (38/62) and confirmed doc languages (38/62). Everything else stays text or null. `directBrowserPublishVerified` is false for all 62.
- **UI:** collapsible "Research catalogue: 62 dated leads" in step 4. It loads only when opened, filters by text/kind/tier, shows https-only source pins with dates, and links to matching destination cards (now 6 adapters carry `researchId`).
- **Tests:** 11 files, **137 passed**. The snapshot test re-runs the mapper on the published source and requires an exact match. Browser smoke: 62 leads, a Korea filter gives 2, axe reports 0 violations, 0 external requests.
- **Dev dependency:** `@types/node` 22.19.1, used only by that test via a triple-slash reference so browser code cannot use Node globals.

## Milestone 8 (compare a copy), 2026-10-25

- `src/core/compare.ts`: `compareInventories` / `isIdentical`.
- UI section 6: the owner loads a copy (ZIP or folder) they saved from a mirror. It runs in the worker; a wrapped copy is detected by keeping the reading that matches more files. Results show matching, changed, missing and extra files. The wording states that a byte match proves the copy is intact, not that the mirror works, and that hosts may legitimately alter served files.
- Nothing is fetched; the user supplies the files.
- Tests: 10 files, **132 passed**. Browser smoke: a wrapped identical copy showed 2/2 matching; a modified copy showed 1 changed, 1 missing, 1 extra; 0 page errors.

## Milestone 7 (security self-review: scanner ReDoS), 2026-10-25

- **Finding (fixed):** eight scanner patterns were quadratic on hostile text within the 2 MiB per-file cap, each over 15 s and in practice never finishing:
  - unclosed `<style>` or `<script>` blocks;
  - repeated `url(` in CSS;
  - `import` without `from`;
  - `import` followed by whitespace;
  - many unterminated `<a ` tags, or `<base`/`<meta` tags with no `>`.

  The worker kept the UI responsive, but the scan would never finish.
- **Fix:** `<style>`/`<script>` bodies are now found with an `indexOf` scan. Other patterns use bounded quantifiers, exclude `<`/`(` where needed, and no longer overlap.
- **Measured after the fix** (2 MiB inputs, Node 22): every case under 0.6 s, most 15–150 ms.
- **Trade-off:** a literal `<` inside a quoted attribute value hides that tag from the hint scan. Acceptable, because the scan is advisory and declared incomplete.
- **Guard:** `tests/scan-redos.test.ts` runs 13 hostile inputs, 3 s budget each. Total suite: 8 files, **129 passed**.
- **ZIP fuzz:** `tests/zip-fuzz.test.ts` runs 3,000 seeded mutations (seed 20261024): byte flips, extreme field values, truncation and prepended garbage. Every result must parse within limits or throw `ZipError`. Ad hoc, 20 more seeds (60,000 mutations) also found no other exception type. Total suite: 9 files, **130 passed**.
- This is a self-review, **not** the independent security review Gate M requires.

## Milestone 6 (accessibility pass), 2026-10-25

- Fixed the only axe violation (unnamed method `<select>`); the search box now has a visible label.
- Added visible `:focus-visible` outlines; long hashes and paths wrap; wide tables scroll inside their own box.
- How it was checked: axe-core run from a scratch folder (not a repo dependency, MPL-2.0) via Playwright, Tab traversal and 320 px reflow. The scripts are outside the repo; repeat with the same approach.

## Milestone 5 (worker + cancel), 2026-10-25

- `src/core/pipeline.ts` `runAnalysis` (intake, then inventory, then scan, with progress). Folder entries carry explicit paths because cloning a File may drop `webkitRelativePath`.
- `src/ui/analysis-worker.ts`: module worker; buffers are transferred, not copied; errors are reported with a fixed message.
- UI: progress text (`aria-live`), Cancel button, generation counter so stale results are ignored, fallback to the page thread when workers are unavailable. CSP gains `worker-src 'self'`.
- Fixed: the oversized-ZIP message said 256 MiB; it now reads the real limit (128 MiB).
- Tests: 7 files, **116 passed**. Browser smoke (Chromium) results:
  - the folder picker loaded with the root choice offered;
  - a 100 MiB ZIP cancelled mid-read showed "Cancelled" and kept nothing;
  - the full 100 MiB load finished in ~2.7 s;
  - 0 console errors.

## Milestone 4 (intended use + PublishPlan), 2026-10-25

- `src/contracts/intended-use.ts`: IntendedUse, validation, `SENSITIVE_USES`.
- `assess(..., use)`: no rights means blocked; payment/token means blocked everywhere; provider `blockedUses` (GitHub Pages: commercial, payment; researched-lead, official URL) means blocked; an undeclared use is unknown.
- `src/contracts/publish-plan.ts`: contract PublishPlan with these fields:
  - `planId`: sha256 of the canonical plan without planId; `verifyPlanId` checks it.
  - `createdAt`, and `expiresAt` 24 h later.
  - `catalogDigests`: digest of the catalogue snapshot.
  - One TargetPlan per destination: mode manual or disabled; `publicFiles` equal to the manifest list; operations limited to manual-handoff and verify, never a remote mutation; cost unknown; external dependencies from the scan.
- Export: adds `publish-plan.json` (canonical bytes). `plan.json` is renamed `handoff-status.json` (user attestations, not a contract record).
- UI: intended-use fieldset. Export stays disabled until rights and the public-data review are confirmed, and shows why.
- Tests: 6 files, **114 passed**. Browser smoke confirmed:
  - blocked until rights are ticked;
  - gated until the public-data review is ticked;
  - payment blocks every destination;
  - commercial blocks only GitHub Pages;
  - the export carries `publish-plan.json` with netlify:manual and github-pages:disabled;
  - 0 console errors.

## Milestone 3 (contract identity), 2026-10-25

- `src/contracts/canonical.ts`: RFC 8785 JCS for null/bool/safe-int/string/array/plain-object; rejects fractions, NaN, undefined, lone surrogates and class instances.
- `src/contracts/manifest.ts`: `ArtifactManifest {schemaVersion, appId, files, entrypoint}`, `validateManifest`, `artifactId = sha256:` + hash of the canonical bytes, `defaultEntrypoint` (root index.html/htm only, never guesses).
- Analysis and assessment use the selected entry page: no entry page means blocked; an entry other than index.html gives a warning.
- Plan is keyed by `artifactId` (was the file-list checksum). Export adds `mirrorkit-control/artifact-manifest.json` with the exact hashed bytes, and the instructions show the artifactId.
- UI: app id field (validated), entry-page picker, artifactId display. Changing either gives a new id and rebuilds the plan.
- Tests: `npm test` = 5 files, **106 passed**. Browser smoke covered:
  - a site with no index.html is blocked until an entry page is chosen;
  - an invalid app id clears the id;
  - a new app id gives a new id;
  - the export contains `artifact-manifest.json`;
  - 0 console errors.

## Test commands and actual results (milestone 2)

```
rm -rf node_modules && npm ci
npm run typecheck   # pass
npm test            # vitest 5.0.5: 4 files, 97 tests passed
npm run build       # vite 8.3.5: pass
npm audit           # 0 vulnerabilities
```

Browser smoke test (Playwright/Chromium, `vite preview`, script outside the repo):
- Input: a synthetic ZIP inside a wrapper folder containing a CDN script, a root-relative module, history routing, localStorage, `fetch` to an API, a missing image, `_worker.js` and an inline script that tries to set `top.document.title`.
- Results:
  - The root checkbox moved the root to `wrap/`.
  - The compatibility panel listed: history routing, storage, 2 external origins, 1 missing file, `_worker.js`.
  - Cloudflare Pages was **blocked** on `_worker.js`.
  - GitHub Pages was `needs-review`, with warnings that deep links will 404 and root-relative URLs break at `/repo/`.
  - The app-only ZIP contained `_worker.js`, `index.html`, `main.js` at the root.
  - The page title was unchanged, with 0 console errors and 0 non-localhost requests.

Not done: cross-browser, accessibility audit, fuzzing, independent security
review, any provider account/upload (forbidden).

## Next steps (in order)

1. Research follow-ups (data now public): per-record human review to move
   individual research facts into adapter claims (`researched-lead` + pin
   URL); optionally map the 311-row lead register; never parse prose into
   limits automatically.
2. Remaining contract records (gap 14): contract-shaped ScanReport and
   Diagnostic message keys. ConsentReceipt waits for any future API route.
3. Rest of T-ART-06 (60 s soft limit, content-change detection); ZIP64 fixtures if wanted.
4. Gate M items: manual screen-reader check, RTL, independent security review.
5. Done: offline compare (milestone 8). Possible follow-up: also accept a
   handoff ZIP's `mirrorkit-control/artifact-manifest.json` as the reference
   without reloading the original files.

## Deferred / out of scope (do not start without owner approval)

Live provider integrations, OAuth/token handling (BUILD_PLAN Task 6+), any
app-owned backend or credential broker, browser-run Tor/I2P, one-click deploy,
integrating `aws4fetch`/`browser-fs-access` (reference-only).

## Blockers

- None for the current scope. (Research publication was approved 2026-10-25.)

## Unpublished / local-only state

None: every commit is pushed. The research pack was used only in this
session's scratch directory and is not in git. The Playwright smoke scripts
live outside the repo and are not reusable artifacts.

## Session status

Session `01YP9ZPr` is subscribed to PR #1 activity and has a self check-in
scheduled for 12:00 UTC. A new agent taking over should not assume that
watcher exists.

# Replikrazy — restart handoff

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
| 9 | Research catalogue mapper (62 profiles / 311 leads, source pins, MK-POL-006 pinned snapshot digest) | **open**; blocked on the owner approving publication of research data |
| 10 | MK-POL-003/004 | **partial**. Done: IntendedUse declaration, payment/token blocked everywhere, GitHub Pages commercial/payment exclusion (cited), rights and public-data confirmations. **Open** (needs #9): free/trial/paid, country/language/jurisdiction catalogue fields. |
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

1. Owner decision: may research catalogue data (`consolidated-providers.json`,
   hosting database) be published in this public repo? If yes, build the
   MK-POL-006 mapper (pinned snapshot + digest, ids/source pins verbatim,
   unknowns stay unknown) and replace hand-written adapter data; if no, keep
   citing official URLs per claim.
2. Remaining contract records (gap 14): contract-shaped ScanReport and
   Diagnostic message keys. ConsentReceipt waits for any future API route.
3. Rest of T-ART-06 (60 s soft limit, content-change detection); ZIP64 fixtures if wanted.
4. Gate M items: manual screen-reader check, RTL, independent security review.
5. Optional verify mode: user re-selects the published files offline and
   Replikrazy compares against `MANIFEST.txt`.

## Deferred / out of scope (do not start without owner approval)

Live provider integrations, OAuth/token handling (BUILD_PLAN Task 6+), any
app-owned backend or credential broker, browser-run Tor/I2P, one-click deploy,
integrating `aws4fetch`/`browser-fs-access` (reference-only).

## Blockers

- Publication approval for research data (gap 9/10). Asked in PR #1 description and session; no answer yet.

## Unpublished / local-only state

None: every commit is pushed. The research pack was used only in this
session's scratch directory and is not in git. The Playwright smoke scripts
live outside the repo and are not reusable artifacts.

## Session status

Session `01YP9ZPr` is subscribed to PR #1 activity and has a self check-in
scheduled for 12:00 UTC. A new agent taking over should not assume that
watcher exists.

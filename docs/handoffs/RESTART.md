# Replikrazy — restart handoff

_Last updated: 2026-10-25, milestone 1 session (Claude Code cloud session)._

## Ownership

| Scope | Owner | Branch |
| --- | --- | --- |
| Replikrazy milestone 1 (all files in this repo) | this session (single integrator, no sub-workers) | `claude/trusting-goodall-9jdwxu` |
| GhostPay | other existing sessions ("GhostPay integration lead", "Ghostpay feature completion assessment") — **not touched here** | see those repos' handoffs |
| p2p-offramp | other existing session ("p2p-offramp integration lead") — **not touched here** | see that repo's handoffs |

Model routing: this session did all Replikrazy work itself on one model; no
Haiku/Sonnet workers were spawned (the work was small enough to do
sequentially). Do not claim otherwise.

## Starting state found

- Remote repo was **empty** (no commits, no default branch).
- The MirrorKit preparation ZIP / research (`CLAUDE_START_HERE.md`,
  `BUILD_PLAN.md`) was **not attached** to the container (`/mnt/attach`,
  `/mnt/user-data/uploads` empty). Nothing was imported; see
  `docs/research/PROVENANCE.md`.

## Completed (milestone 1)

Implemented + unit-tested (`tests/`, synthetic fixtures generated in-test):

- `src/core/paths.ts` — path validation, case-collision and file/dir conflict detection.
- `src/core/zip.ts` + `crc32.ts` — own central-directory parser; limits, symlink/encrypted/ZIP64/overlap/ratio/CRC checks; fflate used only for raw inflate into a pre-sized buffer.
- `src/core/intake.ts` — ZIP and folder intake, wrapper-folder stripping (recorded), size checks before reading folder files.
- `src/core/inventory.ts` — SHA-256 per file, canonical `MANIFEST.txt` format (`<sha256> <size> <path>\n`, sorted), bundle digest.
- `src/core/analyze.ts` — static-site facts and issues (missing index, secrets, server-side files, hidden files).
- `src/providers/` — modular adapters (10), evidence ladder, catalogue filter, capability assessment (`unknown` ≠ pass).
- `src/core/plan.ts` — dry-run plan + user-attested status transitions.
- `src/core/exporter.ts` — deterministic manual-export ZIP.
- `src/ui/` + `index.html` — vanilla UI, strict CSP, textContent only.
- `.github/workflows/ci.yml` — typecheck, test, build, audit. Read-only permissions, no deploy.

## Test commands and actual results (this session)

```
npm ci
npm run typecheck   # tsc --noEmit: pass
npm test            # vitest 5.0.5: 3 files, 65 tests passed
npm run build       # vite 8.3.5: pass (dist/ ~40 kB JS)
npm audit           # 0 vulnerabilities
```

Browser smoke test (Playwright/Chromium against `vite preview`, script kept
outside the repo): loaded a synthetic ZIP whose `index.html` tries to change
`top.document.title` and `fetch()` an external host → title unchanged, zero
console errors, zero non-localhost requests; selecting Netlify produced
`needs-review`; marking ready and downloading produced a 1994-byte export.

Not done / not claimed: no cross-browser testing, no accessibility audit, no
security audit, no fuzzing, no test with real provider accounts (forbidden in
this milestone anyway).

## Remaining requirements / next steps (in order)

1. **Obtain the MirrorKit research** from the owner. Reconcile each adapter in
   `src/providers/adapters/` against it: raise evidence to `researched-lead`
   only where the research says so; record numeric limits only with a cited
   source (`documented`). Import approved research docs under
   `docs/research/` with original MirrorKit filenames + provenance entries.
2. Align milestone scope with `BUILD_PLAN.md` once available; record any
   divergence here.
3. Add a sandboxed, opt-in preview on a **separate origin** (or keep no
   preview). Never render imported HTML in the app origin.
4. Fuzz `readZip` (random mutations of valid archives) with a time/memory bound.
5. Accessibility pass on the UI; mobile layout check.
6. Licence decision (currently TBD — owner's call).
7. Optional: verify-mode — re-hash a downloaded mirror's files against
   `MANIFEST.txt` (still offline: user supplies the files).

## Deferred / out of scope (do not start without owner approval)

Live provider integrations, OAuth/token handling, any app-owned backend or
credential broker, browser-run Tor/I2P, one-click deployment.

## Blockers

- Research package not available in-session (see above).

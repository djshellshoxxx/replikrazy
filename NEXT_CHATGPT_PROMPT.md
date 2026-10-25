# Next prompt — Replikrazy (formerly MirrorKit)

Resume `djshellshoxxx/replikrazy` on branch `claude/trusting-goodall-9jdwxu`
(draft PR into `main` if one exists; check first). Read
`docs/handoffs/RESTART.md` before doing anything.

**Do NOT redo:** bundle intake, ZIP reader/limits, path validation,
inventory/hashing, analysis, provider catalogue/filter/assessment, dry-run
plan, export ZIP, UI, CI workflow. They exist and 65 tests pass
(`npm ci && npm run typecheck && npm test && npm run build`).

**Do next:**
1. Ask the owner for the MirrorKit research (BUILD_PLAN.md etc.) if it is
   not attached. Never upload the private preparation ZIP to this public repo.
2. Reconcile `src/providers/adapters/*` with that research; keep every
   unconfirmed claim `unreviewed`; never mark browser-direct deploy as
   supported; only add numeric limits with a cited official source.
3. Continue with the ordered list in RESTART.md.

**Rules:** browser-only; no backend, no credential collection, no live
deploys; imported HTML/JS never executes in the app origin; licence stays
TBD; GhostPay and p2p-offramp are owned by other sessions — do not touch
them from here.

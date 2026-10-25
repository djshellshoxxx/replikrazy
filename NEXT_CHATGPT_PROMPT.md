# Next prompt — Replikrazy (formerly MirrorKit)

Resume `djshellshoxxx/replikrazy` on branch `claude/trusting-goodall-9jdwxu`
(draft PR #1 into `main`; last verified head `beffd0d`, CI green, 2026-10-25). Read `docs/handoffs/RESTART.md` and
`docs/research/PROVENANCE.md` first. Check `git log`/`git ls-remote` for the
current head rather than trusting any SHA written here.

**Do NOT redo (done, 106 tests pass):** contract `ArtifactManifest` + RFC 8785
canonical JSON + `artifactId` with app id / entry-page selection (`src/contracts/`), bounded ZIP reader with spec caps,
MK-ART-002 path rules, UTF-8-ordered SHA-256 inventory, explicit root choice,
compatibility/secret scan (`src/core/scan.ts`), 10 provider adapters with
evidence ladder, scan-aware assessment, dry-run plan, `app/` +
`mirrorkit-control/` handoff ZIP and app-only ZIP, UI under strict CSP, CI.
Verify with `npm ci && npm run typecheck && npm test && npm run build`.

**Do NOT regenerate research.** The owner holds the MirrorKit v13 research
pack (unpublished). If you need it and it isn't attached, ask the owner.
Never commit the pack, private review packets or secrets to this public repo.

**Do next:** follow "Next steps" in RESTART.md. First, ask the owner whether
the research catalogue data may be published. Then do the remaining contract records (gap 14: plan id/expiry/consent).

**Rules:** browser-only; no backend, no credential collection, no live
provider writes or deploys; imported HTML/JS never executes in the app origin;
catalogue entries are dated research leads, never "qualified"; Tor/I2P stay
manual self-host checklists; licence stays TBD; GhostPay and p2p-offramp
belong to other sessions — do not touch them from here.

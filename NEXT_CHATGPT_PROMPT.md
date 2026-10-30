> Latest handoff: resume `checkpoint/chatgpt-lean-handoff-20261025` after
> verifying its remote SHA. Read `HANDOFF.md` and
> `docs/handoffs/GITHUB_CHECKPOINT_20261025.md` first. The owner authorized this
> separate GitHub checkpoint; earlier local-only notes below are historical.
> No merge, deployment, release or provider action is authorized by the handoff.

> Local continuation (2026-10-25): start from
> `chatgpt/lean-reliability-20261025`, not Claude's branch. Read the newest
> sections in `docs/handoffs/RESTART.md` and inspect local `git log` first.
> Local checkpoints are unpushed by instruction. No source publication,
> provider writes, merge or deployment is authorized. The older prompt below
> is historical context; its "all pushed" and test-count statements are stale.

# Next prompt — Replikrazy (formerly MirrorKit)

Resume `djshellshoxxx/replikrazy` on branch `claude/trusting-goodall-9jdwxu`
(draft PR #1 into `main`; last verified head `beffd0d`, CI green, 2026-10-25). Read `docs/handoffs/RESTART.md` and
`docs/research/PROVENANCE.md` first. Check `git log`/`git ls-remote` for the
current head rather than trusting any SHA written here.

**Do NOT redo (done, 137 tests pass):** research catalogue publication (`docs/research/mirrorkit-v13/`, owner-approved) and its mapper/snapshot/browser (`src/research/`), offline compare-a-copy (`src/core/compare.ts`), seeded ZIP mutation fuzz, scanner ReDoS hardening + regression guard, worker-based intake/hash/scan with
progress + cancel (`src/core/pipeline.ts`, `src/ui/analysis-worker.ts`), contract `ArtifactManifest` + RFC 8785
canonical JSON + `artifactId` with app id / entry-page selection, intended-use
policy gates and contract `PublishPlan` with planId/expiry (`src/contracts/`), bounded ZIP reader with spec caps,
MK-ART-002 path rules, UTF-8-ordered SHA-256 inventory, explicit root choice,
compatibility/secret scan (`src/core/scan.ts`), 10 provider adapters with
evidence ladder, scan-aware assessment, dry-run plan, `app/` +
`mirrorkit-control/` handoff ZIP and app-only ZIP, UI under strict CSP, CI.
Verify with `npm ci && npm run typecheck && npm test && npm run build`.

**Do NOT regenerate research.** The catalogue part of MirrorKit v13 is
published in `docs/research/mirrorkit-v13/`. The rest of the pack (specs,
reports, reviews, route specs, reference code) is still unpublished: ask the
owner before committing any of it. Never commit secrets or private review packets.

**Do next:** follow "Next steps" in RESTART.md. Automated a11y (axe 0 violations, keyboard, 320 px reflow) is done; remaining Gate M: manual screen reader, RTL, independent security review.

**Rules:** browser-only; no backend, no credential collection, no live
provider writes or deploys; imported HTML/JS never executes in the app origin;
catalogue entries are dated research leads, never "qualified"; Tor/I2P stay
manual self-host checklists; licence stays TBD; GhostPay and p2p-offramp
belong to other sessions — do not touch them from here.

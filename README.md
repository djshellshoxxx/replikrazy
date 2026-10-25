# Replikrazy

Browser-only planner for mirroring a **static website** to several hosting
destinations. You load a site (ZIP or folder); Replikrazy validates it,
inventories every file with SHA-256 hashes, checks it against a provider
catalogue, and produces a **dry-run plan and a manual-export ZIP** with
per-destination instructions. **It never uploads, deploys or contacts any
host, and it never asks for hosting credentials.**

## About the name

Replikrazy was previously called **MirrorKit**. The research and planning
material for this project (including `BUILD_PLAN.md`) was written under that
name; historical filenames and references to "MirrorKit" are kept unchanged
for provenance. See [`docs/research/PROVENANCE.md`](docs/research/PROVENANCE.md).

## Status: milestone 1 (foundation)

| Area | State |
| --- | --- |
| ZIP / folder intake with bounded, validating reader | implemented, unit-tested |
| Path safety (traversal, absolute, drive letters, reserved names, case collisions) | implemented, unit-tested |
| Byte-preserving inventory, SHA-256, canonical manifest + bundle digest | implemented, unit-tested |
| Static-site analysis (missing index, secrets, server-side files) | implemented, unit-tested |
| Provider catalogue, filtering, capability-aware assessment | implemented, unit-tested; **all provider data is `unreviewed`** |
| Dry-run plan with user-attested per-destination status | implemented, unit-tested |
| Manual-export ZIP (site/ + MANIFEST.txt + plan.json + instructions) | implemented, unit-tested, browser smoke-tested |
| Any live deployment / provider API | **not implemented, by design** |

### Evidence levels

Each provider claim carries one of: `unreviewed` (general knowledge, not yet
checked) < `researched-lead` (in the MirrorKit research) < `documented`
(confirmed in current official docs, cited) < `tested` (exercised by this
project). `unsupported` means an action is known not to be possible here.
**No direct-from-browser deployment route is qualified for any provider**, so
every adapter marks it `unsupported`. Unknown limits are reported as
"check provider docs", never as passing.

### Tor / I2P

A browser tab cannot run a persistent onion service or I2P site. Those
entries are self-hosting checklists with prerequisites (a machine you control
running Tor/I2P and a localhost-only web server). Replikrazy does not start,
protect or monitor them.

## Security model

- Imported HTML/JS is treated as opaque bytes: never rendered, framed or
  executed. Names reach the DOM only via `textContent`.
- Strict CSP (`default-src 'none'; connect-src 'none'; frame-src 'none'`):
  the app cannot make network requests.
- ZIP limits: 256 MiB archive, 10 000 entries, 64 MiB per file, 512 MiB total,
  ratio ≤ 200; symlinks, encrypted, ZIP64, overlapping and CRC-mismatched
  entries are refused. Inflation writes into a buffer pre-sized from the
  declared size, so a lying header cannot exhaust memory.
- No backend, no credential broker, no daemon, no telemetry.

## Develop

```sh
npm ci
npm test          # vitest, synthetic fixtures only
npm run typecheck
npm run build     # static output in dist/
npm run dev       # note: CSP blocks Vite's HMR socket; reload manually
```

Dependencies: [`fflate`](https://github.com/101arrowz/fflate) (MIT) at
runtime; TypeScript, Vite, Vitest for development.

## Licence

TBD — no licence has been selected yet. Until one is, all rights are
reserved by the repository owner.

## Handoff

Current state, next steps and exact commands: [`docs/handoffs/RESTART.md`](docs/handoffs/RESTART.md)
and [`NEXT_CHATGPT_PROMPT.md`](NEXT_CHATGPT_PROMPT.md).

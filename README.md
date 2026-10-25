# Replikrazy

Browser-only planner for mirroring a **static website** to several hosting
destinations. You load a site (ZIP or folder); Replikrazy validates it,
inventories every file with SHA-256 hashes, checks it against a provider
catalogue, and produces a **dry-run plan and a manual-export ZIP** with
per-destination instructions. **It never uploads, deploys or contacts any
host, and it never asks for hosting credentials.**

## About the name

The work began under the historical working name **MirrorKit**; that name
in older notes records provenance, not a separate active repository. The
research and planning material (including `BUILD_PLAN.md`) was written under
that name, and historical filenames and references are kept unchanged. The
research **catalogue data** (provider profiles, lead register, hosting
database, guest-host catalogue) is published in
[`docs/research/mirrorkit-v13/`](docs/research/mirrorkit-v13/README.md) as
dated research leads, not qualified providers. See
[`docs/research/PROVENANCE.md`](docs/research/PROVENANCE.md).

## Status: milestone 2 (compatibility scan + intake hardening)

This branch adds the first application implementation on top of the
research-only landing page on `main`. No provider qualification, live
deployment or production readiness is claimed.

| Area | State |
| --- | --- |
| ZIP / folder intake with bounded, validating reader; runs in a Web Worker with progress and cancel | implemented, unit-tested, browser smoke-tested |
| Path safety (traversal, absolute, drive letters, reserved names, case collisions) | implemented, unit-tested |
| Byte-preserving inventory, SHA-256, file-list checksum | implemented, unit-tested |
| Contract `ArtifactManifest` (owner app id + entry page), RFC 8785 canonical JSON, `artifactId` (folder and ZIP give the same id) | implemented, unit-tested, browser smoke-tested |
| Static-site analysis (missing index, secrets, server-side files) | implemented, unit-tested |
| Functional-compatibility scan: missing assets, external origins, root/relative paths, `<base>`, history/hash routing, service worker, browser storage, realtime backends, WASM, source maps, provider-reserved server paths, content secret patterns | implemented, unit-tested, browser smoke-tested; heuristic and explicitly incomplete |
| Research catalogue browser: 62 MirrorKit v13 profiles mapped (ids/source pins verbatim, prose kept as text, gaps null) into a pinned snapshot with source SHA-256; lazy-loaded, read-only, enables nothing | implemented, unit-tested (snapshot regenerates exactly), browser smoke-tested |
| Provider catalogue, filtering, capability-aware assessment | implemented, unit-tested; Cloudflare/Netlify carry dated `researched-lead` claims with official URLs, the rest are `unreviewed` |
| Dry-run plan with user-attested per-destination status | implemented, unit-tested |
| Intended-use declaration + policy gates (rights, public-data review, payment/token blocked everywhere, GitHub Pages commercial exclusion with cited source); contract `PublishPlan` with `planId`, 24 h expiry, manual-only non-mutating operations | implemented, unit-tested, browser smoke-tested |
| Handoff ZIP (`app/` + `mirrorkit-control/` incl. `artifact-manifest.json`) and app-only payload ZIP | implemented, unit-tested, browser smoke-tested |
| Offline "compare a copy": owner-supplied mirror files vs the artifact (matching / changed / missing / extra) | implemented, unit-tested, browser smoke-tested; a byte match is not proof the mirror works |
| Any live deployment / provider API | **not implemented, by design** |

### Evidence levels

Catalogue entries are dated research leads, not qualified providers. Each provider claim carries one of: `unreviewed` (general knowledge, not yet
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
- Strict CSP (`default-src 'none'; connect-src 'none'; frame-src 'none'`;
  `worker-src 'self'` for the app's own analysis worker): the app cannot make
  network requests.
- ZIP limits follow research spec MK-ART-003: 128 MiB archive, 10 000 files,
  100 000 directory entries, 32 MiB per file, 256 MiB total, 8 MiB metadata,
  ratio ≤ 1000:1 above 1 MiB. Symlinks, special entries, encryption, ZIP64,
  split archives, Unicode-path overrides and local/central name mismatches are
  refused; CRC/size mismatch, overlap and limit breaches reject the whole
  archive. Inflation writes into a buffer pre-sized from the declared size, so
  a lying header cannot exhaust memory. CRC32 detects corruption only.
- Path rules follow MK-ART-002 (UTF-8 byte limits, bidi/control/`#%?:` and
  reserved-name rejection, NFC + case-fold collision checks).
- No backend, no credential broker, no daemon, no telemetry.

## Develop

```sh
npm ci
npm test          # vitest, synthetic fixtures only
npm run typecheck
npm run build     # static output in dist/
npm run dev       # note: CSP blocks Vite's HMR socket; reload manually
# after changing docs/research/mirrorkit-v13/catalog/consolidated-providers.json:
node --experimental-strip-types scripts/build-research-snapshot.ts
```

Dependencies: [`fflate`](https://github.com/101arrowz/fflate) (MIT) at
runtime; TypeScript, Vite, Vitest for development.

## Licence

No software license or rights grant is made. Code and artwork reuse rights
remain TBD and require separate review.

## Handoff

Current state, next steps and exact commands: [`docs/handoffs/RESTART.md`](docs/handoffs/RESTART.md)
and [`NEXT_CHATGPT_PROMPT.md`](NEXT_CHATGPT_PROMPT.md).

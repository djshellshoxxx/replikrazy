# Research provenance

- Project formerly named **MirrorKit**; renamed **Replikrazy**.
- The owner supplied the MirrorKit research checkpoint **v13 (2026-10-25)**
  privately to the working session. Its own manifests mark it "local staging,
  not yet published". It is **not** committed to this public repository and
  must not be, until the owner approves publication (the owner's review branch
  is `docs/research-intake-20261025`; agents read it but do not push to it).
- What this repository takes from it, and how:
  - **Requirement IDs** (e.g. `MK-ART-002`, `MK-ART-003`, `MK-POL-002`,
    `T-ART-10`) are cited in code comments and tests so behaviour can be traced
    back to the spec. No spec text is copied.
  - **Diagnostic codes** (`MK_ZIP_BOMB`, `MK_PATH_INVALID`, …) reuse the
    contract's names.
  - **Provider facts** in `src/providers/adapters/cloudflare-pages.ts` and
    `netlify.ts`: individual limits/workflow facts are stated as
    `researched-lead` claims with the **official provider documentation URL**
    and the date the research read it (2026-10-25). They are not re-verified
    by this project and no provider was contacted.
  - The export's `mirrorkit-control/` folder name follows spec MK-ART-006.
  - Research catalogue record ids are kept verbatim in `researchId`
    (`cloudflare_pages`, `netlify`, `github_pages`).
- Not used: the 62-profile / 311-lead catalogue data, the hosting database,
  route specs, regional research, and the licensed reference copies
  (`aws4fetch`, MIT; `browser-fs-access`, Apache-2.0). Those copies are
  reference-only and are not integrated or tested here.
- Import rule (repo is public): only research/specification text the owner
  approves after privacy, provenance and licence checks. Never import the
  private checkpoint ZIP itself, private review packets or secrets. Keep
  historical MirrorKit filenames unchanged; add an index entry below for each
  imported file (original path, date, approval).

## Imported files

_None._

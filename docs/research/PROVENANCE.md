# Research provenance

- Project formerly named **MirrorKit**; renamed **Replikrazy**.
- The owner supplied the MirrorKit research checkpoint **v13 (2026-10-25)**
  privately to the working session. On 2026-10-25 the owner approved
  publishing its **catalogue data**; that subset is in
  [`mirrorkit-v13/`](mirrorkit-v13/README.md) (see "Imported files"). The rest
  of the pack (specs, reports, reviews, route specs, regional research,
  reference code copies, nested checkpoint archive) is still unpublished and
  must not be committed without separate approval.
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
- Not imported: route specs, regional research, specs/reports, and the
  licensed reference copies (`aws4fetch`, MIT; `browser-fs-access`,
  Apache-2.0). Those copies are reference-only and are not integrated or
  tested here.
- Import rule (repo is public): only research/specification text the owner
  approves after privacy, provenance and licence checks. Never import the
  private checkpoint ZIP itself, private review packets or secrets. Keep
  historical MirrorKit filenames unchanged; add an index entry below for each
  imported file (original path, date, approval).

## Imported files

| Path in repo | Original path in pack | Date | Approval | Changes |
| --- | --- | --- | --- | --- |
| `docs/research/mirrorkit-v13/catalog/*` (8 files) | `mirrorkit-research/catalog/*` | 2026-10-25 | owner, in session | none |
| `docs/research/mirrorkit-v13/v13/hosting-database/**` (7 files) | `mirrorkit-research/v13/hosting-database/**` | 2026-10-25 | owner, in session | none |
| `docs/research/mirrorkit-v13/v13/guest-host-catalog/*` (4 files) | `mirrorkit-research/v13/guest-host-catalog/*` | 2026-10-25 | owner, in session | one personal-looking contact email replaced with a placeholder in `guest-hosts.json` and `guest-hosts.csv` |

Per-file hashes and the pack-manifest check: `mirrorkit-v13/IMPORT-MANIFEST.json`.
App use: `src/research/catalogue-snapshot.json` is generated from
`catalog/consolidated-providers.json` by `src/research/mapper.ts` and records
that file's SHA-256.
Pre-publication checks: secret/token patterns (none), local filesystem paths
(none outside URLs), emails (provider business contacts kept; one personal-looking address redacted),
internal workflow notes (only methodology notes about research search tools, kept).

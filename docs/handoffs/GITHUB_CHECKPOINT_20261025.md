# GitHub checkpoint — 2026-10-25

## Ownership, baseline and intended action

The owner explicitly requested GitHub checkpointing and handoff readiness.
Integrator: this ChatGPT continuation; a separate read-only reviewer examined
narrow changed boundaries. No overlapping writers or work in other repositories.

Pre-publication refs recorded before any merge consideration:

| Ref | SHA |
| --- | --- |
| Tested local source | `2d97388badea11361b76c178b165f1604f102a67` |
| Claude developed branch / PR #1 source | `3233bb4a88fb254ba16ffc32c6e157aeb85750f5` |
| main / PR #1 target | `b6b763eb51aa526624250e78254d98095f9dd808` |

Intended action: add documentation and publish a **new** branch
`checkpoint/chatgpt-lean-handoff-20261025`, with an ordinary non-force push.
Existing `chatgpt/lean-reliability-20261025` remains a local recovery ref at the
tested source. No overwrite of Claude's branch, PR edits, merge, tag or release.
The exact documentation-inclusive checkpoint SHA is the branch tip; verify it
with `git ls-remote origin refs/heads/checkpoint/chatgpt-lean-handoff-20261025`.
Publication is confirmed by the executor's final report, not assumed by this note.

**Merge decision: leave unmerged.** PR #1 is open and draft, with no submitted
reviews or review threads at inspection. Its mergeable flag is not approval.
Focused security reviews do not cover the whole application; outstanding
accessibility/conformance gates remain. No merge command was attempted.
Any later merge proposal must record fresh source/target SHAs and repeat relevant
ownership/review checks rather than relying on these historical values.

## Completed continuation

- Isolated intake/comparison workers; cancellation, 60-second wall-clock budget,
  late-message rejection and stale identity/export invalidation.
- Global rights/public-data/payment/token gates enforced on both ZIP actions;
  untrusted saved status validation and safe restoration.
- Exact payload preservation for prototype-related filenames; invalid-reference
  comparison rejected; same-size changes carry expected/actual hashes.
- Pinned repeated-read content snapshots, folder/ZIP identity parity, explicit
  comparison cancellation, RTL layout and reproducible browser regressions.
- Canonical contract ScanReport, shared Diagnostic/MKError/Result boundaries,
  complete counts before truncation and safe summaries; no MIME-certification claim.
- ZIP directory/path/type/encryption validation, local/central consistency,
  bounded sentinel inflation, exact central count/size, per-entry disk refusal,
  signed/unsigned streaming descriptor checks and overlap coverage.

Current rationale: preserve tested work and evidence for owner/reviewer handoff,
not start a new feature or provider integration batch.

## Actual verification and original failures

Reused final application validation at the tested source; the remaining changes
are documentation only. No redundant full-suite rerun is claimed.

| Check | Actual result |
| --- | --- |
| `npm run typecheck` | pass |
| `npm test` | 13 files, 176 passed |
| `npm run build` | pass |
| Chromium regression runner | 35 checks, zero page errors/external requests |
| axe / reflow | 16 scans / 16 checks, zero violations |
| keyboard traversal | 156 visible controls across four runs |
| `npm audit --audit-level=moderate` | zero vulnerabilities at checkpoint preparation |
| diff whitespace check | pass |
| outgoing history scan | 6 source commits, 33 paths, 61 unique text versions; no credential/private-source matches |
| independent final ZIP verification | 58 focused tests pass; reproduced findings fixed |

Original failures and exact fixtures remain documented in `docs/reviews/`:
export gate bypasses, saved-state null crash, prototype filename loss, hidden
secret blockers after saturation, invalid comparison references, overlong URL
boundary mismatch, ignored ZIP directory/header fields, prefix-CRC truncation,
understated central counts and conflicting descriptors/disks. No fixture oracle,
limit, ReDoS budget or fuzz seed was weakened. Focused review is not a full audit.

## Workflow side effects

Inspected `.github/workflows/ci.yml` before push. It runs on all branch pushes
and PRs with `contents: read`: checkout, Node 22 setup, npm ci, typecheck, tests,
build and dependency audit. No deployment, release, upload-artifact or remote
provider write step. Package scripts were inspected; no application install
lifecycle hook. The push may start this ordinary validation workflow; no manual
workflow dispatch or paid action is requested. Local checks used Node 24.19.0,
npm 11.9.0 and Chromium 154.0.8037.57; hosted Node 22 remains a separate result.

## Remaining work and exact inputs

Use `docs/reviews/2026-10-25-zip-boundary.md` for code ranges and scoped next steps.
Open: pinned full Unicode case fold; preflight/root/entrypoint ordering; broader
Result/record/version boundaries; broader private-data detection; manual screen
reader; cross-browser; real suspension tests. Preserve the stricter wall-clock
stop and fail-closed truncation unless explicitly approved otherwise.

For detector expansion, request source-pinned `09_ACCEPTANCE.md` T-ART-08 and
referenced synthetic fixtures. For policy expansion, request the relevant
MK-POL sections of `03_POLICY_AND_TARGETS.md`. Do not infer absent contracts.

The supported Library transfer attempt plus one permitted retry both failed
with `library file transfer failed: download failed`; no executor archive bytes
were recovered. The parent later supplied only 01_CONTRACTS and 02_ARTIFACTS as
private task-message text. Their source hashes/provenance are in the contract
review note; full text is not tracked. Further materialization attempts stopped.
Firefox acquisition received HTTP 403 `Domain forbidden`; do not retry or use
alternate download domains. WebKit was not reached. No cross-browser pass claim.

## Recovery and exclusions

Existing local source checkpoint:
- Archive: `replikrazy-2d97388.zip` (103,494 bytes).
- SHA-256: `7ee3da62b44c5b76ea2a6c0a27121c4e7765457be690cefc61308ecc3dd98882`.
- Incremental bundle prerequisite: `3233bb4a88fb254ba16ffc32c6e157aeb85750f5`.
- Restores six continuation commits through `2d97388badea11361b76c178b165f1604f102a67`.
- Fresh prerequisite-only local restore and diff equality were verified.
- Contains bundle/diff, result manifest, checksums and recovery instructions;
  it predates this documentation-only checkpoint commit.

Recover from the verified remote checkpoint branch when available. Otherwise
verify the local archive checksum, follow RESTORE.md in an isolated clone with
the exact prerequisite, and preserve all other refs. Never force-push/reset an
owner branch to recover this work.

Excluded from outgoing commits: private full-source research/archive, Library
transfer metadata and signed URLs, credentials, node_modules, build output,
browser/runtime binaries. Already-published catalogue data is inherited from
Claude's baseline and was not expanded. No backend, credential broker, OAuth,
provider upload/account, paid action, deployment, release or new licence grant.

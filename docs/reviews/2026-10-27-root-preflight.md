# Explicit root preflight — 2026-10-27

Base: d1f2a58a7de41ce4fa54fff22e834d0d8762f332. Local continuation only.

The selected safe wrapper is now established from all available input names,
including rejected siblings and explicit ZIP directories, before validating
payload path length/depth. Invalid wrappers remain rejected. Original payload
names/bytes are unchanged except the explicitly requested common prefix removal.
A mixed input cannot become a single-root input merely by dropping a bad sibling.
The browser keeps the root chooser available when every unrooted file is invalid.

ZIP directory portability checks use the same selected root. The parser still
checks directory types, flags, encryption, headers, sizes, CRC and overlap. Its
default standalone behavior and result shape remain compatible; only intake
requests directory metadata and must validate it before use. Empty directories
are never added to the hashed payload inventory.

Original failures retained outside git:
- /workspace/checkpoints/root-preflight-original-failure.log
- /workspace/checkpoints/root-directory-original-failure.log

Evidence: 359 unit tests / 27 files, typecheck/build, 45 Chromium checks with zero
page errors/external requests. Disjoint read-only review reproduced the explicit
ZIP-directory gap; fixed and reviewed with 53 focused root/ZIP/fuzz tests. This is
focused boundary evidence, not a whole-app audit. Previous recovery browser and
keyboard results are historical unchanged-surface evidence, not rerun here.

## Exact remaining ordering work

This checkpoint completes explicit root-relative path validation, not the whole
MK-ART-001 pre-hash ordering requirement. core/pipeline.ts still hashes/scans the
intake result before the UI chooses a nondefault entrypoint and after other intake
errors. Next change needs a separate bounded preflight outcome (names, sizes,
root choice and issues; no invented hashes) in pipeline.ts, analysis-task.ts and
analysis-result.ts, handled by main.ts before final analysis. Preserve workers,
60-second limits, cancellation/generation invalidation, and existing sourceDigest
pinning once a valid byte snapshot exists. Missing/invalid entrypoints must never
be disguised as empty successful artifacts. Compare-copy flow shares the worker
and needs explicit final-result admission. No extra owner authority is needed.

## Payload-backed recovery assessment

Existing supplied MK-CTR-003 and MK-ART-006 adequately define byte matching: exact
manifest path set, size and per-file SHA-256, appId/entrypoint and canonical
artifactId. This is ready technical work, not a missing private-spec gate.

The current recovery worker deliberately returns counts only, then terminates.
Therefore restoration is not implemented by recognizing that summary. A bounded
follow-on worker operation should revalidate the selected immutable recovery Blob,
select one validated ArtifactHandle, and compare an actual locally selected
ZIP/folder payload with that manifest. Reject missing/extra/changed paths/bytes,
invalid intake, unsupported records and stale/cancelled selection. Use explicit
visible root selection, never heuristic stripping of app/ or control files.

After exact matching, an explicit local action may establish the active artifact
using newly scanned local bytes and the matched appId/entrypoint. Recompute policy
and require fresh public-data review. Do not restore imported consent, publishing
state, saved statuses, provider authority or signature trust. Retain original
recovery bytes and keep unsupported records read-only. Payload absence cannot be
solved from metadata. No implementation claim for this follow-on step.

Existing gates unchanged: missing 09_ACCEPTANCE/T-ART-08 fixtures, denied browser
downloads, manual screen-reader and whole-app audit qualification. No publication,
provider activity, credentials or deployment performed.

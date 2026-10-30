# Read-size boundary continuation — 2026-10-27

Fresh remote/PR inspection confirmed checkpoint e437a4880e9dde9867c7ebac85d48de9bc5a42ab,
Claude/PR1 3233bb4a88fb254ba16ffc32c6e157aeb85750f5 and main
b6b763eb51aa526624250e78254d98095f9dd808. PR1 remains draft/open/unreviewed.
Local continuation branch: chatgpt/intake-read-bounds-20261027. No remote writes.

Scope remains offline browser intake/scan/comparison/manual export. This slice
implements existing MK-ART-006 before/after size checking and preflights the
folder aggregate size before any read. Folder sizes must be nonnegative safe
integers; captured size/path must still match before and after reading. ZIP
metadata must be bounded and actual bytes plus post-read metadata must match
its captured size before parsing. The analysis folder adapter preserves the
live size check. Existing oversized individual files remain excluded with an
error, blocking export; no policy or limit was relaxed.

Original regression run: 8 failed / 1 passed of 9 cases, retained outside git in
/workspace/checkpoints/intake-read-bounds-original-failures.log. Added adapter
regression after inspection. Final: 186 tests / 14 files passed; npm run build
passed (includes tsc --noEmit); git diff --check passed. No fixture thresholds
changed. No new browser pass: the prior /tmp browser tooling is absent, although
Chromium exists. Historical Chromium evidence belongs to the prior checkpoint.
No browser-download denial was retried. A read-only scan review packet is ready
for the existing paid-call broker; not yet delivered or reviewed.

Limits: ordinary Blob/File snapshots are immutable. These checks establish
agreement with declared read metadata, not continuous filesystem monitoring.
An arbitrary custom arrayBuffer implementation can allocate before returning;
the engine cannot prevent that allocation. Browser workers retain cancellation
and wall-clock bounds. Same-size rereads still use the existing source digest.

Remaining inputs: source-pinned 09_ACCEPTANCE.md T-ART-08 and its referenced
synthetic fixtures for private-data detector expansion. Full Unicode folding,
root/entrypoint preflight ordering, broader contract import boundaries, manual
screen-reader and cross-browser gates remain separate. No new master plan or
worldwide provider research; no whole-app audit or live publishing claim.

## Subsequent path admission slice

`validatePath` now rejects lone UTF-16 surrogates before TextEncoder can replace
them with U+FFFD. Valid surrogate pairs (astral Unicode names) remain accepted.
This closes an exact-name admission gap under MK-CTR-008 / MK-ART-002, not the
separate full Unicode case-folding gap. Three new rejection regressions failed
before the fix; the accepted astral-name case passed. Original output remains
outside git at /workspace/checkpoints/path-surrogate-original-failures.log.

Final source checks: 190 tests / 14 files, typecheck and production build pass.
Recovered existing Playwright core 1.57.0 from the installed runtime (no download)
and ran the unchanged regression script with installed Chromium: 35 checks,
zero page errors and external requests, both at the preceding read-boundary
commit and after this path change. No new axe/screen-reader/cross-browser pass.

Private scanner review packet saved and native text readability verified. It
pins all source sections at 43382e675b9d6f5196197a74bc5debe1176fbcc7 and includes
caller deltas from e437a488. The subsequent path fix does not change scanner
code or its reference parsing; review remains read-only/disjoint. Library
identity and section manifest remain in the private checkpoint receipt outside
git. Parent relays to the sole paid-call broker; this executor made no paid call.

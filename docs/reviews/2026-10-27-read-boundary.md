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

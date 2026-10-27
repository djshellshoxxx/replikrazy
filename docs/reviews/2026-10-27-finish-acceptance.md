# Essential finish acceptance — 2026-10-27

Base 2a3455224f6ed6206d4c6ae6d734e14ca334372c. Selected existing unfinished
acceptance work, not provider features or new research.

## Recovery keyboard usability

New installed-Chromium keyboard matrix covers light/dark and LTR/RTL, idle and
pending recovery, disclosure opened by Enter, visible-control Tab reachability,
visible focus, and 320/960px reflow. It reproduced lost focus when Cancel became
hidden. The panel now returns focus to the file chooser only if that disappearing
Cancel button held focus; background completion never steals unrelated focus.
Original failure: /workspace/checkpoints/recovery-keyboard-original-failure.log.
Final: 52 recovery controls reached, 16 reflow checks, four cancellation-focus
checks. This is not axe or manual screen-reader evidence.

## Pinned full Unicode folding

The retained finish checklist identified the browser-dependent upper/lower
approximation. Concrete missed collision: capital sharp-S (U+1E9E) versus ss,
including file/directory prefixes. Original failed fixture preserved in
/workspace/checkpoints/unicode-fold-original-failure.log.

Generated 1,530 default full case-fold mappings offline from installed CPython's
Unicode 15.0.0 data. scripts/build-casefold.py refuses other Unicode versions;
no download/dependency added. Data SHA256:
7c661514294ae0eed82b9c0f941c7d7cf29144bc01510dcb43e15fb3f84df0ea.
The runtime exports CASE_FOLD_UNICODE_VERSION. Accepted filenames/content remain
unchanged; folding is a collision key only. Manifest identity bytes do not gain
metadata. Existing more-conservative upper/lower portability collisions remain
an additional guard, never a replacement for pinned folding. Thus this fix does
not silently admit filenames the previous stricter guard rejected. Tests cover
sharp-S, Greek sigma, ligatures, dotted I, Cherokee and that retained guard.
Browser acceptance verifies both export routes stay blocked for the missed pair.

## Current finish checklist

Completed locally: bounded ZIP/folder intake, strict ZIP safety, cancellation and
stale-result guards, exact byte hashing/manifests and repeated-read evidence,
full pinned case-fold admission, heuristic scan with fail-closed truncation,
manual-only provider labels, rights/public-data/use gates, manual exports,
offline comparison, source-preserving read-only recovery inspection and explicit
local profile, recovery keyboard focus/reflow. Existing catalogue reused.

Update: explicit root-relative path validation is complete in the
[root preflight checkpoint](2026-10-27-root-preflight.md).
Open implementation: entrypoint preflight still follows the earlier hash-first flow; it is not claimed fully conformant to the
proposed ordering. Full recovery payload matching/restoration is not implemented;
metadata cannot manufacture absent bytes. These are technical work, not fresh
owner-approval requirements. No need to invent optional features to hide them.

Open acceptance/input: manual screen reader, latest full axe rerun (tooling absent),
cross-browser (download denial binding), real suspended-tab/OS tests, whole-app
independent audit. Broad detector expansion requires source-pinned T-ART-08 and
referenced synthetic fixtures; missing bytes remain missing. Current inspections
never establish general secret absence, publisher trust or signature validity.

Out of scope: live provider execution, accounts/credentials, purchases, hosting,
public publication/deployment. No new authority follows from local metadata.

Final relevant checks: 343 unit tests / 26 files, typecheck/build and diff check
pass; Chromium 42 existing+Unicode checks, 25 recovery checks, keyboard matrix
above; zero page errors/external requests. Local preview remains at
127.0.0.1:4173, no public exposure. Original thresholds/fixtures retained.

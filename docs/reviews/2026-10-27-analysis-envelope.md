# Analysis lifecycle envelope — 2026-10-27

Disjoint lifecycle slice; scanner remains reserved for the paid-call broker.
No changes to paths, manifests, detector policy, intake limits or provider gates.

Eight original failures reproduced in nine added cases: null messages threw;
malformed progress reached callbacks; missing done results became success;
throwing UI progress callbacks escaped without settlement; a backward wall-clock
change admitted a late completion when the timer had not run. Original log is
/workspace/checkpoints/analysis-envelope-original-failures.log outside git.
One malformed-array case already passed and remains as a positive regression.

AnalysisTask now uses both the existing wall-clock deadline and performance.now
monotonic deadline. Either expiring rejects the message; existing timer still
terminates at 60 seconds. This addresses wall-clock rollback while retaining
wall-clock suspension coverage, without changing the stricter current budget.
No claim that fake clocks reproduce a real suspended browser/OS session.

Plain-object message envelopes, known progress stages and safe nonnegative
integer counters with done <= total are required. Malformed envelopes and
callback failures settle with fixed MK_INTERNAL, terminate once and ignore
queued results. Raw exception details are not forwarded. Successful internal
results receive only a shallow envelope check; full AnalysisResult schema and
public recovery/import version handling are not implemented by this slice.

Final checks after code changes: 208 tests / 15 files; npm run build includes
successful tsc --noEmit; production build; git diff --check. Existing installed
Playwright/Chromium: 35 checks, zero page errors/external requests. No downloads,
provider access, paid calls, GitHub writes or new audit/accessibility claims.

Next independent work must keep broker scanner ownership and avoid treating
unknown record versions as current schema. Missing 09_ACCEPTANCE.md/T-ART-08
still gates broad detector acceptance; it did not block this lifecycle fix.

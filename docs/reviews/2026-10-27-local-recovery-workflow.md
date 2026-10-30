# Entrypoint preflight and payload-backed local recovery — 2026-10-27

Base 99d0b6894f39e0d4efafe06f82402cc9d3ed90c8. Local-only continuation.

## Working workflow

Step 1 now requests an explicit bounded preflight outcome before analysis when
intake has errors or has no valid selected/default HTML entrypoint. The UI lists
names/sizes as not hashed and permits root/entrypoint selection. No invented
hashes, scan findings or artifact identities fill this intermediate state. A
valid choice reruns bounded intake then hashes/scans; established source pins
survive root/entrypoint choices. Workers still own work, cancellation and the
60-second budget; generation checks prevent superseded results from applying.
Low-level inventory comparison retains its existing non-HTML inventory behavior;
it does not prepare an artifact for export. Analysis overloads distinguish these
final-only calls from potentially preflight outcomes.

Step 7 supports an explicit local restore action:
1. Select actual site files via step 1; choose root and entrypoint and resolve
   intake/scan errors. No fetching or reconstruction from metadata occurs.
2. Select recovery JSON; optionally select its explicitly declared local profile.
3. Choose the 1-based artifact number and click the matching/restore button.
4. The bounded recovery worker revalidates the original recovery Blob, validates
   that ArtifactHandle, rehashes/rescans the selected immutable local payload,
   and binds exact paths, sizes and SHA-256 values plus appId/entrypoint through
   the canonical manifest digest. Missing/extra/renamed/changed files reject.
5. The UI rebinds the result against its active inventory and checks recovery,
   intake and identity generations before applying. It checks again after the
   final identity refresh to avoid a superseded success message.
6. Only artifact identity is restored over matching actual local bytes. Public
   review resets; export requires fresh normal gates. Imported plans, consent,
   status, provider authority, signatures and publisher trust are never applied.

Unknown/unsupported/malformed sources remain available byte-for-byte for original
export. Source records are not rewritten. Failed matching leaves active identity
and source records unchanged. No remote execution, localStorage import or new
credentials. Actual matching is not a claim about remote files or authenticity.

## Evidence and retained failures

368 unit tests / 29 files passed; typecheck/build and diff check passed. Installed
Chromium: 46 main regression checks, 13 payload-recovery checks, 25 recovery
inspection checks; keyboard matrix 68 controls, 16 reflow checks and four
cancel-focus checks. Zero browser page errors/external requests. No thresholds
were weakened. Browser checks use the existing installed harness, no downloads.

Originals retained outside git in /workspace/checkpoints:
- entrypoint-original-failure.log (initial fixture parameterization mistake)
- entrypoint-corrected-original-failure.log (correct fixture run against base)
- recovery-payload-original-failure.log (missing binding implementation)
- recovery-stale-success-original.log and recovery-stale-success.mjs

Read-only review found an overly broad final-result overload (fixed) and a
reproduced stale success message during the final UI digest (fixed, incorporated
in browser-recovery-payload.mjs). Independent fixed probe records staleSuccess:
false. Focused review is not a whole-app security audit. Initial payload browser
setup also needed to select a provider before accessing its hidden public-review
control; corrected without changing application gates.

Reproduce from the repo with existing installed tools and local preview :4173:

```sh
npm test
npm run build
BROWSER_TEST_TOOLS=/opt/codex/cua_node/lib node scripts/browser-regressions.mjs
BROWSER_TEST_TOOLS=/opt/codex/cua_node/lib node scripts/browser-recovery-payload.mjs
BROWSER_TEST_TOOLS=/opt/codex/cua_node/lib node scripts/browser-recovery.mjs
BROWSER_TEST_TOOLS=/opt/codex/cua_node/lib node scripts/browser-recovery-keyboard.mjs
```

## Remaining limits

The requested local root/entrypoint and payload-binding workflows now work.
General recovery of provider operations and imported consent is not implemented
or authorized by this local feature. Missing 09_ACCEPTANCE.md/T-ART-08 synthetic
fixtures still limit broader detector acceptance. Denied cross-browser downloads
remain stopped; manual screen reader, OS suspension and whole-app audit remain
unexecuted qualification work. No new private pack bytes were recovered. No
source push, public publication, provider mutation or deployment occurred.

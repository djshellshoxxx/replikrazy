# User-facing local recovery inspection — 2026-10-27

Base 295393d1795fbacc88e488374721df1082dec5a9. Reconciled existing finish
criteria: the lean intake/inventory/manual-export/comparison workflow already
works; the newly built read-only recovery validators had no user-facing entry.
This slice connects them to optional step 7 rather than adding more validators.

Choose recovery JSON (10 MiB maximum), inspect locally in a dedicated worker,
optionally select the explicit local verification profile, cancel, clear the
preview, or save the original immutable File bytes. Only counts and fixed safe
messages cross into UI output. No source snippets, markup, private values or
owner-supplied labels are rendered. Unknown/private/corrupt/oversized files
remain available for byte-exact original download without applying them.
Fatal UTF-8 decoding rejects invalid encoding; a BOM is not silently stripped.

Inspection is worker-only with independent cancellation, supersession, 60-second
wall/monotonic limits and safe message/error handling. Profile changes cancel
the previous job; generation checks reject late UI updates. Clearing releases
current preview references and resets profile opt-in. No localStorage, consent,
active artifact, provider selection or plan writes occur. Raw file content never
executes, renders as HTML, navigates, or triggers fetch. Existing CSP unchanged.

RecoveryRecord is metadata, not the app payload byte store. The panel explains
this and links to existing ZIP/folder intake for actual files. Non-executing
local UI work needed no additional owner permission. Full active-artifact
restoration requires corresponding payload bytes and identity matching; this
is a technical dependency, not a newly invented approval gate. No provider,
publication or deployment authority follows from recognized metadata.

Evidence: initial browser test failed because the panel did not exist;
/workspace/checkpoints/recovery-ui-original-failure.log preserved. The first
implemented UI run hit a test-harness error attempting to check an option in a
closed details disclosure; fixed the test to open it as a user would, not force
click. Added eight worker lifecycle/resource tests. Final source: 341 unit tests
/ 26 files passed; typecheck/build and diff check pass. Chromium: 39 existing
checks plus 25 recovery checks, zero page errors/external requests. Recovery
checks cover recognized/unsupported/duplicate/private records, explicit opt-in,
exact text and invalid-UTF-8 byte downloads, oversized refusal, clear, 320px
LTR/RTL reflow and unchanged active artifact/localStorage. New panel has no new
axe/manual-screen-reader or cross-browser claim.

Preview: production files served executor-locally on 127.0.0.1:4173. Reproduce
with npm run build, npm exec vite preview -- --host 127.0.0.1, then
BROWSER_TEST_TOOLS=/opt/codex/cua_node/lib node scripts/browser-recovery.mjs.
Use installed browser tooling; no downloads or environment replacement.
No source push, external preview publication, deployment or provider requests.

Focused read-only review found one stale-clear issue: an empty FileList did not
cancel an outstanding worker or reset the UI. Reproduced before fixing in
/workspace/checkpoints/recovery-picker-clear-original-failure.log. Empty picker
changes now use the same generation/cancel/reset path as the Clear button.
A delayed-worker browser regression verifies no stale summary, disabled source
download and worker termination. Final targeted browser run: 25 recovery checks;
post-fix build/typecheck and diff check pass. The reviewer independently passed
eight task tests; this is focused review, not a full audit.

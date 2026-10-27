# Recovery source parsing and broker disposition — 2026-10-27

Starting source: dbcd270c95f2e6d0f9bc4c8d66ed224a0b5a5ee8.

## Broker review disposition

Read the complete native Library review privately and reconstructed its exact
UTF-8 text outside git. SHA256 matched the parent pin:
ef61bf6c400f30210f309f50abdf4af1807e7275673e45faf5aec409c84c0e7f.
The three pinned scanner/read-dependency file hashes matched current source.
Scanner SHA256 remains
7beeaa57c09a48e42615d25279479e16d9daa30ba38459bbaf524168a86821e4.

No correctness/fail-closed defect was reported; two withdrawn observations
remain withdrawn. Ran the two dense-valid-reference probes on unchanged source:
CSS 114.66 ms / 2,097,048 bytes; HTML 173.49 ms / 2,097,050 bytes. Both correctly
reported truncation and passed the ORIGINAL 3,000 ms criterion. These are local
single-run timing observations, not peak allocation measurements or capacity
claims. No memory benefit has been demonstrated for the proposed refactor;
therefore no scanner implementation change was adopted. Retained the two probes
and their truncation assertions; did not adopt a new 1,000 ms threshold.
Full private broker text/ledger is not added to git.

## Strict source parsing

New record-json parser rejects duplicate decoded object keys (including escaped
spellings), malformed JSON, lone surrogates and nonfinite numeric conversion.
Objects use null prototypes; no eval, reviver or prototype assignment occurs.
10 MiB encoded-source ceiling comes from MK-CTR-007. Additional conservative
engineering work bounds are 64 nested levels and 200,000 value nodes; these are
implementation admission limits, not newly claimed normative schema values.
Rejected source is retained by the caller, never truncated or reinterpreted.

Existing saved-status reads now use this parser. The duplicate-key integration
case failed before the connection and is preserved in
/workspace/checkpoints/record-json-integration-original-failure.log (outside git).
Other new parser/envelope tests establish boundary behavior; they are not
claimed as failures of a previously implemented RecoveryRecord importer.

## Read-only recovery envelope

inspectRecoverySource retains the exact input string separately from safe typed
errors. Unknown versions get MK_SCHEMA_UNSUPPORTED; current-version headers,
UTC timestamp and specified top-level collection caps are checked. Success is
explicitly `read-only-unvalidated`, NOT an admitted RecoveryRecord. No input UI,
record persistence, export application, operation dispatch, or plan hydration
was added. Current-version nested records may still be invalid/untrusted.
This pure inspection boundary is not a second state engine.

Full nested ArtifactHandle/PublishPlan/OperationRecord/Provenance validation,
secret-material exclusions and cross-record identity/reference checks remain
necessary before any full RecoveryRecord import feature can be enabled. Next
bounded slice: validate artifact-handle metadata and manifest binding in
read-only recovery inspection; keep operation hydration disabled. Missing
T-ART-08 restricts detector expansion only and was not needed for this slice.

## Final checks

251 tests / 19 files passed; typecheck and production build passed; diff check
passed. Installed Chromium runner: 39 checks, zero page errors/external requests.
No downloads, paid calls, remote source writes or hosting activity. No new
cross-browser/manual screen-reader/full-audit claim. Existing source retention
browser check continues to pass; the new recovery inspector is unit-tested only.

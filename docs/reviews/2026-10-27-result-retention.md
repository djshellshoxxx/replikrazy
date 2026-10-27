# Internal results and existing saved-status retention — 2026-10-27

Continues bc4c56c. Scanner implementation remains broker-owned and unchanged;
new result checks consume its existing types/caps, without detector changes.

## Internal result admission

AnalysisTask now checks complete result structure before reporting success:
source/digest syntax; intake fields and bounded collections; byte arrays,
per-file lengths, inventory path correspondence and aggregate bytes; scan
hint types, incomplete-inspection invariant, bounded dense collections,
severity counts and dependency field types. A pinned reread digest must match.
No hashing/scanning is repeated on the main thread; this is structural and
cross-field validation, not cryptographic reauthentication of worker bytes.
Internal metadata string bounds use the existing intake metadata cap, not
claims that every internal hint has become a normative public Diagnostic.

Ten original failing cases / one pass were recorded before the validator in
/workspace/checkpoints/analysis-result-original-failures.log. Added a sparse
collection regression during inspection. Lifecycle tests now use actual valid
pipeline fixtures where successful messages formerly used placeholder objects;
original cancellation, timing and error assertions are unchanged.

## Existing persistent record boundary

Inspection found only legacy manual-status maps in localStorage, not a full
RecoveryRecord importer or operation store. Added an explicitly app-specific
manual-status envelope (kind, version, artifact identity, statuses) in a separate
versioned key. Legacy source stays under its original key and is read only by
the explicit legacy path. Unknown-version, invalid, oversized and wrong-artifact
records are neither applied nor overwritten. Limits: existing 10 MiB recovery
JSON ceiling and 16 destinations. Storage failure leaves export gates intact.

A local read-only download preserves unapplied source as a JSON-escaped string
with its storage key. This preserves even malformed UTF-16 strings; it is not
a verified record or importable recovery payload. The download makes no remote
request. Fresh assessment/allowed transitions still govern restored statuses;
no saved attestation becomes consent or verified provider evidence.

This does NOT implement full RecoveryRecord serialization/import or record
migration, duplicate-key-safe recovery parsing, plan/operation hydration, or
signature/authentication. Those remain explicit future boundary work; there is
no second state engine. Missing T-ART-08 does not justify expanding detectors.

## Final evidence

230 tests / 17 files passed; typecheck and production build passed; diff check
passed. Chromium regression runner: 39 checks (including native download and
exact unknown-version source retention), zero page errors/external requests.
Used installed tooling; no downloads. No new axe/manual screen-reader,
cross-browser or whole-audit claim. No paid calls or remote source writes.

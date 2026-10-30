# Read-only recovery ArtifactHandle binding — 2026-10-27

Base c0feba648e862354e87621f4c908a0d0605c1014. Uses supplied MK-CTR-003/007/008;
no scanner, detector or provider policy change.

Recovery inspection now asynchronously validates every ArtifactHandle: exact
fields, source kind, UTC timestamp, lowercase digest/container-hash syntax,
UInt count/total, admitted manifest, manifest file count and summed byte length.
Recomputed canonical manifest digest must equal artifactId. Optional container
hash never substitutes for that digest. Future nested manifest versions return
MK_SCHEMA_UNSUPPORTED. Any rejection retains the full original source string;
no partial record is applied. Cryptographic-service failure returns a fixed
MK_INTERNAL without source or exception text.

The strict parser returns null-prototype JSON objects. Integration exposed that
canonicalization rejected those despite manifest validation accepting them.
Canonicalization now treats null-prototype and ordinary JSON records identically;
new parity coverage preserves ordinary-object canonical bytes. Class instances
and other non-JSON values remain rejected.

Original new acceptance run: 12 failures / one pass against envelope-only
inspection; /workspace/checkpoints/recovery-artifact-original-failures.log.
Integration initially had five failures from null-prototype canonicalization;
/workspace/checkpoints/recovery-artifact-integration-failures.log. Both retained
outside git. Updated existing envelope tests only to await the now-asynchronous
inspector, preserving original assertions.

Final: 265 tests / 20 files passed; typecheck/build, diff check and 39 Chromium
checks passed, zero page errors/external requests. Artifact inspection itself
is unit-tested; no import UI exists. No source publication or downloads.

Success remains read-only-unvalidated: only artifact metadata and its manifest
binding have been checked. Actual payload bytes are unavailable, so no payload
hash-match claim follows. Timestamps are claims, not freshness/trust evidence.
Plans, operations, provenance, cross-record references and secret exclusions
still prevent full RecoveryRecord hydration. Next bounded layer may validate
provenance claims and artifact references without enabling signature trust.

## Adjacent provenance slice

Artifact checkpoint: 0baa4498f89db1f1e2b321d14ad7f39575ded506. Continued with
source-pinned MK-CTR-003 Provenance: exact required/optional fields, version,
owner-supplied claim label, UTC timestamp, label/revision/description scalar
limits and HTTPS source URL without credentials or fragment. artifactId must
refer to an included, manifest-bound ArtifactHandle. No provider access occurs.

Unknown signature objects remain untrusted opaque sidecars within the 64 KiB
cap. They are not verified or interpreted as algorithm/key trust. Full import
and secret-material exclusion remain disabled; passing this metadata layer is
NOT approval to ingest keys, sign, publish, restore consent or hydrate state.
No raw signature/source detail enters typed errors. Failed sources stay intact.

Before implementation: ten failures / one pass in new provenance fixtures;
/workspace/checkpoints/recovery-provenance-original-failures.log retained outside
git. Final complete source: 276 tests / 21 files, typecheck/build, diff check and
39 Chromium checks pass; zero browser errors/external requests. No changes to
scanner, providers, policy gates, thresholds or previously failing fixtures.

This is a coherent read-only boundary handoff. Further accepted engineering
could validate PublishPlan/OperationRecord shapes and cross-record references,
but no currently recognized record may be hydrated. Explicitly missing for a
full importer: complete nested validation, secret/auth-material exclusions,
ledger consistency and expiry/reconciliation handling. Current work neither
implements nor authorizes that lifecycle. Missing T-ART-08 still gates detector
expansion only; no recovery gate is falsely attributed to those missing bytes.

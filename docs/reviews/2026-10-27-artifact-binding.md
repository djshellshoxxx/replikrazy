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

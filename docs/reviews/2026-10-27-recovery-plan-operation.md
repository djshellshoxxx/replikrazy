# Read-only manual plan/operation validation — 2026-10-27

Base d9c8bdac0fcba3d05a38e6a65be78512d8c1bc10. Uses supplied MK-CTR-005/006/007,
keeps inspection read-only-unvalidated, and adds no second lifecycle engine.

Manual plans: exact required/optional fields; UInt/counter/array bounds;
artifact references and exact public-file list; destination and action IDs;
non-mutating manual/verify actions; diagnostics/dependency shapes; canonical
planId binding. Current supported subset is manual/disabled, unknown cost,
manual-republish/none. Qualified-browser mode, known cost snapshots, prior
release snapshots and mutating actions remain explicitly unsupported and their
source is retained. This is not a claim that unsupported records are malformed.
Existing rights/payment/token export gates remain unchanged. Historical expired
plans can be inspected; recognition does not renew them or restore consent.

Operations: exact shape/versions, plan/artifact/target references, UUID/digest
syntax, enums, UInt counters, timestamp order, 1,024-attempt cap, action-reference
and current-action checks, duplicate attempt/operation/evidence refusal,
local evidence paths and coverage. Only non-mutating verify records are in this
inspection subset; possible remote mutations, release records, remote/provider
or cryptographic verification evidence remain unsupported, retained and inert.
Even accepted local evidence is an imported claim, not re-executed verification.

Structural exclusions run before version admission: credential-bearing field
names, browser-storage/cookie fields, private JWK members and private-key PEM
headers produce fixed MK_PRIVATE_DATA with no source snippet/field value in
errors. Original source remains available separately for read-only retention.
Unknown signatures remain opaque/untrusted unless prohibited structure is
recognized. This is NOT a general secret detector or a guarantee that opaque
IDs, arbitrary prose or encoded strings contain no secrets. T-ART-08 policy and
fixtures were not invented or broadened. No private keys are requested or used.

Original failing runs retained outside git:
- recovery-plan-original-failures.log: 10 failed / 1 passed.
- recovery-operation-secret-original-failures.log: 19 failed / 1 passed.
- record-secrets-wide-array-original-failure.log: 1 failed / 5 passed; replaced
  argument spreading with bounded iteration, preserving parser node caps.

Additional positive/negative fixtures exercise actual generated plans and local
verification ledgers, coverage and unchanged-source rejection. Final full source:
316 tests / 24 files, typecheck/build and diff check pass. Existing installed
Chromium: 39 checks, zero page errors/external requests. No downloads, remote
writes, paid calls, hosting, credentials, deployment or new detector behavior.
This inspection code has unit coverage; no recovery import UI exists.

## Exact remaining boundary

MK-CTR-006 states requestKey derives from planId/targetId and actionId but does
not define canonical derivation bytes/domain separation. It also lists states
and phases without a complete permitted transition/reconciliation table. Need
the source-pinned section defining those algorithms/invariants before claiming
ledger replay safety or validating resumable lifecycle history. Keys here are
syntax-checked, not cryptographically checked against a guessed algorithm.

No record may be hydrated or resume execution: full lifecycle validation,
reconciliation/expiry authority and complete secret-material handling remain
unresolved. Direct provider/release/known-cost modes are outside current lean
support. Missing detector acceptance bytes do not block this inspection work,
and are not misrepresented as the missing lifecycle contract. Further work
must preserve explicit unsupported outcomes and opaque signature distrust.

Focused independent read-only review found no actionable new issue; reviewer
ran 64 targeted tests and diff check successfully, with no edits. This covers
only the requested new validation boundaries, not a full application audit.

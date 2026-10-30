# Replikrazy local verification record profile 1

Status: opt-in local validation contract, version `replikrazy-local-verify/1`.
This fills mechanical details left open by supplied MK-CTR-006; it does not
amend provider protocols or confer authority to execute, hydrate or publish.

## Reconciliation and compatibility

At base 7b5eacedce0f946dd255b6a53abfcd6085666049, repository search found no
request-key producer or lifecycle consumer beyond read-only recovery validators
and synthetic fixtures. Preserved 01_CONTRACTS/02_ARTIFACTS specify key inputs,
JCS/SHA-256 and state/phase enums, but no key-domain bytes or transition table.
No broader private pack is available here; no missing bytes were invented.
The existing DryRunPlan manual-attestation state flow remains separate and
unchanged. This profile is pure validation, not a second state engine.

Select the profile explicitly via the recovery inspector's validationProfile
option. Never infer it from engineVersion, a matching-looking digest, source
filename or an imported record's claim. It adds no fields to OperationRecord
or RecoveryRecord. Omitted profile preserves legacy structural inspection only;
unknown profiles reject with retained source. Explicit profile validation never
rewrites old keys, artifact IDs, plan IDs, operation IDs or source text. To emit
new-profile records, a future producer must choose it before deriving keys.

## Deterministic request keys

Use existing RFC 8785 JCS UTF-8, no BOM or trailing newline, then SHA-256 and
lowercase `sha256:` digest. All IDs pass the existing Digest/Id validators.
Operation body is exactly `{profile,scope:"operation",planId,targetId}`.
Action body is exactly `{profile,scope:"action",planId,targetId,actionId}`.
The profile value is `replikrazy-local-verify/1`. An absent actionId selects the
operation domain; null, empty or malformed IDs are invalid. Attempt number is
intentionally absent; repeated inputs derive the same key, which does not
permit repeated attempts under this profile. These are local correlation keys, NOT evidence of
provider idempotency or permission to retry a write.

Independent vectors (Python standard json sorted compact ASCII keys + hashlib;
these vectors contain only ASCII strings, matching the JCS subset):

```text
{"planId":"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","profile":"replikrazy-local-verify/1","scope":"operation","targetId":"netlify"}
sha256:935ebc7c3fb86c2ec50a4518a821721deb08651793b5cec6aec97d441950fe89
{"actionId":"verify","planId":"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","profile":"replikrazy-local-verify/1","scope":"action","targetId":"netlify"}
sha256:8edd438328b1652355c371782e44b89ebd0efee9f7adce8607cd87aaf2be2116
```

## Snapshot constraints

Run ordinary structural/reference validation first. Support only kind=verify,
mutationMayHaveOccurred=false, no provider job/release/reconcile markers, and
planned actions whose kind is verify. Operation creation must be at/after plan
creation and strictly before plan expiry. Later inspection of expired records
is allowed and never renews authority. Historical timestamps remain claims.

| State | Allowed phase |
| --- | --- |
| planned, blocked, ready | none |
| verifying, cancel-requested, verified, verification-limited, failed | verify |
| cancelled, interrupted | none or verify |

Phase none has no action attempts or verification evidence. Top-level attempt
is the ledger entry count. Per-action attempt must be 1 and each action occurs at most once. This profile
has no retry-authorization receipt, so repeated attempts are retained as
unsupported, regardless of error retry advice. currentActionId names the last
entry when nonempty. No waiting, user action or reconciliation is inferred.
All action keys are checked against the selected profile. Evidence timestamps
lie within operation creation/update timestamps.

Verified requires a nonempty ledger whose latest attempt for each action is
acknowledged, at least one all-path passing local-byte-preservation claim, and
no failed evidence. Verification-limited requires a nonempty ledger with no
prepared/dispatched/pending entries. Failed requires lastError. These are
record consistency rules; they do not reperform verification or trust claims.
Other states/phases and mutation-capable records remain unsupported.

## Conservative pair validation

Both snapshots must already pass structural and profile validation. Pair checks
are validators only: no transition function mutates state or dispatches work.

| From | Allowed next states |
| --- | --- |
| planned | ready, blocked, cancelled, interrupted |
| ready | verifying, cancelled, interrupted |
| verifying | verifying, verified, verification-limited, failed, cancel-requested, interrupted |
| cancel-requested | cancel-requested, cancelled, interrupted |
| blocked, verified, verification-limited, failed, cancelled, interrupted | none |

Phase verify cannot return to none. Identity fields and createdAt are immutable;
updatedAt never decreases. Ledger/evidence cannot shrink. No new attempts may append after cancellation
is requested or while a previous lastError exists; an earlier error cannot be
silently treated as permission to continue. An existing lastError must remain
canonically identical, so clearing it cannot bypass this gate. Existing ledger
positions retain actionId/requestKey/attempt/phase and nondecreasing timestamps.
Attempt status may stay unchanged, or advance as follows:

| From | Allowed changed status |
| --- | --- |
| prepared | dispatched, not-applied, failed |
| dispatched | acknowledged, pending, unknown, failed |
| pending | acknowledged, unknown, failed |
| unknown | acknowledged, not-applied, failed |
| acknowledged, not-applied, failed | none |

Previously recorded evidence remains canonically identical and ordered;
additional evidence may append. Reconciliation here only validates a supplied
local-read status update, never initiates a provider query or retry. Terminal
operations cannot resume. A new independently authorized operation is a separate
future concern. Snapshot validation alone cannot prove a historical transition
sequence; the pair validator requires both snapshots and still proves no event
actually occurred. Neither passing result authorizes hydration or execution.

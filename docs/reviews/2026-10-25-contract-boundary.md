# Local scan and diagnostic contract slice

## Reference provenance

The parent supplied two complete documents directly as private task-message
reference text. This executor did **not** recover the private archive or hash
local source-document bytes. The parent reports independent verification of
archive SHA-256 `c51c0ca4eff8056064e18058c8e87621d75e32229b1b8d0ab98b9c0490e764ee`.
The following are **parent-supplied source hashes**, recorded for traceability:

| Source | SHA-256 |
| --- | --- |
| `mirrorkit-research/specs/01_CONTRACTS.md` | `9fce42b86644a7f9a20d9096c156276b3ce1da337d15edf87511d19eabc318b4` |
| `mirrorkit-research/specs/02_ARTIFACTS.md` | `623f6c885d3a4a58f288e9998d3a06ea43fd9c2e95ba8228dcbf016cd6e2987d` |

Full reference text remains private in the task message, not committed here.
A private provenance note is outside git at
`/workspace/scratch/replikrazy-private-contracts/PROVENANCE.txt`. Other pack
specifications remain unavailable. No further Library/browser download was
attempted; exhausted transfer retry and denied browser download remain stopped.

## Implemented boundary

- `scan.json` is now a canonical contract ScanReport bound to the current
  artifact ID. The internal pre-identity scanner view is named
  `CompatibilityScan`; its raw messages/extra hints are not serialized as the
  shared record. This changes the old ad hoc scan sidecar format; no sidecar
  import/migration is implemented or claimed.
- Shared Diagnostic/MKError/Result types and strict shape/bounds checks reject
  unknown fields, non-contract codes, invalid counters, malformed scalar text,
  invalid paths and unsupported enum values. This is not a full validator for
  every record in the contract specification.
- Scanner-only diagnostic labels map to allowed shared code families and stable
  message/remediation keys. Severity and certainty remain explicit. Keys carry
  specific meaning; a generic capability warning is not a verified provider
  incompatibility claim. Secret diagnostics retain class/path, never values.
- Complete severity counts are maintained before detail truncation. Output
  reserves warning and blocker summaries inside the 10,000-detail cap, with
  detected-blocker totals. Counts include undisplayed findings plus summaries.
  The app's pre-existing stricter policy still blocks **all** truncated scans;
  the contract validator can accept warning-only truncated external records
  when there are no blockers. No external record importer authorizes anything.
- External dependency roles use the shared enum; media maps to unknown, and
  multiple roles remain explicit. Parsed origins omit credentials. Overlong
  origins truncate the scan before export. No endpoint is fetched.
- `fileMetadata` is empty because MIME/content verification is not implemented;
  types are not certified from extensions. Scanner hints do not alter artifact
  manifest bytes, identity or app payload.
- The worker-facing analysis operation resolves typed success/error records.
  Cancellation, timeout, worker unavailability, unreadable changed snapshots and
  fatal empty-input cases use fixed safe error mappings. Exception text and
  worker-provided params/details are never forwarded. Nonfatal inspection
  diagnostics remain in the internal analysis result; invalid bundles still
  cannot export. This does not claim every legacy helper now implements the
  global Result algebra.
- PublishPlan uses the shared Diagnostic and ExternalDependency types. No auth,
  consent, provider write, crypto signature or financial-policy feature added.

## Remaining normative differences (not silently changed)

- The app's 60-second wall-clock hard stop is stricter than an active-parser
  budget with a user-controlled continue flow; tab suspension counts here.
- Unicode case folding remains the documented JS upper/lower approximation,
  not pinned full default Unicode folding.
- Current intake validates wrapper paths before stripping and hashes a valid
  inventory before an owner selects a missing entrypoint. This differs from
  the proposed root/entrypoint ordering. Export remains blocked until valid;
  this slice does not claim intake-wide conformance.
- Content scanning is heuristic and does not implement every proposed private-
  data detector. Owner review remains mandatory; no full-secret-detection claim.
- Unsupported-version read-only import/export preservation, all public-operation
  migration, broader record validators and other absent specifications remain
  separate work. Financial/trust gates and manual-only scope were preserved.

## Evidence and original failure

- 13 test files / **167 tests passed**; original hostile fixtures, regex budgets,
  fuzz seed and byte oracles retained. The worker lifecycle tests now assert
  typed failure results rather than promise rejection, retaining the same
  cancellation/time/ownership expectations.
- Typecheck, production build and diff check passed.
- Chromium: **33 regression checks**, including actual handoff download and
  exact ScanReport fields/identity/payload; zero page errors/external requests.
- Accessibility: **16 axe scans / 16 reflow checks**, 156 visible controls across
  keyboard runs; zero violations, page errors or external requests.
- A disjoint read-only reviewer found an origin-length mismatch: a 2,200-character
  hostname passed scanning but failed report construction. The retained fixture
  initially failed `expected false to be true` for truncation. It now passes;
  overlong origins are not retained and export stays blocked.
- Reviewer independently ran 7 contract tests and diff check after the fix,
  withdrew an initial warning-only-truncation validator concern after checking
  exact normative wording, and reported no remaining concrete issue in this
  focused slice. This is not a full audit or release qualification.

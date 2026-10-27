# Versioned local verification profile — 2026-10-27

Base 7b5eacedce0f946dd255b6a53abfcd6085666049. Parent explicitly delegated
mechanical contract choices after reconciliation. No established producer/key
format was found in preserved source or the two available private contracts.
The missing mechanical definitions are now resolved for the bounded local
verification subset, not treated as owner-only blockers.

New public implementation contract: ../contracts/LOCAL_VERIFY_PROFILE_1.md.
Existing JCS UTF-8 + SHA-256 with versioned scope separation; independent Python
standard-library vectors pinned in tests. Pure snapshot/pair validators define
conservative state/phase and ledger rules. Explicit caller opt-in is required.
Legacy/default inspection remains structurally checked and read-only; unknown
profiles and mismatches retain the original source. No external artifact,
plan or operation ID is rewritten; no live producer or engine is installed.

Original failing evidence outside git:
- local-profile-original-failures.log: 2 opt-in/profile tests failed before integration.
- local-profile-review-original-failures.log: 4 reviewer-derived cases failed;
  repeated attempts and new work after cancellation/error are now refused.
- local-profile-error-retention-original-failure.log: one follow-on case showed
  error removal could bypass the append gate; existing errors now remain
  canonically identical throughout an accepted snapshot pair.

Focused read-only reviewer reproduced the retry/cancellation issues, then
verified both fixes with 16 passing profile tests and no residual issue in
those fixes. One subsequent error-retention regression/fix brought the profile
suite to 17. Final complete source: 333 tests / 25 files passed; typecheck/build
and diff check passed; existing installed Chromium runner 39 checks, zero page
errors/external requests. No downloads, paid calls, provider/remote writes or
full-audit claim. Profile validators have unit coverage, not live engine tests.

Passing profile metadata and transitions does not prove any events occurred.
No retry-authorization receipt is defined, so repeated action attempts remain
unsupported rather than inferring user action, reconciliation or backoff.
Terminal states cannot resume. Snapshot-only records cannot demonstrate their
history; pair validation needs both valid snapshots and is still not execution
authority. Existing rights/public-data/financial/trust gates are untouched.

Remaining product boundary: no hydration/import UI, no operation executor and
no authority to contact providers. Full arbitrary-record secret absence and
signature trust are unverified; unsupported legacy/direct/cost/release modes
stay inert. Those limits do not invalidate the new local mechanical profile
or justify silently migrating historical records to it.

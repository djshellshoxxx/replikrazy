# Local consumer modules (v1)

Approved initial scope: comparison reports and **canonical** handoff ZIP checking.
No UI wiring, CLI, what-if engine, standalone-planner reader or execution API.
Import from `src/consumers/index.ts`. Both functions return the existing `Result<T>`
algebra; errors have fixed keys/codes and never include source snippets.

## Comparison reports

`createComparisonReport(comparison, artifactId)` validates a bounded Comparison,
rejects duplicate paths across partitions, malformed hashes/sizes and unknown
fields, then copies and sorts the detailed results by UTF-8 path order. Input is
not mutated. `reportId` is SHA-256 of existing JCS canonical bytes **excluding
reportId itself**. No timestamp or new cryptography. `liveVerified` is always false.

This is a report of supplied comparison facts. A reference artifact ID alone
cannot prove that the supplied Comparison originated from that artifact; the
caller must produce it from trusted local inventories. The bundle checker does
that binding itself. Matching paths are represented by their count (as in the
proposal); the report hash identifies the report, not both complete inventories.

## Canonical handoff checker

`checkCanonicalBundle(zipBytes, nowMs)` snapshots the archive before any await,
uses the existing strict ZIP reader, validates both roots and full Unicode
collisions including implicit directories, and requires:

- `app/` payload files, plus `mirrorkit-control/` metadata; no wrapper inference.
- A strictly parsed, supported ArtifactManifest with exactly canonical bytes.
- A strictly parsed manual/disabled PublishPlan, validated by the existing
  recovery-plan validator (including plan hash and manifest/file-list binding).
- Matching payload paths, sizes and SHA-256 hashes for a valid report.
- Non-expired/non-future plan and no existing declared-use/target blockers.

`Result.ok=false` means the input cannot be interpreted under this contract.
For interpretable bytes, `Result.ok=true` returns a report; **inspect `value.valid`**
for integrity/expiry/declared-policy findings. A mismatch/expired bundle remains
inspectable with `valid=false`. Errors include only fixed ErrorCodes. The caller
retains original source bytes even on unsupported/invalid input; this API never
rewrites or persists them.

`valid=true` does **not** establish secret absence, current provider eligibility,
owner rights, provenance/signature trust, runtime behavior or permission to upload.
The module does not run the payload scanner or fetch dependencies. Every result
has `publishAuthorized:false` and `liveVerified:false`. It creates no dry-run
execution steps, restores no plans/consent and does not expose provider operations.
The existing export/public-data gates must remain in effect in any future caller.

Other control sidecars (scan, status, instructions, unknown metadata) are listed in
`uncheckedControlFiles`; their content is not certified or returned. The whole
control root is marked never-upload. Standalone planner bundles are unsupported;
never reinterpret their filtered inventory as a canonical artifact.

## Bounds and integration

Existing ZIP caps apply to the **whole handoff container**, including controls:
128 MiB compressed, 256 MiB expanded, 32 MiB per file, 10,000 files and existing
metadata/directory/ratio caps. Records additionally have the existing 10 MiB JSON
cap, duplicate-key and numeric rules. Thus some maximum-sized exports can exceed
this reader's envelope and are rejected; missing capacity is not unlimited.
Payload path budgets are checked after the fixed `app/` prefix, without rewriting
names. No browser size/capacity qualification is implied.

These are async local modules; ZIP parsing itself is synchronous bounded work.
Any future UI caller must use the existing worker/cancellation pattern, not move
large untrusted parsing onto the UI thread. No UI or worker integration is claimed.

Tests: `npx vitest run tests/consumers/consumers.test.ts`, then `npm run test:all`
and `npm run build`. Browser module check: start canonical Vite dev server at
127.0.0.1:4175 and run `BROWSER_TEST_TOOLS=/opt/codex/cua_node/lib node
scripts/browser-local-consumers.mjs`. It loads only trusted repository modules;
selected payload is never rendered or executed.

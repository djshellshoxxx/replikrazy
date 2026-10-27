# Future integration notes

This tool is deliberately standalone: it imports nothing from, and changes nothing in, any other part of Replikrazy (intake, recovery, the publishing engine, shared schemas, root configuration). These notes describe how it *could* be connected later, once those parts exist and are reviewed. None of this has been done.

## Stable surfaces to integrate against

- **Plan file** — `plan.json`, `schema: "replikrazy.offline-mirror-plan"`, `schemaVersion: 1`. Treat it as read-only input. Key fields: `planState`, `verification.performed` (always `false`), `site.files[]` (`path`, `size`, `sha256`, `mediaType`), `site.manifestSha256` (SHA-256 of `SHA256SUMS`), `destinations[]` (`type`, `state`, `basePath`, `requiredHeaders`, `capabilities`, `missingConfiguration`, `record`).
- **Destination records** — `destinations.json`, `schema: "replikrazy.offline-mirror-destinations"`. Re-importable; contains no credentials.
- **Engine modules** — `src/core.js`, `src/destinations.js`, `src/plan.js`, `src/zip.js` are UMD with no dependencies; `require()` them from Node or load them as classic scripts. They are pure functions apart from Web Crypto hashing.

## Suggested steps

1. **Shared schema.** If Replikrazy adopts a shared schema package, add a JSON Schema for `plan.json` v1 there and validate this tool's output against it in CI. Bump `schemaVersion` on any breaking change; keep `importDestinations` able to read v1.
2. **Intake hand-off.** An intake step can feed this planner by producing entries shaped `{path, size, read()}` and calling `buildInventory`, or by passing a folder for the user to select. Keep the sensitive-file and path rules here as the single gate before anything is planned.
3. **Publishing engine hand-off.** A future publisher should take `plan.json` + the bundle's `site/` folder as input and must:
   - verify every file against `SHA256SUMS` and `site.manifestSha256` before acting;
   - refuse destinations whose `state` is not `ready-for-manual-review`, and still require a human confirmation step — this planner's states are declarations, not verification;
   - keep credentials in its own secret store, never in the plan;
   - never treat `pending-operator-generation` onion/I2P addresses as known.
4. **Recovery.** `destinations.json` plus the bundle is enough to rebuild a plan offline; a recovery workflow can store those two artifacts (the bundle excludes credentials, keys, databases and backups by design — those need their own secure backup path).
5. **Provider knowledge.** If the project later builds a reviewed provider-capability catalogue, load it as *suggestions* the user confirms, keeping the user-declared/unverified distinction in the plan. Do not pre-fill `yes` for anything without a cited, dated source.
6. **CI.** Run `npm test` (or `node --test "tests/unit/*.test.js"`), `node scripts/export-samples.cjs --check` and `node tests/e2e/run.cjs` from `tools/offline-mirror-planner/`. They need no network.

## Things to keep true

- No network requests from the page (CSP `connect-src 'none'`).
- No key or identity generation, no service start, no uploads.
- Original site bytes are never modified.
- No claim that mirrors share browser storage or that Tor/I2P anonymise blockchain transactions.

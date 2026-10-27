# Offline Mirror Planner

A standalone, browser-based **planner and offline exporter** for static-site mirrors. It inventories a static-site folder you select locally, lets you describe mirror destinations, compares the capabilities *you declare* for each one, and exports a JSON deployment plan with per-destination operator instructions and inert configuration templates.

> **It is not a publisher.** It makes no network requests, uploads nothing, signs up for nothing, accesses no accounts, creates no Tor/I2P identities and starts no services. Every address and capability is user-entered and stays **unverified**; the best state anything can reach is **ready for manual review**.

## Quick start

1. Open `index.html` in a current Chromium-, Firefox- or Safari-based browser — straight from disk (`file://`) or from any local static server, e.g. `python3 -m http.server -b 127.0.0.1 8000` run in this folder.
2. Click **Load built-in demo** to try every feature without files, or **Select site folder** to inventory your own static site.
3. Add, edit or remove destinations; review the comparison matrix and missing configuration.
4. Export `plan.json`, `SHA256SUMS`, `destinations.json`, per-destination `INSTRUCTIONS.md` and templates, or a ZIP (optionally including the site files, byte-for-byte).

Nothing is stored: state lives in page memory only (no localStorage, IndexedDB or cookies). Re-import a `destinations.json` or `plan.json` to continue later.

To try the real folder-selection flow with the synthetic site: `node scripts/write-demo-site.cjs /tmp/omp-demo`, then select `/tmp/omp-demo/lantern-community-library`.

## Destination types

| Type | What the planner produces | What it never does |
|---|---|---|
| Generic static hosting | Header list, base-path guidance, checklist of capabilities to confirm from the provider's own documentation | Claim the provider supports anything; contact or sign up with it |
| Operator-managed local web server | nginx / Caddy / Apache template text (or a header list for "other") | Install, start or reload a server |
| Tor onion service | `torrc` snippet with **every directive commented out**, and step-by-step operator instructions | Generate keys or an onion address; start Tor |
| I2P site | i2pd `tunnels.conf` snippet (**commented out**) or a Java I2P value checklist | Generate keys or a .b32.i2p address; start a router |

Onion/I2P addresses default to **pending operator generation**: the operator's own Tor/I2P software creates them, and the operator types them back in afterwards. Entered addresses get a format check only (v3 onion: 56 base32 characters ending in `d`; I2P: `.b32.i2p` or `.i2p` name) — never a reachability or checksum check.

## Readiness states

Per destination, in order of precedence:

1. `needs-configuration` — a required field is missing or invalid.
2. `blocked-by-declared-capability` — you declared a *required* capability unsupported (or a declared size/count limit is too small).
3. `unverified` — configuration is complete but a required capability is still `unknown`.
4. `ready-for-manual-review` — every required item is declared. Still not verified.

The plan is `ready-for-manual-review` only when the inventory has no rejected files, settings are valid and every destination is ready; otherwise it is `draft` with reasons listed. `verification.performed` is always `false`.

## Safety properties

- **Bytes preserved.** Files are hashed (SHA-256) and, in the bundle, stored verbatim (ZIP *store* method). Before bundling, each file is re-read and re-hashed; a mismatch aborts the export. Base paths are a server setting — site links are never rewritten (files with root-absolute links are flagged instead).
- **Bounded input.** Max 5,000 files, 50 MiB per file, 500 MiB total, 1,024-character paths, 32 levels deep, 50 destinations, 40 headers, 5 MiB imports (`LIMITS` in `src/core.js`).
- **Safe paths.** Traversal, absolute paths, drive letters, backslashes, control/bidi characters, empty segments, trailing dots/spaces, Windows device names, non-NFC names and duplicates are rejected with a clear reason. The ZIP writer refuses unsafe entry names.
- **Secrets kept out.** VCS metadata, `.env`/credential files, private keys and certificates, Tor/I2P key material, wallets, databases, backups and OS metadata are excluded **without reading their bytes**; text files containing private-key blocks or common token formats are excluded too. Excluded files appear only as path + reason. Destination records have no credential fields; unknown imported fields are dropped; credential-looking free text is flagged and redacted on export; URLs with `user:pass@` are rejected.
- **No network.** The page's Content-Security-Policy sets `connect-src 'none'` and loads nothing external; the e2e test asserts the page makes no non-`file:` requests.
- **Honest limits.** Exports state that mirrors are separate origins and **do not share browser storage**, and that Tor/I2P **do not make blockchain transactions anonymous**.

## Layout

```
index.html            UI (no build step, no dependencies, works from file://)
src/core.js           limits, path validation, sensitive-file rules, hashing, inventory, header validation
src/destinations.js   destination types, validation, capabilities, readiness states
src/plan.js           plan JSON, instructions, inert templates, import/export
src/zip.js            store-only ZIP writer/reader
src/demo.js           synthetic site + sample destination records
src/app.js, styles.css  UI wiring and styles
scripts/              export-samples.cjs, write-demo-site.cjs
samples/              committed sample exports (regenerate with npm run samples)
tests/unit/           node:test engine tests (no dependencies)
tests/e2e/            Playwright browser tests
```

## Tests

From this directory (Node 22+):

```
node --test tests/unit/                 # engine tests, no dependencies
node scripts/export-samples.cjs --check # committed samples match the engine
node tests/e2e/run.cjs                  # browser tests; needs Playwright + Chromium
```

The e2e runner looks for Playwright via `PLAYWRIGHT_MODULE`, normal resolution, or the global npm root, and uses `PLAYWRIGHT_BROWSERS_PATH` for Chromium.

See [INTEGRATION.md](INTEGRATION.md) for how this tool could later connect to the rest of Replikrazy.

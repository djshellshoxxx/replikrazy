# Offline Mirror Planner — design contract

Status: v0.1 contract. All modules in this directory code against this file.

## 1. What this tool is (and is not)

- A **planner and offline exporter**. It inventories a static-site folder the
  user selects locally, records SHA-256 hashes, checks user-declared
  destination capabilities against what the site needs, and exports a JSON
  deployment plan plus per-destination operator instructions.
- It is **not a publisher**. It makes **no network requests** (enforced by a
  `connect-src 'none'` Content-Security-Policy), does not upload, sign up,
  log in, verify addresses, create Tor/I2P identities, generate keys or start
  services. Tor/I2P output is inert text templates only.
- Destination addresses and capabilities are **user-entered and unverified**.
  The best status the tool ever assigns is `ready-for-manual-review`.
- Site bytes are never rewritten. Hashes let operators prove that.

## 2. Layout (exclusive ownership in brackets)

```
tools/offline-mirror-planner/
  package.json, README.md, docs/            [lead]
  src/core/sha256.js paths.js inventory.js
           destinations.js plan.js zip.js   [lead / core]
  tests/unit/core-*.test.js                 [lead / core]
  demo/site/**  demo/sample-destinations.json demo/README.md
  scripts/build-demo-data.js  src/demo-data.js
  tests/unit/demo-*.test.js                 [demo worker]
  index.html styles.css src/ui/**  tests/e2e/**   [ui worker]
  scripts/export-examples.js examples/**    [lead]
```

No file outside `tools/offline-mirror-planner/` is touched.

## 3. Runtime and module format

- Zero runtime dependencies. Node >= 18 for tests (`node:test`). Browser: any
  evergreen browser; must work when `index.html` is opened from `file://`
  (so: classic `<script>` tags, no ES modules, no fetch).
- Every `src/**` file is a UMD-style IIFE:
  - In Node: `module.exports = api` (dependencies via `require('./x.js')`).
  - In browser: registers on `globalThis.OMP.<name>` (`OMP.sha256`,
    `OMP.paths`, `OMP.inventory`, `OMP.destinations`, `OMP.plan`, `OMP.zip`,
    `OMP.demoData`). Load order in `index.html`: sha256, paths, inventory,
    destinations, plan, zip, demo-data, ui/app.

## 4. Data shapes

### 4.1 Input entry (what the UI hands to `inventory.build`)

```js
{ path: 'assets/app.js',            // relative, '/'-separated, root folder stripped
  size: 1234,                        // bytes, known before reading
  getBytes: async () => Uint8Array } // read lazily, only for accepted files
```

### 4.2 Destination record (user-entered; also `demo/sample-destinations.json`)

```jsonc
{
  "id": "static-example",          // ^[a-z0-9][a-z0-9-]{0,47}$, unique
  "name": "Example static host",   // 1..80 chars
  "type": "static-host",           // static-host | local-server | tor-onion | i2p
  "basePath": "/",                 // "/" or "/seg/…/" (see paths.validateBasePath)
  "address": "https://mirror.example.org/", // may be ""; see per-type rules
  "providerLabel": "",             // static-host: required free text (provider name as user knows it)
  "serverSoftware": "",            // local-server | tor-onion | i2p: nginx | caddy | other
  "listen": "",                    // local-server | tor-onion | i2p: host:port of local web server
  "documentRoot": "",              // local-server | tor-onion | i2p: absolute POSIX dir
  "router": "",                    // i2p: i2pd | java-i2p
  "maxFileMB": null,               // number (declared per-file limit) or null = unknown
  "capabilities": {                // each "yes" | "no" | "unknown"
    "directoryIndex": "unknown",   // serves index.html for directory URLs
    "customHeaders": "unknown",    // can set response headers
    "customErrorPages": "unknown", // can serve a custom 404 page
    "subpathHosting": "unknown",   // can host under a non-root base path
    "https": "unknown",            // serves over HTTPS (n/a for tor-onion, i2p)
    "correctMimeTypes": "unknown", // serves correct Content-Type per extension
    "minimalLogging": "unknown"    // request logging disabled/minimised
  },
  "notes": ""                      // 0..1000 chars, free text
}
```

Fields that do not apply to a type are kept as `""` and ignored.
No field may hold credentials; `destinations.validate` rejects secret-like
values and export redacts them.

Per-type required fields:

| type          | required                                   | optional                  |
|---------------|--------------------------------------------|---------------------------|
| static-host   | name, providerLabel, address (http/https URL) | basePath, maxFileMB, notes |
| local-server  | name, serverSoftware, listen, documentRoot | address (URL)             |
| tor-onion     | name, serverSoftware, listen (loopback), documentRoot | address (v3 `.onion`; pending until operator's Tor creates it) |
| i2p           | name, router, serverSoftware, listen (loopback), documentRoot | address (`.b32.i2p` or `name.i2p`; pending) |

### 4.3 Destination status (computed, never stored as "verified")

- `incomplete` — validation errors (missing/invalid field, secret-like value).
- `blocked` — a *required* capability is declared `no`, or `maxFileMB` is
  smaller than the largest site file.
- `unverified` — a required capability is `unknown` / `maxFileMB` is null.
- `ready-for-manual-review` — all required items declared satisfied.
  Still unverified by the tool; an operator must review by hand.

Every exported destination carries `"verified": false`.

### 4.4 Requirements (site + destination → checklist)

| key              | level                                          |
|------------------|------------------------------------------------|
| directoryIndex   | required if site has any `index.html`          |
| customHeaders    | required if plan has ≥1 required header        |
| correctMimeTypes | required                                       |
| subpathHosting   | required if destination basePath ≠ "/"         |
| maxFileMB        | required (≥ largest file, MiB, rounded up)     |
| customErrorPages | recommended if site has root `404.html`        |
| https            | recommended for static-host/local-server; n/a for tor-onion/i2p |
| minimalLogging   | recommended for tor-onion/i2p                  |

### 4.5 Limits (`inventory.LIMITS`, all enforced before reading bytes)

maxFiles 5000 · maxFileBytes 50 MiB · maxTotalBytes 250 MiB ·
maxPathLength 512 · maxSegmentLength 255 · maxDepth 32 ·
maxDestinations 50 · maxImportBytes 256 KiB · maxTextScanBytes 2 MiB ·
maxHeaders 20.

### 4.6 Excluded files (never hashed into the plan; export shows counts only)

Categories: `vcs-metadata`, `credential`, `private-key`, `database`,
`backup`, `server-side-code`, `os-metadata`, `hidden-file`, `secret-content`.
Any path segment starting with `.` is excluded (`hidden-file`) except
`.well-known/`. `secret-content` = text matched a private-key header
after reading.

## 5. Exports

`plan.buildExportFiles(plan, inventory)` returns:

- `deployment-plan.json` — schema `offline-mirror-planner/deployment-plan@1`
- `SHA256SUMS` — `sha256sum -c` compatible, sorted by path
- `instructions/<destination-id>.md` — one per destination
- `README.txt` — what the bundle is / is not

`zip.createZip(files)` bundles them (store-only, deterministic).

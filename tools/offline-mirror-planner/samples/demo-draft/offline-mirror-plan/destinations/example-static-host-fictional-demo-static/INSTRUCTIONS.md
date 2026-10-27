# Operator instructions — Example static host (fictional)

> **PLANNING ARTIFACT ONLY. Generated offline by the Replikrazy Offline Mirror Planner. Nothing was uploaded, published, registered, deployed or verified. No network request was made. Every address and capability in this plan was entered by a person and is unverified.**

- Destination type: Generic static hosting
- State: **unverified** — Unverified (required capabilities still unknown)
- Verified by planner: **no** (the planner never verifies anything)
- Address status: user-entered-unverified
- Effective base URL: `https://mirror.example.com/library/` (user-entered, unverified)
- Base path: `/library/`
- Site: Lantern Community Library (fictional demo) — 13 files, 3.8 KiB
- Manifest SHA-256 (of SHA256SUMS): `b6c4f31f603febc26dffa90a87acfd1e2fde63d312251f365aa3be33807bfb91`
- Plan generated: 2026-10-27T00:00:00.000Z

## 1. Open items before anything else

- [ ] Review: 1 file(s) use root-absolute links ("/…") that will break under base path "/library/". The planner does not rewrite site bytes; fix links in the source site or use base path "/".

## 2. Declared capabilities (user-declared, unverified)

| Capability | Requirement | Declared by user | Status |
|---|---|---|---|
| Serves files byte-for-byte (no minify, injection or rewriting) | required | yes | declared-supported |
| Can send the plan's custom response headers | required | unknown | unknown-blocking |
| Sends correct Content-Type for every file extension in the site | required | yes | declared-supported |
| Serves index.html for directory URLs | required | yes | declared-supported |
| Can serve the site under the chosen base path | required | yes | declared-supported |
| Can use the site's own 404.html | recommended | no | declared-unsupported |
| Serves over HTTPS with a valid certificate | required | yes | declared-supported |
| Operator controls access-log retention | recommended | unknown | unknown |
| Per-file size limit accommodates the largest site file | required | yes | declared-supported — Declared 25.0 MiB per file; largest site file is 771 B. |
| File-count limit accommodates the site | required | yes | declared-supported — Declared 20000 files; site has 13. |

Check each "unknown" item against the destination's own documentation or configuration. Do not assume support.

## 3. Prepare the files (byte-for-byte)

1. Use the exported bundle's `site/` folder, or the original source folder. Do not edit, minify, re-encode or "optimise" any file.
2. Verify every file against the manifest before copying: `cd site && sha256sum -c ../SHA256SUMS` (on macOS: `shasum -a 256 -c ../SHA256SUMS`). Every line must say OK.
3. 9 file(s) were excluded as sensitive (see plan.json → site.excluded). Make sure none of them exist on the destination.
4. Copy the files so that `index.html` is served at `/library/`.

## 4. Configure this destination

- Provider (free text, user-entered): Example Static Host (fictional)
- Intended copy method (user-entered): Manual upload through the provider dashboard (operator only)
- Configure headers, base path and error page using **the provider's own documented mechanism**. The planner does not know whether this provider supports them; every "unknown" capability above must be confirmed from the provider's documentation first.
- Account access, credentials and upload tools are handled by the operator outside this planner and must never be added to the plan.
- If the provider cannot send the required headers or serve files byte-for-byte, choose a different destination.

## 5. Required response headers

| Header | Value | Source |
|---|---|---|
| X-Content-Type-Options | `nosniff` | plan |
| Referrer-Policy | `no-referrer` | plan |
| Content-Security-Policy | `default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'` | plan |
| Permissions-Policy | `camera=(), microphone=(), geolocation=()` | plan |
| Cross-Origin-Opener-Policy | `same-origin` | plan |
| Strict-Transport-Security | `max-age=31536000` | https-destination |

Expected Content-Type per extension:

- `.css` → `text/css; charset=utf-8`
- `.csv` → `text/csv; charset=utf-8`
- `.html` → `text/html; charset=utf-8`
- `.js` → `text/javascript; charset=utf-8`
- `.json` → `application/json`
- `.png` → `image/png`
- `.svg` → `image/svg+xml`
- `.txt` → `text/plain; charset=utf-8`
- `.webmanifest` → `application/manifest+json`

## 6. Templates in this folder

- `headers.txt` — inert text for review; nothing was applied.

## 7. Manual verification after the operator deploys

- [ ] The home page loads at the base path, and a sub-page loads via its directory URL.
- [ ] Download a few files and compare their SHA-256 with SHA256SUMS.
- [ ] Every header in section 5 is present (e.g. inspect the response headers in the browser developer tools).
- [ ] A missing page returns 404 with the site's 404.html.
- [ ] No excluded file (credentials, keys, databases, backups) is reachable.
- [ ] Only after all of the above, record the destination as reviewed in your own records. This planner cannot mark anything verified.

## 8. Limitations

- The planner performs no network requests and verifies nothing. Every address and capability is as entered by a person; "ready-for-manual-review" means every required item was declared, not that it was checked.
- Mirrors are separate web origins. Browser storage (cookies, localStorage, sessionStorage, IndexedDB, Cache Storage, service workers) is NOT shared between mirrors; data saved on one mirror is invisible on another.
- Serving a site over Tor or I2P protects the connection between visitor and mirror only. It does not make blockchain or cryptocurrency transactions anonymous: on-chain data remains public and linkable.
- Onion and I2P addresses can only be created by the operator's own Tor or I2P software. The planner never generates keys, identities or addresses, and never starts or configures any service.
- Exported plans exclude credentials, private keys, databases and backups. Excluded files are listed by path and reason only; their bytes are never read into the plan or bundle.
- Site bytes are never modified. Base paths are a server setting; links inside the site are not rewritten.

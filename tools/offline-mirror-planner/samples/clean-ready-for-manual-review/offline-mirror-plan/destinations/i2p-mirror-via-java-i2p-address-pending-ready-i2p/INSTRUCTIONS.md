# Operator instructions — I2P mirror via Java I2P, address pending (sample)

> **PLANNING ARTIFACT ONLY. Generated offline by the Replikrazy Offline Mirror Planner. Nothing was uploaded, published, registered, deployed or verified. No network request was made. Every address and capability in this plan was entered by a person and is unverified.**

- Destination type: I2P site (server tunnel)
- State: **ready-for-manual-review** — Ready for manual review (user-declared, not verified)
- Verified by planner: **no** (the planner never verifies anything)
- Address status: pending-operator-generation
- Effective base URL: not known yet
- Base path: `/`
- Site: Lantern Community Library (fictional demo) — 14 files, 3.9 KiB
- Manifest SHA-256 (of SHA256SUMS): `22b732ca46e5b57cfdf7e44d757d6245744c7f2105b675c3ec30d54735403e7c`
- Plan generated: 2026-10-27T00:00:00.000Z

## 1. Open items before anything else

- [ ] Operator action: Address will be created by the operator's own I2P router and entered later. The planner never creates it.
- [ ] Review: 1 file(s) reference external hosts. On I2P site (server tunnel) those requests would leave the overlay network or fail. Prefer self-contained pages.

## 2. Declared capabilities (user-declared, unverified)

| Capability | Requirement | Declared by user | Status |
|---|---|---|---|
| Serves files byte-for-byte (no minify, injection or rewriting) | required | yes | declared-supported |
| Can send the plan's custom response headers | required | yes | declared-supported |
| Sends correct Content-Type for every file extension in the site | required | yes | declared-supported |
| Serves index.html for directory URLs | required | yes | declared-supported |
| Can serve the site under the chosen base path | not-applicable | n/a | n/a |
| Can use the site's own 404.html | recommended | yes | declared-supported |
| Serves over HTTPS with a valid certificate | not-applicable | n/a | n/a |
| Operator controls access-log retention | recommended | yes | declared-supported |
| Per-file size limit accommodates the largest site file | not-applicable | n/a | n/a |
| File-count limit accommodates the site | not-applicable | n/a | n/a |

Check each "unknown" item against the destination's own documentation or configuration. Do not assume support.

## 3. Prepare the files (byte-for-byte)

1. Use the exported bundle's `site/` folder, or the original source folder. Do not edit, minify, re-encode or "optimise" any file.
2. Verify every file against the manifest before copying: `cd site && sha256sum -c ../SHA256SUMS` (on macOS: `shasum -a 256 -c ../SHA256SUMS`). Every line must say OK.
3. No files were excluded as sensitive.
4. Copy the files so that `index.html` is served at `/`.

## 4. Configure this destination

1. Set up the local web server first. It must listen only on `127.0.0.1:8080`.
2. Install the I2P router (Java I2P) from its official distribution, following its documentation.
3. In the router console's Hidden Services Manager, create an HTTP server tunnel using the values in `java-i2p-tunnel-values.txt`.
4. The router creates the destination keys on your machine. Back them up offline and encrypted; never put them in the site folder, plan, bundle or repository.
5. Read the .b32.i2p address from the router and enter it in the planner (address mode "entered") to regenerate these instructions.
- Avoid external resources; they would leave I2P or fail.

## 5. Required response headers

| Header | Value | Source |
|---|---|---|
| X-Content-Type-Options | `nosniff` | plan |
| Referrer-Policy | `no-referrer` | plan |
| Content-Security-Policy | `default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'` | plan |
| Permissions-Policy | `camera=(), microphone=(), geolocation=()` | plan |
| Cross-Origin-Opener-Policy | `same-origin` | plan |

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
- `java-i2p-tunnel-values.txt` — inert text for review; nothing was applied.

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

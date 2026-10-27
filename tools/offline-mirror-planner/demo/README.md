# Demo data

"Lantern Field Notes" is a small **synthetic** static site: an invented
community notebook. All text is made up. It uses only reserved example domains
(`example.org`, `example.com`, `example.net`). It names no real people or
organisations and holds no real onion or I2P addresses. It exists so the
planner has something realistic to inventory without a real site.

- `site/`: the demo site (23 files, about 16 KB).
- `sample-destinations.json`: five user-declared destination records
  (DESIGN.md 4.2).
- `../src/demo-data.js`: **generated** from both of the above by
  `npm run build:demo` (`scripts/build-demo-data.js`). Do not edit it by hand.
  `node scripts/build-demo-data.js --check` exits 1 if it is stale.
  `tests/unit/demo-data.test.js` also checks that it is in sync.

## Site files

| Path | Purpose |
|------|---------|
| `index.html` | front page; relative links plus root-relative `href="/notes/"` |
| `404.html` | custom error page; root-relative `/assets/css/site.css` and `/` |
| `robots.txt` | crawler hints |
| `.well-known/security.txt` | contact `mailto:security@example.org`, expires 2027 (kept: `.well-known/` is allowed) |
| `about/index.html` | sub-folder index; root-relative `src="/assets/img/lantern.svg"` |
| `notes/index.html` | sub-folder index |
| `notes/first-light.html` | entry page; relative links only |
| `notes/river-survey.html` | entry page; external `https://cdn.example.com/lib.js` and `https://images.example.net/x.png` |
| `assets/css/site.css` | stylesheet; root-relative `url(/assets/img/lantern.svg)` |
| `assets/js/theme.js` | light/dark toggle, remembered in `localStorage` |
| `assets/img/lantern.svg` | icon (its `xmlns` is an XML namespace, not a fetch) |
| `assets/img/pixel.png` | real 1x1 PNG (70 bytes) |
| `assets/fonts/README.txt` | placeholder; no font files shipped |
| `downloads/field-guide.txt` | plain-text download (about 2 KB) |

## Decoys (the planner must exclude them)

Each decoy is a short plain-text file that starts with
`DEMO DECOY - not a real secret. Planner must exclude this file.` None of them
holds key, certificate, token or database material. They exist to show the
exclusion rules from DESIGN.md 4.6 working on realistic file names.

| Path | Expected category |
|------|-------------------|
| `.env` | `credential` (also a hidden file) |
| `.DS_Store` | `os-metadata` (also a hidden file) |
| `private/backup-2026-09.sql` | `database` / `backup` |
| `data/subscribers.sqlite` | `database` |
| `onion-service/hs_ed25519_secret_key` | `private-key` |
| `i2p-keys/eepPriv.dat` | `private-key` |
| `keys/server.pem` | `private-key` |
| `cgi/contact.php` | `server-side-code` |
| `notes/draft.html.bak` | `backup` |

The exact category for each file is decided by `src/core/inventory.js`. This
table shows the intended match.

## Warnings the site should trigger

- **Root-relative references** (`/notes/`, `/assets/...`, `url(/assets/...)`)
  in `index.html`, `404.html`, `about/index.html` and `site.css`. These break
  when a destination uses a non-root `basePath` (see `lan-server`).
- **External references** in `notes/river-survey.html`
  (`cdn.example.com`, `images.example.net`). A mirror will not include them.
- **Excluded files**: the nine decoys above. The export shows counts only.

## Sample destinations and expected status

All values are user-declared examples. The tool checks none of them.

| id | type | expected status | why |
|----|------|-----------------|-----|
| `static-host-a` | static-host | `unverified` | `customHeaders` is `unknown` |
| `static-host-b` | static-host | `blocked` | `customHeaders` is `no` |
| `lan-server` | local-server | `ready-for-manual-review` | every relevant capability `yes`, `basePath` `/field-notes/` with `subpathHosting` `yes` |
| `onion-mirror` | tor-onion | `ready-for-manual-review` | address left `""` (pending); `https` is n/a |
| `i2p-eepsite-draft` | i2p | `incomplete` | required `listen` is empty on purpose |

The `static-host-a` and `static-host-b` statuses assume the plan has at least
one required response header, which makes `customHeaders` required
(DESIGN.md 4.4). No tor or i2p address is ever invented: the operator's own
Tor or I2P software creates it later.

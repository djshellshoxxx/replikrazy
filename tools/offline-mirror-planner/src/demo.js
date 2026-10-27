/*
 * Offline Mirror Planner — built-in synthetic demo.
 * A tiny fictional website plus sample destination records, so every feature
 * can be exercised without supplying files. All content is invented; every
 * address uses reserved example names (RFC 2606) or is left for the operator.
 * "Bait" files demonstrate exclusion and rejection; they contain no real secrets.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./core.js'), require('./destinations.js'), require('./plan.js'));
  } else {
    root.OMP = root.OMP || {};
    root.OMP.demo = factory(root.OMP.core, root.OMP.destinations, root.OMP.plan);
  }
})(typeof self !== 'undefined' ? self : this, function (core, dest, plan) {
  'use strict';

  var ROOT = 'lantern-community-library';

  var PAGE = function (title, body, extraHead) {
    return '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
      '<title>' + title + ' — Lantern Community Library (fictional demo)</title>\n' + (extraHead || '') +
      '</head>\n<body>\n<header><img src="img/logo.svg" alt="" width="48" height="48"> <strong>Lantern Community Library</strong></header>\n' +
      '<main>\n' + body + '\n</main>\n<footer>Fictional demo site generated for the Replikrazy Offline Mirror Planner.</footer>\n</body>\n</html>\n';
  };

  // 1x1 transparent PNG — binary bytes to prove verbatim preservation.
  var PNG_1X1 = [137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84, 120, 156, 99, 0, 1, 0, 0, 5, 0, 1, 13, 10, 45, 180, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130];

  // Built at runtime so no key-like marker appears literally in the source.
  var FAKE_KEY_BLOCK = '-----BEGIN ' + 'OPENSSH PRIVATE' + ' KEY-----\nDEMO-ONLY-NOT-A-REAL-KEY\n-----END ' + 'OPENSSH PRIVATE' + ' KEY-----\n';

  function siteFiles() {
    var enc = function (s) { return core.utf8Encode(s); };
    return [
      { path: 'index.html', bytes: enc(PAGE('Home', '<h1>Welcome</h1>\n<p>Opening hours, reading lists and community notices.</p>\n<p><a href="about/">About us</a> · <a href="catalog/">Catalog</a> · <a href="docs/visiting.txt">Visiting guide</a></p>\n<script src="js/app.js"></script>', '<link rel="stylesheet" href="css/site.css">\n<link rel="manifest" href="site.webmanifest">\n')) },
      { path: 'about/index.html', bytes: enc(PAGE('About', '<h1>About</h1>\n<p>A volunteer-run reading room. <a href="/">Back home</a> (root-absolute link: breaks under a non-root base path).</p>', '<link rel="stylesheet" href="/css/site.css">\n')) },
      { path: 'catalog/index.html', bytes: enc(PAGE('Catalog', '<h1>Catalog</h1>\n<ul id="catalog"></ul>\n<p>Map tiles: <img src="https://tiles.example.net/map.png" alt="external example reference"></p>\n<script src="../js/app.js"></script>', '<link rel="stylesheet" href="../css/site.css">\n')) },
      { path: '404.html', bytes: enc(PAGE('Not found', '<h1>Page not found</h1>\n<p><a href="./">Home</a></p>')) },
      { path: 'css/site.css', bytes: enc('body{font-family:system-ui,sans-serif;margin:2rem auto;max-width:42rem;line-height:1.5}\nheader{display:flex;gap:.5rem;align-items:center}\nfooter{margin-top:3rem;color:#555;font-size:.9rem}\n') },
      { path: 'js/app.js', bytes: enc('// Fictional demo script. Reads the catalog JSON relative to the page.\n(function(){var ul=document.getElementById("catalog");if(!ul)return;fetch("../data/catalog.json").then(function(r){return r.json()}).then(function(d){d.items.forEach(function(i){var li=document.createElement("li");li.textContent=i.title+" — "+i.shelf;ul.appendChild(li);});});})();\n') },
      { path: 'data/catalog.json', bytes: enc(JSON.stringify({ items: [{ title: 'Field Guide to Night Moths', shelf: 'B2' }, { title: 'Bread Without Ovens', shelf: 'C1' }, { title: 'A Short History of Lanterns', shelf: 'A4' }] }, null, 2) + '\n') },
      { path: 'img/logo.svg', bytes: enc('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><circle cx="24" cy="24" r="20" fill="#f2b632"/><rect x="20" y="10" width="8" height="28" rx="3" fill="#7a4b00"/></svg>\n') },
      { path: 'img/pixel.png', bytes: new Uint8Array(PNG_1X1) },
      { path: 'docs/visiting.txt', bytes: enc('Visiting guide (fictional)\r\nWindows line endings are kept exactly as they are.\r\n') },
      { path: 'site.webmanifest', bytes: enc('{"name":"Lantern Community Library (demo)","start_url":"./","display":"browser"}\n') },
      { path: 'downloads/reading-list-2026.csv', bytes: enc('title,shelf\nField Guide to Night Moths,B2\n') },
      { path: 'fonts/Ünïcode-név.txt', bytes: enc('Non-ASCII file name, NFC-normalised.\n') }
    ];
  }

  // Files that must be excluded or rejected; contents are harmless fakes.
  function baitFiles() {
    var enc = function (s) { return core.utf8Encode(s); };
    return [
      { path: '.env', bytes: enc('DEMO_ONLY=this-is-not-a-real-secret\n') },
      { path: '.git/config', bytes: enc('[core]\n\tbare = false\n') },
      { path: '.DS_Store', bytes: new Uint8Array([0, 0, 0, 1, 66, 117, 100, 49]) },
      { path: 'db/members.sqlite', bytes: enc('SQLite format 3\u0000 (demo placeholder, not a database)') },
      { path: 'backup/site-2026-01.zip', bytes: enc('PK demo placeholder') },
      { path: 'index.html.bak', bytes: enc('<!-- old copy -->\n') },
      { path: 'keys/hidden_service/hs_ed25519_secret_key', bytes: enc('demo placeholder, not key material\n') },
      { path: 'notes/ops-handoff.txt', bytes: enc('Ops notes (demo).\n' + FAKE_KEY_BLOCK) },
      { path: 'wallet.dat', bytes: enc('demo placeholder\n') }
    ];
  }

  // Entries a real file system would not normally produce; shown as rejected.
  function unsafeEntries() {
    var enc = function (s) { return core.utf8Encode(s); };
    return [
      { path: '../outside-the-site.txt', bytes: enc('traversal attempt (demo)\n') },
      { path: 'images/CON.txt', bytes: enc('reserved device name (demo)\n') }
    ];
  }

  /**
   * Inventory entries for the demo, shaped like folder-picker input
   * (all paths under one top-level folder, which buildInventory strips).
   * options.includeBait (default true), options.includeUnsafe (default true)
   */
  function entries(options) {
    options = options || {};
    var list = siteFiles();
    if (options.includeBait !== false) list = list.concat(baitFiles());
    if (options.includeUnsafe !== false) list = list.concat(unsafeEntries());
    return list.map(function (f) {
      var bytes = f.bytes;
      return { path: ROOT + '/' + f.path, size: bytes.byteLength, read: function () { return Promise.resolve(bytes); }, bytes: bytes };
    });
  }

  function settings() {
    var s = plan.defaultSettings();
    s.siteLabel = 'Lantern Community Library (fictional demo)';
    return s;
  }

  /** Sample destination records — fictional, user-declared, unverified. */
  function destinations() {
    return [
      dest.createDestination('local-server', {
        id: 'demo-local',
        label: 'Operator laptop nginx (demo)',
        notes: 'Fictional sample record. Serves the files locally and is the target for the onion and I2P tunnels.',
        config: { serverSoftware: 'nginx', listenAddress: '127.0.0.1:8080', documentRoot: '/srv/replikrazy-mirror', publicUrl: '' },
        capabilities: { 'byte-exact-delivery': 'yes', 'custom-headers': 'yes', 'content-type-control': 'yes', 'directory-index': 'yes', 'custom-404': 'yes', 'log-retention-control': 'yes' }
      }),
      dest.createDestination('generic-static', {
        id: 'demo-static',
        label: 'Example static host (fictional)',
        basePath: '/library/',
        notes: 'Fictional provider. Capabilities left unknown until checked against the provider\'s own documentation.',
        config: { providerName: 'Example Static Host (fictional)', address: 'https://mirror.example.com/library/', deployMethod: 'Manual upload through the provider dashboard (operator only)', declaredMaxFileBytes: '26214400', declaredMaxFiles: '20000' },
        capabilities: { 'byte-exact-delivery': 'yes', 'custom-headers': 'unknown', 'content-type-control': 'yes', 'directory-index': 'yes', 'subdirectory-base-path': 'yes', 'custom-404': 'no', 'tls-https': 'yes', 'log-retention-control': 'unknown' }
      }),
      dest.createDestination('tor-onion', {
        id: 'demo-onion',
        label: 'Onion mirror (address pending)',
        notes: 'The onion address does not exist yet; the operator\'s own Tor will create it.',
        config: { addressMode: 'pending-operator', address: '', localTarget: '127.0.0.1:8080', virtualPort: '80', hiddenServiceDir: '/var/lib/tor/replikrazy-mirror/' },
        capabilities: { 'byte-exact-delivery': 'yes', 'custom-headers': 'yes', 'content-type-control': 'yes', 'directory-index': 'yes', 'custom-404': 'yes', 'log-retention-control': 'yes' }
      }),
      dest.createDestination('i2p', {
        id: 'demo-i2p',
        label: 'I2P mirror (needs tunnel name)',
        notes: 'Deliberately incomplete to show missing configuration.',
        config: { router: 'i2pd', addressMode: 'pending-operator', address: '', localTarget: '127.0.0.1:8080', tunnelName: '', keysFile: 'replikrazy-mirror.dat' },
        capabilities: { 'byte-exact-delivery': 'yes', 'custom-headers': 'unknown', 'content-type-control': 'unknown', 'directory-index': 'unknown' }
      })
    ];
  }

  return { ROOT: ROOT, entries: entries, siteFiles: siteFiles, baitFiles: baitFiles, unsafeEntries: unsafeEntries, settings: settings, destinations: destinations };
});

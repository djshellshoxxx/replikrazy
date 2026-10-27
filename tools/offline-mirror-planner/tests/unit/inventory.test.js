'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { core, demo, sha, entries, inventory, toBytes } = require('./_helpers.js');

const CRLF = 'line one\r\nline two\r\n\r\nno final newline';
const LATIN1 = new Uint8Array([0x63, 0x61, 0x66, 0xe9, 0x0a, 0xff, 0xfe, 0x00, 0x80]); // invalid UTF-8
const BOM = new Uint8Array([0xef, 0xbb, 0xbf, 0x68, 0x69, 0x0d, 0x0a]);
const UTF16 = new Uint8Array([0xff, 0xfe, 0x68, 0x00, 0x69, 0x00]);
const BIN = new Uint8Array(4096).map((_, i) => (i * 131 + 7) & 0xff);

test('inventory hashes equal an independent node:crypto SHA-256 of the exact bytes', async () => {
  const spec = [
    ['index.html', '<!doctype html><p>hi</p>\n'],
    ['crlf.txt', CRLF],
    ['crlf.html', CRLF],
    ['latin1.txt', LATIN1],
    ['latin1.css', LATIN1],
    ['bom.txt', BOM],
    ['utf16.txt', UTF16],
    ['empty.txt', new Uint8Array(0)],
    ['empty', new Uint8Array(0)],
    ['bin.png', BIN],
    ['noext', BIN],
    ['zero.json', new Uint8Array([0x7b, 0x00, 0x7d])],
    ['lone-cr.txt', 'a\rb\r']
  ];
  const es = entries(spec);
  const inv = await core.buildInventory(es, { stripRoot: false });
  assert.strictEqual(inv.rejected.length, 0, JSON.stringify(inv.rejected));
  assert.strictEqual(inv.excluded.length, 0, JSON.stringify(inv.excluded));
  for (const e of es) {
    const f = inv.files.find((x) => x.path === e.path);
    assert.ok(f, e.path);
    assert.strictEqual(f.sha256, sha(e.bytes), e.path);
    assert.strictEqual(f.size, e.bytes.byteLength);
    assert.match(f.sha256, /^[0-9a-f]{64}$/);
  }
  assert.strictEqual(inv.files.find((f) => f.path === 'empty.txt').sha256, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  // read() buffers were not modified in place
  assert.deepStrictEqual(Array.from(es.find((e) => e.path === 'latin1.txt').bytes), Array.from(LATIN1));
});

test('inventory accepts ArrayBuffer and Uint8Array subarray views and hashes only the view', async () => {
  const backing = new Uint8Array([9, 9, 1, 2, 3, 9, 9]);
  const view = backing.subarray(2, 5);
  const ab = new Uint8Array([4, 5, 6]).buffer;
  const inv = await core.buildInventory([
    { path: 'view.bin', size: 3, read: () => Promise.resolve(view) },
    { path: 'ab.bin', size: 3, read: () => Promise.resolve(ab) },
    { path: 'sync.bin', size: 3, read: () => new Uint8Array([7, 8, 9]) } // non-promise return
  ], { stripRoot: false });
  assert.strictEqual(inv.files.find((f) => f.path === 'view.bin').sha256, sha([1, 2, 3]));
  assert.strictEqual(inv.files.find((f) => f.path === 'ab.bin').sha256, sha([4, 5, 6]));
  assert.strictEqual(inv.files.find((f) => f.path === 'sync.bin').sha256, sha([7, 8, 9]));
});

test('manifestSha256 is the SHA-256 of the exact SHA256SUMS text; sums are sorted, LF-only, two-space format', async () => {
  const inv = await inventory({ 'b.txt': 'b', 'a/z.txt': 'z', 'A.txt': 'A', 'index.html': 'i' });
  const sums = core.buildSha256Sums(inv.files);
  assert.strictEqual(inv.manifestSha256, sha(new TextEncoder().encode(sums)));
  assert.ok(!sums.includes('\r'));
  const lines = sums.split('\n');
  assert.strictEqual(lines.pop(), '');
  const paths = lines.map((l) => { const m = /^([0-9a-f]{64})  (.+)$/.exec(l); assert.ok(m, l); return m[2]; });
  assert.deepStrictEqual(paths, paths.slice().sort());
});

test('demo inventory: hashes match the demo bytes; CRLF demo file kept; non-ASCII name kept', async () => {
  const es = demo.entries({ includeBait: false, includeUnsafe: false });
  const inv = await core.buildInventory(es);
  assert.strictEqual(inv.rootFolder, demo.ROOT);
  for (const e of es) {
    const rel = e.path.slice(demo.ROOT.length + 1);
    const f = inv.files.find((x) => x.path === rel);
    assert.ok(f, rel);
    assert.strictEqual(f.sha256, sha(e.bytes), rel);
  }
  const crlf = es.find((e) => e.path.endsWith('visiting.txt'));
  assert.ok(Buffer.from(crlf.bytes).includes('\r\n'));
});

// ------------------------------------------------------------------ limits

test('limits: file count over the (tightened) limit rejects the whole input without reading anything', async () => {
  const es = entries([['a', '1'], ['b', '2'], ['c', '3']]);
  await assert.rejects(core.buildInventory(es, { limits: { maxFiles: 2 }, stripRoot: false }), (e) => e.code === 'TOO_MANY_FILES');
  assert.ok(es.every((e) => e.reads === 0));
  const ok = entries([['a', '1'], ['b', '2']]);
  const inv = await core.buildInventory(ok, { limits: { maxFiles: 2 }, stripRoot: false });
  assert.strictEqual(inv.files.length, 2);
});

test('limits: per-file size limit is inclusive and over-size files are not read', async () => {
  const es = entries([['ok.bin', new Uint8Array(10)], ['big.bin', new Uint8Array(11)]]);
  const inv = await core.buildInventory(es, { limits: { maxFileBytes: 10 }, stripRoot: false });
  assert.deepStrictEqual(inv.files.map((f) => f.path), ['ok.bin']);
  assert.ok(inv.rejected.some((r) => r.path === 'big.bin' && r.category === 'too-large'));
  assert.strictEqual(es.readsFor('big.bin'), 0);
});

test('limits: total size limit is enforced across files; excluded/rejected files do not count', async () => {
  const es = entries([['a.bin', new Uint8Array(6)], ['b.bin', new Uint8Array(4)], ['c.bin', new Uint8Array(1)], ['.env', new Uint8Array(100)]]);
  const inv = await core.buildInventory(es, { limits: { maxTotalBytes: 10, maxFileBytes: 200 }, stripRoot: false });
  assert.deepStrictEqual(inv.files.map((f) => f.path), ['a.bin', 'b.bin']);
  assert.ok(inv.rejected.some((r) => r.path === 'c.bin' && r.category === 'total-limit'));
  assert.strictEqual(inv.totals.totalBytes, 10);
  assert.strictEqual(es.readsFor('c.bin'), 0);
});

test('limits: the limits option can only tighten, never loosen, and ignores junk values', async () => {
  const L = core.LIMITS;
  const big = { path: 'x.bin', size: L.maxFileBytes + 1, reads: 0, read() { this.reads++; return Promise.resolve(new Uint8Array(0)); } };
  const inv = await core.buildInventory([big], { limits: { maxFileBytes: L.maxFileBytes * 10, maxTotalBytes: Infinity }, stripRoot: false });
  assert.strictEqual(inv.files.length, 0);
  assert.strictEqual(inv.rejected[0].category, 'too-large');
  assert.strictEqual(big.reads, 0);
  for (const junk of [{ maxFiles: -1 }, { maxFiles: NaN }, { maxFiles: '1' }, { maxFiles: null }, null, 'x']) {
    const r = await core.buildInventory(entries([['a', '1'], ['b', '2']]), { limits: junk, stripRoot: false });
    assert.strictEqual(r.files.length, 2, JSON.stringify(junk));
  }
  assert.ok(Object.isFrozen(core.LIMITS));
});

test('limits: real maxFiles is enforced (5001 entries)', async () => {
  const es = Array.from({ length: core.LIMITS.maxFiles + 1 }, (_, i) => ({ path: 'f' + i, size: 0, read() { throw new Error('must not read'); } }));
  await assert.rejects(core.buildInventory(es), (e) => e.code === 'TOO_MANY_FILES');
});

test('5000 synchronously-rejected/excluded entries do not overflow the stack', async () => {
  const es = [];
  for (let i = 0; i < 2500; i++) es.push({ path: 'r/../bad' + i, size: 1, read() { throw new Error('no'); } });
  for (let i = 0; i < 2500; i++) es.push({ path: 'r/.git/obj' + i, size: 1, read() { throw new Error('no'); } });
  const inv = await core.buildInventory(es);
  assert.strictEqual(inv.rejected.length + inv.excluded.length, 5000);
});

test('a read() returning a different length than size is rejected (shorter and longer)', async () => {
  const inv = await core.buildInventory([
    { path: 'short.txt', size: 10, read: () => Promise.resolve(new Uint8Array(9)) },
    { path: 'long.txt', size: 10, read: () => Promise.resolve(new Uint8Array(11)) },
    { path: 'exact.txt', size: 10, read: () => Promise.resolve(new Uint8Array(10)) }
  ], { stripRoot: false });
  assert.deepStrictEqual(inv.files.map((f) => f.path), ['exact.txt']);
  assert.deepStrictEqual(inv.rejected.map((r) => r.category).sort(), ['read-mismatch', 'read-mismatch']);
  assert.strictEqual(inv.totals.totalBytes, 10);
});

test('read errors (rejection, sync throw, non-Error, missing read) are reported, not thrown', async () => {
  const inv = await core.buildInventory([
    { path: 'rej.txt', size: 1, read: () => Promise.reject(new Error('EACCES')) },
    { path: 'throw.txt', size: 1, read: () => { throw new Error('boom'); } },
    { path: 'str.txt', size: 1, read: () => Promise.reject('plain string') },
    { path: 'none.txt', size: 1 },
    { path: 'ok.txt', size: 1, read: () => Promise.resolve(new Uint8Array([65])) }
  ], { stripRoot: false });
  assert.deepStrictEqual(inv.files.map((f) => f.path), ['ok.txt']);
  assert.strictEqual(inv.rejected.filter((r) => r.category === 'read-error').length, 4);
  assert.ok(inv.rejected.some((r) => /EACCES/.test(r.reason)));
});

test('invalid sizes and hostile entry objects are rejected, not thrown', async () => {
  const sizes = [-1, 1.5, NaN, Infinity, '3', null, undefined, {}];
  const es = sizes.map((s, i) => ({ path: 'f' + i + '.txt', size: s, read() { throw new Error('no'); } }));
  es.push(null, 42, 'string', { path: 42, size: 1 }, { path: { toString: () => 'x' }, size: 1 });
  const inv = await core.buildInventory(es, { stripRoot: false });
  assert.strictEqual(inv.files.length, 0);
  assert.strictEqual(inv.rejected.length, es.length);
});

test('whole-input errors: non-array and empty input reject with PlannerError codes', async () => {
  await assert.rejects(core.buildInventory('nope'), (e) => e.code === 'BAD_INPUT' && e.name === 'PlannerError');
  await assert.rejects(core.buildInventory({ length: 1 }), (e) => e.code === 'BAD_INPUT');
  await assert.rejects(core.buildInventory([]), (e) => e.code === 'EMPTY');
});

test('onProgress exceptions are swallowed', async () => {
  const inv = await core.buildInventory(entries([['a.txt', 'x']]), { stripRoot: false, onProgress() { throw new Error('ui'); } });
  assert.strictEqual(inv.files.length, 1);
});

// ------------------------------------------------------------ sensitive files

const SENSITIVE = [
  '.env', '.env.local', '.env.production', 'config/.env', '.envrc', '.npmrc', '.pypirc', '.netrc', '_netrc', '.htpasswd', '.git-credentials', '.dockercfg',
  'credentials', 'credentials.json', 'secrets.yaml', 'secret.txt', 'service-account.json', 'service_account.json', 'app.secret', 'x.secrets',
  '.git/config', '.git/HEAD', 'sub/.git/objects/ab/cdef', '.git', '.svn/entries', '.hg/store/x', '.bzr/x', '_darcs/x',
  '.aws/credentials', '.ssh/known_hosts', '.ssh/config', '.gnupg/pubring.kbx', '.docker/config.json', '.kube/config', '.config/x',
  'server.pem', 'tls.key', 'cert.p12', 'cert.pfx', 'store.jks', 'a.keystore', 'putty.ppk', 'key.asc', 'x.gpg', 'x.pgp', 'vault.kdbx', 'old.kdb',
  'id_rsa', 'id_rsa.pub', 'id_ed25519', 'id_ecdsa', 'id_dsa', 'ID_RSA',
  'hs_ed25519_secret_key', 'hs_ed25519_public_key', 'private_key', 'client_keys', 'authorized_clients', 'onion_v3_private_key',
  'keys.dat', 'mirror-keys.dat', 'privatekeys.dat', 'eepsite-keys.dat', 'eepsite.dat', 'router.keys', 'router.keys.dat',
  'hidden_service/hostname', 'onion_service/hostname', 'hs_mirror/hostname', 'tor-keys/x', 'i2p-keys/x', 'i2pd-keys/y',
  'wallet.dat', 'my.wallet', 'seed.txt', 'seedphrase.txt', 'mnemonic.txt',
  'data.sqlite', 'data.sqlite3', 'x.db', 'x.db3', 'dump.sql', 'dump.sql.gz', 'x.dump', 'x.mdb', 'x.accdb', 'x.frm', 'x.ibd', 'x.myd', 'x.ldb', 'x.rdb',
  'x.db-wal', 'x.db-shm', 'x-journal',
  'index.html.bak', 'x.backup', 'x.old', 'x.orig', '.x.swp', '.x.swo', 'x.tmp', 'index.html~', '#index.html#',
  'site-backup.zip', 'backup.tar.gz', 'db-dump.7z', 'snapshot-2026.tgz', 'bkp.rar',
  'backup/index.html', 'backups/a.css', 'bak/x', '.backup/x',
  '.DS_Store', 'sub/.ds_store', 'Thumbs.db', 'desktop.ini', '._index.html', '.Spotlight-V100', '.Trashes',
  // Case variants
  '.ENV', 'Wallet.DAT', 'SERVER.PEM', '.GIT/config'
];

test('sensitive files are excluded WITHOUT read(), with a category and reason, and never hashed', async () => {
  const spec = SENSITIVE.map((p) => [p, 'CANARY-SENSITIVE-' + p]).concat([['index.html', '<p>ok']]);
  const es = entries(spec);
  const inv = await core.buildInventory(es, { stripRoot: false });
  assert.deepStrictEqual(inv.files.map((f) => f.path), ['index.html']);
  const excludedPaths = inv.excluded.map((x) => x.path);
  for (const p of SENSITIVE) {
    assert.ok(excludedPaths.includes(p), 'not excluded: ' + p);
    assert.strictEqual(es.readsFor(p), 0, 'read() called for ' + p);
  }
  for (const x of inv.excluded) {
    assert.ok(x.category && x.reason, JSON.stringify(x));
    assert.strictEqual(x.sha256, undefined);
    assert.match(x.reason, /not read/);
    assert.deepStrictEqual(Object.keys(x).sort(), ['category', 'path', 'reason', 'size']);
  }
  assert.ok(!JSON.stringify(inv).includes('CANARY-SENSITIVE'));
});

test('the i2pd keys file name the planner itself suggests (replikrazy-mirror.dat) is excluded without read()', { todo: 'ENGINE-BUG: onion-or-i2p-key rule only matches *key(s).dat/eepsite*.dat; the default keysFile "replikrazy-mirror.dat" (and any custom tunnel .dat) is read, hashed and bundled' }, async () => {
  const es = entries([['replikrazy-mirror.dat', new Uint8Array([1, 2, 3])], ['mirror.dat', new Uint8Array([4])], ['index.html', 'x']]);
  const inv = await core.buildInventory(es, { stripRoot: false });
  assert.deepStrictEqual(inv.files.map((f) => f.path), ['index.html']);
  assert.strictEqual(es.readsFor('replikrazy-mirror.dat'), 0);
});

test('ordinary site files are not mis-classified as sensitive', () => {
  for (const p of ['index.html', 'environment.html', 'about/env.html', 'keyboard.css', 'monkey.png', 'docs/keys.html', 'secretary.html',
    'gitignore.txt', '.gitignore', '.well-known/security.txt', '.htaccess', 'database.html', 'old-news.html', 'wallets.html', 'tor/index.html',
    'img/hs.png', 'backup.html', 'data.json', 'credentials.html']) {
    assert.strictEqual(core.classifySensitivePath(p), null, p);
  }
});

const PEM = '-----BEGIN ' + 'RSA PRIVATE KEY-----\nMIIBOgIBAAJBAKj34GkxFhD90vcNLYLInFEX6Ppy1tPf9Cnzj4p4WGeKLs1Pt8Qu\n-----END ' + 'RSA PRIVATE KEY-----\n';
const SECRET_CONTENTS = {
  pem: PEM,
  openssh: '-----BEGIN ' + 'OPENSSH PRIVATE KEY-----\nb3Blbg==\n',
  ec: '-----BEGIN ' + 'EC PRIVATE KEY-----',
  plain: '-----BEGIN ' + 'PRIVATE KEY-----',
  encrypted: '-----BEGIN ' + 'ENCRYPTED PRIVATE KEY-----',
  pgp: '-----BEGIN PGP ' + 'PRIVATE KEY BLOCK-----',
  tor: '== ed25519v1-' + 'secret: type0 ==\u0000\u0000binary',
  aws: 'aws_key = AKIA' + 'IOSFODNN7EXAMPLE;',
  gh: 'token: ghp_' + 'a'.repeat(18) + 'B'.repeat(18),
  slack: 'xoxb-' + '123456789012-abcdefghij',
  db: 'DATABASE_URL=postgres://admin:' + 'hunter2@db.internal/app'
};

test('files whose content contains private keys or tokens are excluded (no hash), for text extensions and extensionless files', async () => {
  const spec = [];
  for (const [k, v] of Object.entries(SECRET_CONTENTS)) {
    spec.push(['s/' + k + '.txt', v], ['s/' + k + '.html', '<p>' + v + '</p>'], ['s/' + k + '.js', '// ' + v], ['s/' + k, v]);
  }
  spec.push(['index.html', 'clean']);
  const inv = await inventory(spec);
  assert.deepStrictEqual(inv.files.map((f) => f.path), ['index.html']);
  for (const [p] of spec.slice(0, -1)) {
    const x = inv.excluded.find((e) => e.path === p);
    assert.ok(x, 'not excluded: ' + p);
    assert.strictEqual(x.category, 'secret-content');
    assert.strictEqual(x.sha256, undefined);
  }
  // Reasons never echo the secret itself
  const s = JSON.stringify(inv);
  assert.ok(!s.includes('hunter2') && !s.includes('AKIAIOSFODNN7EXAMPLE') && !s.includes('MIIBOgIBAAJB'));
});

test('a secret in a non-UTF-8 text file is still detected', async () => {
  const bytes = new Uint8Array([0xff, 0xfe, 0x80].concat(Array.from(Buffer.from(PEM))));
  const inv = await inventory({ 'notes.txt': bytes });
  assert.strictEqual(inv.excluded.length, 1);
});

test('private keys / tokens in files with other extensions (.yml, .conf, .php, .ini, .sh, .py, .toml, .bin) are excluded', { todo: 'ENGINE-BUG: buildInventory only scans TEXT_EXTENSIONS and extensionless files for secrets; config/script files with keys are published with a hash' }, async () => {
  const spec = ['config.yml', 'config.yaml', 'nginx.conf', 'wp-config.php', 'settings.ini', 'deploy.sh', 'settings.py', 'app.toml', 'blob.bin', 'page.php']
    .map((p) => [p, 'x: 1\n' + PEM]);
  const inv = await inventory(spec);
  assert.deepStrictEqual(inv.files.map((f) => f.path), [], 'published despite key block: ' + inv.files.map((f) => f.path).join(', '));
});

test('file extension "constructor"/"__proto__" yields a string media type', { todo: 'ENGINE-BUG: MEDIA_TYPES/TEXT_EXTENSIONS are plain objects; mediaTypeFor("x.constructor") returns the Object function and "x.__proto__" returns Object.prototype' }, async () => {
  assert.strictEqual(typeof core.mediaTypeFor('x.constructor'), 'string');
  assert.strictEqual(typeof core.mediaTypeFor('x.__proto__'), 'string');
  const inv = await inventory({ 'a.constructor': 'x', 'b.__proto__': 'y', 'c.tostring': 'z' });
  for (const f of inv.files) assert.strictEqual(typeof f.mediaType, 'string', f.path);
});

test('media types: common extensions, case-insensitive, unknown → octet-stream, dotfiles have no extension', () => {
  assert.strictEqual(core.mediaTypeFor('a/INDEX.HTML'), 'text/html; charset=utf-8');
  assert.strictEqual(core.mediaTypeFor('x.js'), 'text/javascript; charset=utf-8');
  assert.strictEqual(core.mediaTypeFor('x.svg'), 'image/svg+xml');
  assert.strictEqual(core.mediaTypeFor('x.wasm'), 'application/wasm');
  assert.strictEqual(core.mediaTypeFor('x.unknownext'), 'application/octet-stream');
  assert.strictEqual(core.mediaTypeFor('.htaccess'), 'application/octet-stream');
  assert.strictEqual(core.extensionOf('.htaccess'), '');
  assert.strictEqual(core.extensionOf('a.tar.gz'), 'gz');
  assert.strictEqual(core.extensionOf('dir.d/noext'), '');
});

test('content analysis flags root-absolute links and external hosts without echoing whole URLs', async () => {
  const inv = await inventory({
    'index.html': '<a href="/abs">x</a><img src="https://cdn.example.net/a.png?token=CANARYQ">',
    'rel.html': '<a href="rel/">x</a><a href="//proto.example.org/x">',
    'a.css': 'body{background:url(/img/x.png)}'
  });
  const idx = inv.files.find((f) => f.path === 'index.html');
  assert.deepStrictEqual(idx.flags.sort(), ['external-references', 'root-absolute-links']);
  assert.deepStrictEqual(inv.rootAbsoluteLinkFiles.sort(), ['a.css', 'index.html']);
  assert.ok(inv.externalReferenceFiles.includes('rel.html'));
  assert.ok(!inv.files.find((f) => f.path === 'rel.html').flags.includes('root-absolute-links'), 'protocol-relative is not root-absolute');
  assert.ok(!JSON.stringify(inv).includes('CANARYQ'), 'external URL query string must not be copied into the inventory');
});

test('missing index.html / 404.html produce warnings', async () => {
  const inv = await inventory({ 'a.txt': 'x' });
  assert.ok(inv.warnings.some((w) => /index\.html/.test(w.message)));
  assert.ok(inv.warnings.some((w) => /404\.html/.test(w.message)));
});

test('scanFieldForSecrets flags key=value credentials, bearer tokens and long mixed keys; leaves prose alone', () => {
  for (const s of ['password = hunter22', 'api_key: abcd1234', 'token=abcdefgh', 'Bearer abcdefghijklmnopqrstuvwxyz', 'secret: s3cr3tvalue',
    'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0', PEM, SECRET_CONTENTS.gh, SECRET_CONTENTS.db]) {
    assert.ok(core.scanFieldForSecrets(s).length > 0, s);
  }
  for (const s of ['Fictional provider. Capabilities left unknown.', 'Manual upload through the dashboard', 'https://mirror.example.com/library/', '']) {
    assert.deepStrictEqual(core.scanFieldForSecrets(s), [], s);
  }
  assert.deepStrictEqual(core.scanFieldForSecrets(null), []);
  assert.deepStrictEqual(core.scanFieldForSecrets({}), []);
});

test('scanFieldForSecrets flags URLs with userinfo (https://user:pass@host) in free text', { todo: 'ENGINE-BUG: scanFieldForSecrets only catches userinfo for db schemes; https://user:pass@host in notes/deployMethod is exported verbatim' }, () => {
  for (const s of ['upload to https://admin:CANARYpw99@ftp.example.com/', 'sftp://deploy:CANARYpw99@host/', 'ftp://u:CANARYpw99@h']) {
    assert.ok(core.scanFieldForSecrets(s).length > 0, s);
  }
});

test('toBytes sanity (helper)', () => { assert.deepStrictEqual(Array.from(toBytes('é')), [0xc3, 0xa9]); });

'use strict';
// Unit tests: sha256, path validation, sensitive-file rules, zip writer.

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const sha256 = require('../../src/core/sha256.js');
const paths = require('../../src/core/paths.js');
const zip = require('../../src/core/zip.js');

const nodeHash = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

test('sha256: known vectors', () => {
  assert.equal(sha256.sha256HexSync(new Uint8Array(0)), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(sha256.sha256HexSync('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(
    sha256.sha256HexSync('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'),
    '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1'
  );
});

test('sha256: pure JS matches node:crypto across block boundaries', () => {
  for (const len of [1, 55, 56, 63, 64, 65, 119, 120, 1000, 4097]) {
    const buf = crypto.randomBytes(len);
    assert.equal(sha256.sha256HexSync(new Uint8Array(buf)), nodeHash(buf), 'len ' + len);
  }
});

test('sha256: async path agrees with sync path', async () => {
  const buf = new Uint8Array(crypto.randomBytes(3000));
  assert.equal(await sha256.sha256Hex(buf), sha256.sha256HexSync(buf));
});

test('paths: accepts normal relative paths', () => {
  for (const p of ['index.html', 'assets/css/site.css', '.well-known/security.txt', 'a b/c.txt', 'ünïcode/ok.html']) {
    assert.equal(paths.validateRelativePath(p).ok, true, p);
  }
});

test('paths: rejects unsafe paths', () => {
  const cases = {
    '': 'path-empty',
    '/etc/passwd': 'path-absolute',
    '../secret': 'path-traversal',
    'a/../../b': 'path-traversal',
    './a': 'path-traversal',
    'a//b': 'path-empty-segment',
    'a/': 'path-empty-segment',
    'a\\b': 'path-backslash',
    'C:/x': 'path-drive',
    'a\u0000b': 'path-control-char',
    'a\nb': 'path-control-char',
    'a\u2028b': 'path-control-char',
    'file://x/y': 'path-url'
  };
  for (const [p, code] of Object.entries(cases)) {
    const r = paths.validateRelativePath(p);
    assert.equal(r.ok, false, JSON.stringify(p));
    assert.ok(r.errors.some((e) => e.code === code), JSON.stringify(p) + ' expected ' + code + ' got ' + JSON.stringify(r.errors));
  }
  assert.equal(paths.validateRelativePath('x'.repeat(513)).ok, false);
  assert.equal(paths.validateRelativePath(Array(34).fill('d').join('/')).ok, false);
  assert.equal(paths.validateRelativePath('a/' + 'y'.repeat(256)).ok, false);
  assert.equal(paths.validateRelativePath(42).ok, false);
});

test('paths: warns on portability problems without rejecting', () => {
  const r = paths.validateRelativePath('docs/CON.txt');
  assert.equal(r.ok, true);
  assert.ok(r.warnings.some((w) => w.code === 'path-windows-reserved'));
  assert.ok(paths.validateRelativePath('a b.html').warnings.some((w) => w.code === 'path-whitespace'));
});

test('paths: base path validation', () => {
  assert.deepEqual(paths.validateBasePath('').value, '/');
  assert.equal(paths.validateBasePath('/').ok, true);
  assert.equal(paths.validateBasePath('/mirror/').ok, true);
  assert.equal(paths.validateBasePath('/a/b-c_d.e~f/').ok, true);
  for (const bad of ['mirror/', '/mirror', '/../', '/a//b/', '/a b/', '/a/./', '/%2e%2e/', '/' + 'x'.repeat(200) + '/']) {
    assert.equal(paths.validateBasePath(bad).ok, false, bad);
  }
});

test('paths: sensitive classification', () => {
  const expect = {
    '.git/config': 'vcs-metadata',
    'sub/.svn/entries': 'vcs-metadata',
    '.env': 'credential',
    'config/.env.production': 'credential',
    '.htpasswd': 'credential',
    'secrets.json': 'credential',
    'vault.kdbx': 'credential',
    '.ssh/known_hosts': 'credential',
    'keys/id_ed25519': 'private-key',
    'tls/server.key': 'private-key',
    'tls/cert.pem': 'private-key',
    'hs/hs_ed25519_secret_key': 'private-key',
    'i2p/eepPriv.dat': 'private-key',
    'i2p/mysite-keys.dat': 'private-key',
    'db/app.sqlite3': 'database',
    'dump.sql': 'database',
    'Thumbs.db': 'os-metadata',
    '.DS_Store': 'os-metadata',
    'page.html.bak': 'backup',
    'notes.txt~': 'backup',
    'backups/site.html': 'backup',
    'site-backup.tar.gz': 'backup',
    'contact.php': 'server-side-code',
    '.cache/x.js': 'hidden-file',
    'assets/.hidden.css': 'hidden-file',
    '.well-known/.secret': 'hidden-file'
  };
  for (const [p, cat] of Object.entries(expect)) {
    const r = paths.classifySensitive(p);
    assert.ok(r, p + ' should be excluded');
    assert.equal(r.category, cat, p);
  }
  for (const ok of ['index.html', '.well-known/security.txt', 'how-to-backup.html', 'downloads/guide.zip', 'img/keyhole.png', 'assets/keys.js']) {
    assert.equal(paths.classifySensitive(ok), null, ok);
  }
});

test('paths: content types and kinds', () => {
  assert.equal(paths.contentTypeFor('a/b.HTML'), 'text/html; charset=utf-8');
  assert.equal(paths.contentTypeFor('x.svg'), 'image/svg+xml');
  assert.equal(paths.contentTypeFor('font.woff2'), 'font/woff2');
  assert.equal(paths.contentTypeFor('unknown.bin'), 'application/octet-stream');
  assert.equal(paths.kindFor('a.css'), 'css');
  assert.equal(paths.kindFor('a.png'), 'image');
  assert.equal(paths.slugify('  Hello, World!  '), 'hello-world');
  assert.equal(paths.slugify('***', 'fallback'), 'fallback');
});

test('zip: crc32 known value', () => {
  assert.equal(zip.crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
});

test('zip: archive is readable by system unzip / python and byte-exact', () => {
  const bin = new Uint8Array(crypto.randomBytes(777));
  const files = [
    { name: 'README.txt', data: 'hello\n' },
    { name: 'instructions/a.md', data: '# ü\n' },
    { name: 'bin/data.bin', data: bin }
  ];
  const out = zip.createZip(files, { date: new Date('2026-10-27T12:34:56Z') });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'omp-zip-'));
  const zp = path.join(dir, 'x.zip');
  fs.writeFileSync(zp, out);
  const py = [
    'import sys, zipfile, hashlib, json',
    'z = zipfile.ZipFile(sys.argv[1])',
    'assert z.testzip() is None',
    'print(json.dumps({i.filename: hashlib.sha256(z.read(i)).hexdigest() for i in z.infolist()}))'
  ].join('\n');
  const listed = JSON.parse(execFileSync('python3', ['-I', '-c', py, zp]).toString());
  assert.deepEqual(Object.keys(listed), ['README.txt', 'instructions/a.md', 'bin/data.bin']);
  assert.equal(listed['bin/data.bin'], nodeHash(Buffer.from(bin)));
  assert.equal(listed['instructions/a.md'], nodeHash(Buffer.from('# ü\n')));
  // Deterministic for the same input and date.
  assert.deepEqual(zip.createZip(files, { date: new Date('2026-10-27T12:34:56Z') }), out);
});

test('zip: rejects unsafe or duplicate names', () => {
  assert.throws(() => zip.createZip([{ name: '../x', data: 'a' }]), /Unsafe/);
  assert.throws(() => zip.createZip([{ name: '/abs', data: 'a' }]), /Unsafe/);
  assert.throws(() => zip.createZip([{ name: 'a', data: 'a' }, { name: 'a', data: 'b' }]), /Duplicate/);
  assert.throws(() => zip.createZip([]), /Nothing/);
});

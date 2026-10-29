'use strict';
// Unit tests: inventory pre-checks, exclusion, hashing and site analysis.

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const inventory = require('../../src/core/inventory.js');
const demo = require('../../src/demo-data.js');

const SITE_DIR = path.join(__dirname, '..', '..', 'demo', 'site');
const enc = new TextEncoder();

function entry(p, text) {
  const bytes = typeof text === 'string' ? enc.encode(text) : text;
  return { path: p, size: bytes.length, getBytes: async () => bytes };
}

// Fake private-key header built at runtime so no key-like text sits in the repo.
const PEM_HEADER = '-----BEGIN ' + 'PRIVATE KEY-----';

test('inventory: demo build hashes match files on disk and excludes decoys', async () => {
  const inv = await inventory.build(inventory.entriesFromDemo(demo), { label: demo.siteLabel, source: 'demo' });
  assert.equal(inv.stats.fileCount, 14);
  assert.equal(inv.excluded.length, 9);
  assert.equal(inv.rejected.length, 0);
  for (const f of inv.files) {
    const disk = fs.readFileSync(path.join(SITE_DIR, f.path));
    assert.equal(f.size, disk.length, f.path);
    assert.equal(f.sha256, crypto.createHash('sha256').update(disk).digest('hex'), f.path);
  }
  const included = inv.files.map((f) => f.path);
  for (const decoy of ['.env', '.DS_Store', 'cgi/contact.php', 'data/subscribers.sqlite', 'i2p-keys/eepPriv.dat',
    'keys/server.pem', 'notes/draft.html.bak', 'onion-service/hs_ed25519_secret_key', 'private/backup-2026-09.sql']) {
    assert.ok(!included.includes(decoy), decoy + ' must not be included');
    assert.ok(inv.excluded.some((e) => e.path === decoy), decoy + ' must be listed as excluded');
  }
  assert.ok(included.includes('.well-known/security.txt'));
  const codes = inv.warnings.map((w) => w.code);
  for (const c of ['external-reference', 'root-relative-reference', 'browser-storage-usage', 'excluded-files']) {
    assert.ok(codes.includes(c), 'missing warning ' + c);
  }
  const ext = inv.warnings.find((w) => w.code === 'external-reference');
  assert.deepEqual(ext.hosts, ['cdn.example.com', 'images.example.net']);
  assert.ok(!ext.hosts.includes('www.w3.org'), 'namespace URIs are not fetches');
  assert.deepEqual(inv.facts, {
    hasRootIndex: true, hasAnyIndex: true, has404: true, rootRelativeRefCount: 5,
    externalHosts: ['cdn.example.com', 'images.example.net'], usesBrowserStorage: true
  });
  assert.deepEqual(included, included.slice().sort());
});

test('inventory: limits are enforced before any byte is read', async () => {
  let reads = 0;
  const lazy = (p, size) => ({ path: p, size, getBytes: async () => { reads++; return new Uint8Array(size); } });
  const limits = Object.assign({}, inventory.LIMITS, { maxFiles: 3, maxTotalBytes: 100, maxFileBytes: 60, maxEntriesScanned: 10 });

  await assert.rejects(inventory.build(Array.from({ length: 11 }, (_, i) => lazy('f' + i + '.txt', 1)), { limits }), { code: 'too-many-entries' });
  await assert.rejects(inventory.build(Array.from({ length: 4 }, (_, i) => lazy('f' + i + '.txt', 1)), { limits }), { code: 'too-many-files' });
  await assert.rejects(inventory.build([lazy('a.txt', 50), lazy('b.txt', 51)], { limits }), { code: 'too-large' });
  await assert.rejects(inventory.build([], { limits }), { code: 'no-entries' });
  assert.equal(reads, 0, 'nothing may be read when a fatal limit trips');

  const inv = await inventory.build([lazy('index.html', 10), lazy('big.bin', 61)], { limits });
  assert.equal(reads, 1);
  assert.deepEqual(inv.rejected.map((r) => r.code), ['file-too-large']);
});

test('inventory: invalid, duplicate and mismatched entries are rejected with clear codes', async () => {
  const inv = await inventory.build([
    entry('index.html', '<p>hi</p>'),
    entry('../escape.html', 'x'),
    entry('/abs.html', 'x'),
    entry('index.html', 'dup'),
    { path: 'liar.txt', size: 99, getBytes: async () => enc.encode('short') },
    { path: 'broken.txt', size: 3, getBytes: async () => { throw new Error('disk gone'); } },
    { path: 'nosize.txt', size: -1, getBytes: async () => enc.encode('') }
  ]);
  const byPath = Object.fromEntries(inv.rejected.map((r) => [r.path, r.code]));
  assert.equal(byPath['../escape.html'], 'path-traversal');
  assert.equal(byPath['/abs.html'], 'path-absolute');
  assert.equal(byPath['index.html'], 'duplicate-path');
  assert.equal(byPath['liar.txt'], 'size-mismatch');
  assert.equal(byPath['broken.txt'], 'read-failed');
  assert.equal(byPath['nosize.txt'], 'size-unknown');
  assert.deepEqual(inv.files.map((f) => f.path), ['index.html']);
  assert.ok(inv.warnings.some((w) => w.code === 'rejected-files'));
});

test('inventory: content that looks like a private key is excluded', async () => {
  const inv = await inventory.build([
    entry('index.html', '<p>ok</p>'),
    entry('notes/readme.txt', 'see below\n' + PEM_HEADER + '\nAAAA\n'),
    entry('img/blob.png', new Uint8Array([...enc.encode('== ed25519v1-secret: type0 =='), 0, 1, 2]))
  ]);
  assert.deepEqual(inv.files.map((f) => f.path), ['index.html']);
  assert.deepEqual(inv.excluded.map((e) => [e.path, e.category]), [['img/blob.png', 'secret-content'], ['notes/readme.txt', 'secret-content']]);
});

test('inventory: analysis of references and storage', () => {
  const a = inventory.analyzeText('p.html',
    '<html xmlns="http://www.w3.org/1999/xhtml"><link href="/a.css"><img src="//cdn.example.com/x.png">' +
    '<script src="https://js.example.net/a.js"></script><a href="sub/">x</a><base href="/m/"><script>localStorage.x=1;document.cookie</script>');
  assert.deepEqual(a.externalHosts, ['cdn.example.com', 'js.example.net']);
  assert.equal(a.rootRelativeRefs, 2);
  assert.equal(a.hasBaseTag, true);
  assert.deepEqual(a.storageApis, ['document.cookie', 'localStorage']);
  const css = inventory.analyzeText('s.css', 'a{background:url(/img/a.png)} @import "/x.css"; b{background:url("https://fonts.example.org/f")}');
  assert.equal(css.rootRelativeRefs, 2);
  assert.deepEqual(css.externalHosts, ['fonts.example.org']);
  const txt = inventory.analyzeText('readme.txt', 'see https://example.org and /root');
  assert.deepEqual(txt.externalHosts, [], 'plain text is not scanned for references');
});

test('inventory: case collisions, archives and no root index are reported', async () => {
  const inv = await inventory.build([
    entry('docs/Readme.html', 'a'),
    entry('docs/readme.html', 'b'),
    entry('downloads/pack.zip', new Uint8Array([80, 75, 5, 6]))
  ]);
  const codes = inv.warnings.map((w) => w.code);
  assert.ok(codes.includes('case-collision'));
  assert.ok(codes.includes('archive-review'));
  assert.ok(codes.includes('no-root-index'));
  assert.equal(inv.facts.hasRootIndex, false);
});

test('inventory: entriesFromFileList strips the selected root folder', async () => {
  const fakeFile = (rel, text) => ({
    webkitRelativePath: rel, name: rel.split('/').pop(), size: enc.encode(text).length,
    arrayBuffer: async () => enc.encode(text).buffer
  });
  const { rootName, entries } = inventory.entriesFromFileList([fakeFile('my-site/index.html', 'x'), fakeFile('my-site/a/b.css', 'yy')]);
  assert.equal(rootName, 'my-site');
  assert.deepEqual(entries.map((e) => e.path), ['index.html', 'a/b.css']);
  const inv = await inventory.build(entries);
  assert.equal(inv.stats.totalBytes, 3);
});

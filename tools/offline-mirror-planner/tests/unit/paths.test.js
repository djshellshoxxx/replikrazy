'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { core, entries } = require('./_helpers.js');

const { validateRelativePath: vrp, stripCommonRoot, normaliseBasePath, pathAdvisories } = core;

function rejects(p, why) {
  const r = vrp(p);
  assert.strictEqual(r.ok, false, (why || '') + ' should reject ' + JSON.stringify(p));
  assert.ok(typeof r.reason === 'string' && r.reason.length > 0);
}
function accepts(p) {
  const r = vrp(p);
  assert.deepStrictEqual(r, { ok: true, path: p }, 'should accept ' + JSON.stringify(p) + ' got ' + JSON.stringify(r));
}

test('validateRelativePath: traversal segments are rejected', () => {
  for (const p of ['..', '.', '../a', 'a/..', 'a/../b', './a', 'a/./b', 'a/.', '../../etc/passwd', 'a/b/../../..']) rejects(p, 'traversal');
});

test('validateRelativePath: percent-encoded traversal is kept as a literal name, not decoded, and flagged', () => {
  // These are literal file names on disk; they must not be decoded into "..".
  for (const p of ['%2e%2e/a.txt', 'a/%2E%2E/b', '%2e/x', '..%2fetc', '%252e%252e/x']) {
    const r = vrp(p);
    assert.strictEqual(r.ok, true, p);
    assert.strictEqual(r.path, p, 'path must not be rewritten');
    assert.ok(pathAdvisories(p).some((m) => /percent-encoded/.test(m)), 'advisory for ' + p);
  }
  // Dot-only variants that are not exactly "." or ".." end in a dot → rejected as non-portable.
  rejects('.../x'); rejects('a/....');
});

test('validateRelativePath: absolute paths, drive letters, UNC and backslashes are rejected', () => {
  for (const p of ['/etc/passwd', '/', '//server/share', 'C:/x', 'c:x', 'C:\\x', 'Z:', '\\\\server\\share', 'a\\b', '..\\x', 'a/b\\..\\..\\c']) rejects(p);
});

test('validateRelativePath: NUL, C0/C1 controls, DEL, line/paragraph separators and bidi overrides are rejected', () => {
  const bad = ['\u0000', '\u0001', '\t', '\n', '\r', '\u001b', '\u007f', '\u0085', '\u009f', '\u2028', '\u2029',
    '\u202a', '\u202b', '\u202c', '\u202d', '\u202e', '\u2066', '\u2067', '\u2068', '\u2069'];
  for (const c of bad) {
    rejects('a' + c + 'b.txt', 'U+' + c.charCodeAt(0).toString(16));
    rejects('dir' + c + '/x.txt');
    rejects(c);
  }
  rejects('invoice\u202egpj.exe');
});

test('validateRelativePath: empty input, empty segments and trailing slash are rejected', () => {
  for (const p of ['', 'a//b', 'a/', '/a', 'a/b/', '//']) rejects(p);
  for (const p of [null, undefined, 42, {}, ['a']]) assert.strictEqual(vrp(p).ok, false);
});

test('validateRelativePath: trailing dot or space in any segment is rejected', () => {
  for (const p of ['a.', 'a ', 'dir./x', 'dir /x', 'x/y.', 'x/y ']) rejects(p);
  accepts('.htaccess'); accepts('a/.well-known/b'); accepts(' leading-space-ok.txt');
});

test('validateRelativePath: Windows reserved device names are rejected in any segment, any case, with extensions', () => {
  for (const n of ['CON', 'con', 'Prn', 'AUX', 'NUL', 'COM1', 'com9', 'LPT1', 'lpt9', 'nul.txt', 'CON.tar.gz', 'aux.html']) {
    rejects(n); rejects('dir/' + n); rejects(n + '/x.html');
  }
  accepts('console.html'); accepts('auxiliary/x'); accepts('nullable.js'); accepts('company/x');
});

test('validateRelativePath: non-portable characters <>:"|?* are rejected', () => {
  for (const c of ['<', '>', ':', '"', '|', '?', '*']) rejects('a' + c + 'b');
  rejects('file.txt:ads'); // NTFS alternate data stream
});

test('validateRelativePath: length, segment length and depth limits (inclusive boundaries)', () => {
  const L = core.LIMITS;
  accepts('a'.repeat(L.maxSegmentLength));
  rejects('a'.repeat(L.maxSegmentLength + 1));
  // Max total length exactly
  const segs = [];
  let s = '';
  while (s.length + 201 <= L.maxPathLength) { segs.push('b'.repeat(200)); s = segs.join('/'); }
  const exact = s + '/' + 'c'.repeat(L.maxPathLength - s.length - 1);
  assert.strictEqual(exact.length, L.maxPathLength);
  accepts(exact);
  rejects(exact + 'c');
  const deep = Array(L.maxPathDepth).fill('d').join('/');
  accepts(deep);
  rejects(deep + '/d');
  rejects('x'.repeat(1e6)); // huge input must be a fast rejection
});

test('validateRelativePath: non-NFC Unicode is rejected; NFC is accepted unchanged', () => {
  const nfc = 'caf\u00e9.html';
  const nfd = 'cafe\u0301.html';
  accepts(nfc);
  rejects(nfd);
  rejects('Ångström/x.txt'.normalize('NFD'));
  accepts('Ünïcode-név.txt'.normalize('NFC'));
});

test('buildInventory: duplicates and case collisions are rejected (not silently merged)', async () => {
  const es = entries([['a.txt', 'one'], ['a.txt', 'two'], ['A.TXT', 'three'], ['index.html', 'x']]);
  const inv = await core.buildInventory(es, { stripRoot: false });
  assert.strictEqual(inv.files.filter((f) => f.path === 'a.txt').length, 1);
  assert.ok(inv.rejected.some((r) => r.path === 'a.txt' && r.category === 'duplicate'));
  assert.strictEqual(es[1].reads, 0, 'duplicate must not be read');
  // Lead decision: a case collision would overwrite a file when a bundle is extracted on
  // macOS/Windows, so it is a blocking rejection rather than a warning.
  assert.ok(inv.rejected.some((r) => r.path === 'A.TXT' && r.category === 'case-collision' && /letter case/.test(r.reason)));
  assert.ok(!inv.files.some((f) => f.path === 'A.TXT'));
});

test('buildInventory: unsafe paths are rejected without read() and never hashed', async () => {
  const bad = ['../x.txt', '/abs.txt', 'C:/x.txt', 'a\\b.txt', 'a\u0000b', 'a\u202eb.txt', 'a//b', 'CON.txt', 'x.', 'cafe\u0301.txt'];
  const es = entries(bad.map((p) => [p, 'data']).concat([['ok.txt', 'ok']]));
  const inv = await core.buildInventory(es, { stripRoot: false });
  assert.deepStrictEqual(inv.files.map((f) => f.path), ['ok.txt']);
  assert.strictEqual(inv.rejected.length, bad.length);
  for (const e of es.slice(0, bad.length)) assert.strictEqual(e.reads, 0, 'read() called for ' + JSON.stringify(e.path));
  for (const r of inv.rejected) {
    assert.strictEqual(r.category, 'unsafe-path');
    assert.strictEqual(r.sha256, undefined);
  }
});

test('buildInventory: rejected display paths escape EVERY control/bidi character', async () => {
  const p = 'a\u202eb\u202ec\u0000d\u2066.txt';
  const inv = await core.buildInventory(entries([[p, 'x']]), { stripRoot: false });
  const shown = inv.rejected[0].path;
  assert.ok(!/[\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/.test(shown), 'raw control char survived: ' + JSON.stringify(shown));
  assert.ok(!/[\u202a-\u202e\u2066-\u2069]/.test(core.safeDisplay('x\u202ey\u202ez')));
});

test('stripCommonRoot: strips only a single genuinely shared top folder', () => {
  assert.deepStrictEqual(stripCommonRoot(['site/a', 'site/b/c']), { root: 'site', paths: ['a', 'b/c'] });
  assert.deepStrictEqual(stripCommonRoot([]), { root: '', paths: [] });
  // Not shared
  assert.deepStrictEqual(stripCommonRoot(['site/a', 'other/b']).root, '');
  // One file at top level → nothing stripped
  assert.deepStrictEqual(stripCommonRoot(['site/a', 'b']).root, '');
  // Absolute paths: no stripping (idx 0)
  assert.deepStrictEqual(stripCommonRoot(['/a', '/b']).root, '');
  // Prefix-but-not-folder must not count as shared ("site" vs "site2")
  assert.deepStrictEqual(stripCommonRoot(['site/a', 'site2/b']).root, '');
  // Only one level stripped
  assert.deepStrictEqual(stripCommonRoot(['a/b/c', 'a/b/d']), { root: 'a', paths: ['b/c', 'b/d'] });
  // Input array is not mutated
  const input = ['r/x', 'r/y'];
  stripCommonRoot(input);
  assert.deepStrictEqual(input, ['r/x', 'r/y']);
});

test('stripCommonRoot / buildInventory: a ".." (or ".", drive letter, control-char) top segment is not stripped, so traversal entries stay rejected', async () => {
  for (const top of ['..', '.', 'C:', 'a\u202eb', '']) {
    const r = stripCommonRoot([top + '/a.txt', top + '/b.txt']);
    assert.strictEqual(r.root, '', 'stripped unsafe root ' + JSON.stringify(top));
  }
  const es = entries([['../index.html', '<p>x'], ['../secret.txt', 'y']]);
  const inv = await core.buildInventory(es);
  assert.strictEqual(inv.files.length, 0, 'traversal entries were accepted: ' + inv.files.map((f) => f.path));
  assert.strictEqual(inv.rejected.length, 2);
});

test('buildInventory: sensitive classification also applies to the stripped root folder', async () => {
  const es = entries([['.git/config', '[remote]\nurl=x'], ['.git/HEAD', 'ref: refs/heads/main'], ['.git/index.html', 'x']]);
  const inv = await core.buildInventory(es);
  assert.strictEqual(inv.files.length, 0, 'files from a selected .git folder were included: ' + inv.files.map((f) => f.path));
  for (const e of es) assert.strictEqual(e.reads, 0);
});

test('normaliseBasePath: canonical forms', () => {
  const ok = { '': '/', '/': '/', '  ': '/', site: '/site/', '/site': '/site/', '/site/': '/site/', 'a/b': '/a/b/', '/a-b_c.d/': '/a-b_c.d/' };
  for (const [i, o] of Object.entries(ok)) assert.deepStrictEqual(normaliseBasePath(i), { ok: true, basePath: o }, JSON.stringify(i));
  assert.deepStrictEqual(normaliseBasePath(undefined), { ok: true, basePath: '/' });
  assert.deepStrictEqual(normaliseBasePath(null), { ok: true, basePath: '/' });
  // Segments must start with a letter or digit ("~user" can map to Apache UserDir; "..." is confusing).
  for (const b of ['/~root/', '/.../', '/.hidden/', '/-x/']) assert.strictEqual(normaliseBasePath(b).ok, false, b);
});

test('normaliseBasePath: rejects traversal, empty segments, encoded and odd characters', () => {
  const bad = ['..', '/..', '/a/../b', '/./', '.', '//', '/a//b/', '%2e%2e', '/a%20b/', '/a b/', '/a\\b/', '/a?b', '/a#b', '/a;b',
    '/a\u0000/', '/a\n/', '/\u202e/', '/caf\u00e9/', '/a"/', "/a'/", '/a<b>/', 'http://evil/', '/$x/', '/{x}/', '/a\t/',
    'a'.repeat(core.LIMITS.maxBasePathLength + 1), 5, {}, []];
  for (const b of bad) {
    const r = normaliseBasePath(b);
    assert.strictEqual(r.ok, false, 'accepted ' + JSON.stringify(b) + ' → ' + JSON.stringify(r));
  }
});

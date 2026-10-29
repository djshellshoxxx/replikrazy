'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { core, zip, plan, demo, GENERATED_AT, cleanDemoInventory, fullDestinations, sha, entries } = require('./_helpers.js');

function hasBin(name) {
  try { execFileSync('sh', ['-c', 'command -v ' + name], { stdio: 'pipe' }); return true; } catch (e) { return false; }
}

const SAMPLES = [
  { path: 'bin/all-bytes.bin', bytes: new Uint8Array(256).map((_, i) => i) },
  { path: 'crlf.txt', bytes: new TextEncoder().encode('a\r\nb\r\n') },
  { path: 'lone-cr.txt', bytes: new TextEncoder().encode('a\rb') },
  { path: 'latin1.txt', bytes: new Uint8Array([0x63, 0x61, 0x66, 0xe9, 0xff, 0xfe, 0x00]) },
  { path: 'bom.html', bytes: new Uint8Array([0xef, 0xbb, 0xbf, 0x3c, 0x70, 0x3e]) },
  { path: 'empty.txt', bytes: new Uint8Array(0) },
  { path: 'deep/er/still/file.css', bytes: new TextEncoder().encode('a{}\n') },
  { path: 'fonts/Ünïcode-név.txt', bytes: new TextEncoder().encode('ü\n') },
  { path: 'big.bin', bytes: new Uint8Array(300000).map((_, i) => (i * 7919) & 0xff) }
];

test('createZip → readStoredZip round trip preserves every byte and path', () => {
  const z = zip.createZip(SAMPLES, { modified: GENERATED_AT });
  const out = zip.readStoredZip(z);
  assert.deepStrictEqual(out.map((e) => e.path), SAMPLES.map((e) => e.path));
  for (let i = 0; i < SAMPLES.length; i++) {
    assert.strictEqual(sha(out[i].bytes), sha(SAMPLES[i].bytes), SAMPLES[i].path);
    assert.strictEqual(out[i].bytes.byteLength, SAMPLES[i].bytes.byteLength);
  }
});

test('createZip is deterministic for a fixed modified date and does not mutate inputs', () => {
  const before = SAMPLES.map((e) => sha(e.bytes));
  const a = zip.createZip(SAMPLES, { modified: GENERATED_AT });
  const b = zip.createZip(SAMPLES, { modified: GENERATED_AT });
  assert.strictEqual(sha(a), sha(b));
  assert.deepStrictEqual(SAMPLES.map((e) => sha(e.bytes)), before);
  // Junk dates fall back to 1980 instead of throwing
  for (const m of ['nope', '1970-01-01T00:00:00Z', undefined, '9999-12-31T23:59:59Z']) assert.doesNotThrow(() => zip.createZip(SAMPLES.slice(0, 1), { modified: m }));
});

test('ZIP entries are STORE (method 0) with the UTF-8 name flag, and CRC32 is correct', () => {
  const z = zip.createZip(SAMPLES, { modified: GENERATED_AT });
  const v = new DataView(z.buffer, z.byteOffset, z.byteLength);
  assert.strictEqual(v.getUint32(0, true), 0x04034b50);
  assert.strictEqual(v.getUint16(6, true) & 0x0800, 0x0800);
  assert.strictEqual(v.getUint16(8, true), 0);
  assert.strictEqual(zip.crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
  assert.strictEqual(zip.crc32(new Uint8Array(0)), 0);
});

test('readStoredZip detects corruption (CRC) and rejects non-ZIP input', () => {
  const z = zip.createZip([{ path: 'a.txt', bytes: new TextEncoder().encode('hello') }]);
  const bad = z.slice();
  bad[30 + 'a.txt'.length] ^= 0xff;
  assert.throws(() => zip.readStoredZip(bad), (e) => e.code === 'ZIP_CRC');
  assert.throws(() => zip.readStoredZip(new Uint8Array(10)), (e) => e.code === 'ZIP_BAD');
});

test('system `unzip` extracts identical bytes and reports no errors', { skip: !hasBin('unzip') && 'unzip not installed' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'omp-zip-'));
  try {
    const zf = path.join(dir, 'b.zip');
    fs.writeFileSync(zf, zip.createZip(SAMPLES, { modified: GENERATED_AT }));
    const t = execFileSync('unzip', ['-t', zf], { encoding: 'utf8' });
    assert.match(t, /No errors detected/);
    execFileSync('unzip', ['-q', zf, '-d', path.join(dir, 'x')]);
    for (const e of SAMPLES) {
      const got = fs.readFileSync(path.join(dir, 'x', e.path));
      assert.strictEqual(sha(got), sha(e.bytes), e.path);
    }
    if (hasBin('zipinfo')) {
      const info = execFileSync('zipinfo', [zf], { encoding: 'utf8' });
      assert.ok(!/defl/.test(info), 'entries must be stored, not deflated');
      assert.match(info, /stor/);
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('full bundle (artifacts + site files) round-trips through createZip and system unzip; site bytes match SHA256SUMS', { skip: !hasBin('unzip') && 'unzip not installed' }, async () => {
  const input = { inventory: await cleanDemoInventory(), destinations: fullDestinations(), settings: demo.settings(), generatedAt: GENERATED_AT };
  const p = plan.buildPlan(input);
  const enc = new TextEncoder();
  const zEntries = plan.exportArtifacts(p, input).map((f) => ({ path: f.path, bytes: enc.encode(f.content) }));
  for (const e of demo.entries({ includeBait: false, includeUnsafe: false })) zEntries.push({ path: 'offline-mirror-plan/site/' + e.path.slice(demo.ROOT.length + 1), bytes: e.bytes });
  const z = zip.createZip(zEntries, { modified: GENERATED_AT });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'omp-bundle-'));
  try {
    fs.writeFileSync(path.join(dir, 'b.zip'), z);
    execFileSync('unzip', ['-q', path.join(dir, 'b.zip'), '-d', dir]);
    if (hasBin('sha256sum')) {
      const out = execFileSync('sha256sum', ['-c', '--strict', '../SHA256SUMS'], { cwd: path.join(dir, 'offline-mirror-plan', 'site'), encoding: 'utf8' });
      assert.ok(out.trim().split('\n').every((l) => / OK$/.test(l)));
    }
    for (const e of zEntries) assert.strictEqual(sha(fs.readFileSync(path.join(dir, e.path))), sha(e.bytes), e.path);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('createZip refuses unsafe entry paths (zip-slip) and duplicates', () => {
  const bad = ['../evil.txt', 'a/../../evil', '/etc/passwd', 'C:/x', 'C:\\x', 'a\\..\\b', '', 'a//b', 'a/', './a', 'a\u0000b', 'a\u202eb', 'CON', 'x.', 'cafe\u0301'];
  for (const p of bad) {
    assert.throws(() => zip.createZip([{ path: p, bytes: new Uint8Array(1) }]), (e) => e.code === 'ZIP_BAD_PATH', JSON.stringify(p));
  }
  for (const p of [null, undefined, 5]) assert.throws(() => zip.createZip([{ path: p, bytes: new Uint8Array(1) }]), (e) => e.code === 'ZIP_BAD_PATH');
  assert.throws(() => zip.createZip([{ path: 'a', bytes: new Uint8Array(1) }, { path: 'a', bytes: new Uint8Array(2) }]), (e) => e.code === 'ZIP_DUP');
});

test('every inventory-accepted site path can be bundled under offline-mirror-plan/site/', async () => {
  const deep = Array(core.LIMITS.maxPathDepth).fill('d').join('/');
  const parts = ['x'.repeat(200), 'y'.repeat(200), 'z'.repeat(200), 'w'.repeat(200)];
  const long = parts.join('/') + '/' + 'v'.repeat(core.LIMITS.maxPathLength - parts.join('/').length - 1);
  assert.strictEqual(long.length, core.LIMITS.maxPathLength);
  const inv = await core.buildInventory(entries([[deep, 'a'], [long, 'b']]), { stripRoot: false });
  assert.strictEqual(inv.files.length, 2);
  for (const f of inv.files) {
    assert.doesNotThrow(() => zip.createZip([{ path: 'offline-mirror-plan/site/' + f.path, bytes: new Uint8Array(1) }]), f.path.slice(0, 40));
  }
});

test('createZip rejects non-binary bytes instead of silently writing an empty file', () => {
  assert.throws(() => zip.createZip([{ path: 'plan.json', bytes: '{"a":1}' }]));
  assert.throws(() => zip.createZip([{ path: 'x', bytes: undefined }]));
});

test('artifact paths from exportArtifacts are all ZIP-safe', async () => {
  const input = { inventory: await cleanDemoInventory(), destinations: demo.destinations().concat(fullDestinations()), settings: demo.settings(), generatedAt: GENERATED_AT };
  for (const f of plan.exportArtifacts(plan.buildPlan(input), input)) {
    assert.ok(core.validateRelativePath(f.path).ok, f.path);
    assert.ok(f.path.startsWith('offline-mirror-plan/'));
  }
});

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const TOOL_ROOT = path.resolve(__dirname, '..', '..');
const SITE_DIR = path.join(TOOL_ROOT, 'demo', 'site');
const DESTINATIONS_FILE = path.join(TOOL_ROOT, 'demo', 'sample-destinations.json');

const demoData = require('../../src/demo-data.js');
const builder = require('../../scripts/build-demo-data.js');

// DESIGN.md 4.2
const DESTINATION_FIELDS = [
  'id', 'name', 'type', 'basePath', 'address', 'providerLabel',
  'serverSoftware', 'listen', 'documentRoot', 'router', 'maxFileMB',
  'capabilities', 'notes',
];
const CAPABILITY_FIELDS = [
  'directoryIndex', 'customHeaders', 'customErrorPages', 'subpathHosting',
  'https', 'correctMimeTypes', 'minimalLogging',
];
const DESTINATION_TYPES = ['static-host', 'local-server', 'tor-onion', 'i2p'];
const CAPABILITY_VALUES = ['yes', 'no', 'unknown'];
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,47}$/;

const DECOYS = [
  '.DS_Store',
  '.env',
  'cgi/contact.php',
  'data/subscribers.sqlite',
  'i2p-keys/eepPriv.dat',
  'keys/server.pem',
  'notes/draft.html.bak',
  'onion-service/hs_ed25519_secret_key',
  'private/backup-2026-09.sql',
];

// Built from pieces so this test file itself never contains the markers.
const PEM_MARKER = '-----' + 'BEGIN';
const KEY_MARKER = 'PRIVATE' + ' KEY';
const TOKEN_PATTERNS = [
  new RegExp('gh' + '[pousr]_[A-Za-z0-9]{20,}'),
  new RegExp('\\bs' + 'k-[A-Za-z0-9_-]{20,}'),
  new RegExp('AK' + 'IA[0-9A-Z]{16}'),
];
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(abs));
    else out.push(path.relative(SITE_DIR, abs).split(path.sep).join('/'));
  }
  return out;
}

function diskBytes(rel) {
  return fs.readFileSync(path.join(SITE_DIR, rel));
}

function isAllowedHost(hostname) {
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
  return ['example.org', 'example.com', 'example.net'].some(
    (d) => hostname === d || hostname.endsWith('.' + d)
  );
}

test('src/demo-data.js matches the builder output exactly', () => {
  const onDisk = fs.readFileSync(builder.OUTPUT_FILE, 'utf8');
  assert.equal(onDisk, builder.generate(), 'run npm run build:demo');
});

test('demo data exposes the expected top-level shape', () => {
  assert.equal(demoData.siteLabel, 'lantern-field-notes');
  assert.equal(typeof demoData.description, 'string');
  assert.match(demoData.description, /synthetic/i);
  assert.ok(Array.isArray(demoData.files));
  assert.ok(Array.isArray(demoData.destinations));
});

test('embedded files have the same path set as demo/site', () => {
  const embedded = demoData.files.map((f) => f.path).sort();
  const onDisk = walk(SITE_DIR).sort();
  assert.deepEqual(embedded, onDisk);
});

test('embedded files are sorted by JS string compare and unique', () => {
  const paths = demoData.files.map((f) => f.path);
  const sorted = [...paths].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  assert.deepEqual(paths, sorted);
  assert.equal(new Set(paths).size, paths.length);
});

test('every embedded file decodes to the exact bytes on disk', () => {
  for (const file of demoData.files) {
    const decoded = Buffer.from(file.base64, 'base64');
    assert.ok(decoded.equals(diskBytes(file.path)), 'bytes differ: ' + file.path);
  }
});

test('site includes the required pages and assets', () => {
  const paths = new Set(demoData.files.map((f) => f.path));
  for (const required of [
    'index.html', '404.html', 'robots.txt', '.well-known/security.txt',
    'about/index.html', 'notes/index.html', 'notes/first-light.html',
    'notes/river-survey.html', 'assets/css/site.css', 'assets/js/theme.js',
    'assets/img/lantern.svg', 'assets/img/pixel.png', 'assets/fonts/README.txt',
    'downloads/field-guide.txt',
  ]) {
    assert.ok(paths.has(required), 'missing ' + required);
  }
  for (const decoy of DECOYS) assert.ok(paths.has(decoy), 'missing decoy ' + decoy);
});

test('site stays small', () => {
  const total = demoData.files.reduce(
    (sum, f) => sum + Buffer.from(f.base64, 'base64').length,
    0
  );
  assert.ok(total < 60 * 1024, 'site is ' + total + ' bytes');
  assert.ok(demoData.files.length >= 18 && demoData.files.length <= 25);
});

test('decoys are obvious fakes with no key or token material', () => {
  for (const decoy of DECOYS) {
    const text = diskBytes(decoy).toString('utf8');
    assert.match(text, /DEMO DECOY - not a real secret/, decoy);
  }
});

test('no site file contains private-key headers or token-shaped strings', () => {
  for (const file of demoData.files) {
    const text = Buffer.from(file.base64, 'base64').toString('latin1');
    assert.ok(!text.includes(PEM_MARKER), file.path + ' contains a PEM header');
    assert.ok(!text.includes(KEY_MARKER), file.path + ' contains a key marker');
    for (const pattern of TOKEN_PATTERNS) {
      assert.ok(!pattern.test(text), file.path + ' matches ' + pattern);
    }
  }
});

test('pixel.png is a real PNG', () => {
  const bytes = diskBytes('assets/img/pixel.png');
  assert.ok(bytes.subarray(0, 8).equals(PNG_SIGNATURE));
  assert.equal(bytes.subarray(12, 16).toString('ascii'), 'IHDR');
});

test('security.txt has a contact on example.org and a 2027 expiry', () => {
  const text = diskBytes('.well-known/security.txt').toString('utf8');
  assert.match(text, /^Contact: mailto:security@example\.org$/m);
  assert.match(text, /^Expires: 2027-/m);
});

test('destinations deep-equal demo/sample-destinations.json', () => {
  const fromJson = JSON.parse(fs.readFileSync(DESTINATIONS_FILE, 'utf8'));
  assert.deepEqual(demoData.destinations, fromJson);
  assert.equal(fromJson.length, 5);
});

test('every destination has exactly the DESIGN 4.2 fields', () => {
  for (const d of demoData.destinations) {
    assert.deepEqual(Object.keys(d).sort(), [...DESTINATION_FIELDS].sort(), d.id);
    assert.deepEqual(Object.keys(d.capabilities).sort(), [...CAPABILITY_FIELDS].sort(), d.id);
    for (const key of CAPABILITY_FIELDS) {
      assert.ok(CAPABILITY_VALUES.includes(d.capabilities[key]), d.id + '.' + key);
    }
    assert.ok(DESTINATION_TYPES.includes(d.type), d.id + ' type');
    assert.ok(d.maxFileMB === null || typeof d.maxFileMB === 'number', d.id + ' maxFileMB');
    for (const key of DESTINATION_FIELDS) {
      if (key !== 'maxFileMB' && key !== 'capabilities') {
        assert.equal(typeof d[key], 'string', d.id + '.' + key);
      }
    }
    assert.ok(d.name.length >= 1 && d.name.length <= 80, d.id + ' name length');
    assert.ok(d.notes.length <= 1000, d.id + ' notes length');
  }
});

test('destination ids are valid and unique', () => {
  const ids = demoData.destinations.map((d) => d.id);
  for (const id of ids) assert.match(id, ID_PATTERN);
  assert.equal(new Set(ids).size, ids.length);
});

test('destination types cover all four kinds', () => {
  const types = new Set(demoData.destinations.map((d) => d.type));
  assert.deepEqual([...types].sort(), [...DESTINATION_TYPES].sort());
});

test('addresses are empty or on example domains / localhost only', () => {
  for (const d of demoData.destinations) {
    if (d.address === '') continue;
    const url = new URL(d.address);
    assert.ok(isAllowedHost(url.hostname), d.id + ' address ' + d.address);
  }
  for (const d of demoData.destinations) {
    if (d.type === 'tor-onion' || d.type === 'i2p') {
      assert.equal(d.address, '', d.id + ' must leave the address pending');
    }
  }
});

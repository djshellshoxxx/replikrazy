'use strict';
// Shared helpers for the unit tests. Not a test file itself (no ".test.js").
const nodeCrypto = require('node:crypto');
const path = require('node:path');

const SRC = path.join(__dirname, '..', '..', 'src');
const core = require(path.join(SRC, 'core.js'));
const dest = require(path.join(SRC, 'destinations.js'));
const plan = require(path.join(SRC, 'plan.js'));
const zip = require(path.join(SRC, 'zip.js'));
const demo = require(path.join(SRC, 'demo.js'));

const GENERATED_AT = '2026-01-02T03:04:05.000Z';

function sha(bytes) {
  return nodeCrypto.createHash('sha256').update(Buffer.from(bytes)).digest('hex');
}

function toBytes(v) {
  if (v instanceof Uint8Array) return v;
  if (Array.isArray(v)) return new Uint8Array(v);
  return new TextEncoder().encode(String(v));
}

/**
 * Entries for buildInventory. spec: { path: content } or [[path, content], ...].
 * Every entry counts read() calls in entry.reads; the returned array has
 * .readsFor(path) for convenience.
 */
function entries(spec, opts) {
  opts = opts || {};
  const pairs = Array.isArray(spec) ? spec : Object.entries(spec);
  const list = pairs.map(([p, content]) => {
    const bytes = toBytes(content);
    const e = {
      path: p,
      size: bytes.byteLength,
      reads: 0,
      bytes,
      read() { e.reads++; return Promise.resolve(bytes); }
    };
    return e;
  });
  list.readsFor = (p) => list.find((e) => e.path === p).reads;
  return list;
}

/** Inventory without root stripping (paths used as given). */
function inventory(spec, options) {
  return core.buildInventory(entries(spec), Object.assign({ stripRoot: false }, options || {}));
}

const ALL_YES = {
  'byte-exact-delivery': 'yes', 'custom-headers': 'yes', 'content-type-control': 'yes',
  'directory-index': 'yes', 'subdirectory-base-path': 'yes', 'custom-404': 'yes',
  'tls-https': 'yes', 'log-retention-control': 'yes'
};

/** Fully configured, fully declared destinations of every type. */
function fullDestinations() {
  return [
    dest.createDestination('local-server', {
      id: 'full-local', label: 'Local nginx',
      config: { serverSoftware: 'nginx', listenAddress: '127.0.0.1:8080', documentRoot: '/srv/mirror', publicUrl: '' },
      capabilities: ALL_YES
    }),
    dest.createDestination('generic-static', {
      id: 'full-static', label: 'Static host',
      config: { providerName: 'Example', address: 'https://mirror.example.com/', deployMethod: 'manual', declaredMaxFileBytes: '100000000', declaredMaxFiles: '100000' },
      capabilities: ALL_YES
    }),
    dest.createDestination('tor-onion', {
      id: 'full-onion', label: 'Onion',
      config: { addressMode: 'pending-operator', address: '', localTarget: '127.0.0.1:8080', virtualPort: '80', hiddenServiceDir: '/var/lib/tor/mirror/' },
      capabilities: ALL_YES
    }),
    dest.createDestination('i2p', {
      id: 'full-i2p', label: 'I2P',
      config: { router: 'i2pd', addressMode: 'pending-operator', address: '', localTarget: '127.0.0.1:8080', tunnelName: 'mirror', keysFile: 'mirror.dat' },
      capabilities: ALL_YES
    })
  ];
}

function cleanDemoInventory() {
  return core.buildInventory(demo.entries({ includeBait: false, includeUnsafe: false }));
}

/** All exported text (plan.json + every artifact) joined. */
function exportAll(input) {
  const p = plan.buildPlan(Object.assign({ generatedAt: GENERATED_AT }, input));
  const files = plan.exportArtifacts(p, input);
  return { plan: p, files, text: files.map((f) => f.path + '\n' + f.content).join('\n\u0000\n') };
}

/** Raw destination record (for sanitizeDestination / import). */
function raw(type, config, extra) {
  return Object.assign({ id: 'r-' + type, type, label: 'L ' + type, basePath: '/', notes: '', config: config || {}, capabilities: {} }, extra || {});
}

module.exports = {
  core, dest, plan, zip, demo, GENERATED_AT, sha, toBytes, entries, inventory,
  ALL_YES, fullDestinations, cleanDemoInventory, exportAll, raw
};

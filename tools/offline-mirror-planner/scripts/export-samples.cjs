#!/usr/bin/env node
/*
 * Regenerates the committed sample exports in samples/ from the built-in demo.
 *   node scripts/export-samples.cjs            write samples/
 *   node scripts/export-samples.cjs --check    verify samples/ is up to date (exit 1 if not)
 * Offline only: reads nothing but this tool's own sources, writes only under samples/.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const core = require('../src/core.js');
const dest = require('../src/destinations.js');
const plan = require('../src/plan.js');
const zip = require('../src/zip.js');
const demo = require('../src/demo.js');

const GENERATED_AT = '2026-10-27T00:00:00.000Z';
const SAMPLES = path.join(__dirname, '..', 'samples');

function readyDestinations() {
  const all = 'yes';
  return [
    dest.createDestination('local-server', {
      id: 'ready-local', label: 'Operator nginx on loopback (sample)',
      notes: 'Fictional sample. Every capability declared by the (fictional) operator.',
      config: { serverSoftware: 'nginx', listenAddress: '127.0.0.1:8080', documentRoot: '/srv/replikrazy-mirror' },
      capabilities: { 'byte-exact-delivery': all, 'custom-headers': all, 'content-type-control': all, 'directory-index': all, 'custom-404': all, 'log-retention-control': all }
    }),
    dest.createDestination('local-server', {
      id: 'ready-caddy', label: 'Operator Caddy under /library/ (sample)', basePath: '/library/',
      config: { serverSoftware: 'caddy', listenAddress: '127.0.0.1:8081', documentRoot: '/srv/replikrazy-mirror-caddy' },
      capabilities: { 'byte-exact-delivery': all, 'custom-headers': all, 'content-type-control': all, 'directory-index': all, 'subdirectory-base-path': all, 'custom-404': all, 'log-retention-control': all }
    }),
    dest.createDestination('tor-onion', {
      id: 'ready-onion', label: 'Onion mirror, address pending (sample)',
      config: { addressMode: 'pending-operator', localTarget: '127.0.0.1:8080', virtualPort: '80', hiddenServiceDir: '/var/lib/tor/replikrazy-mirror/' },
      capabilities: { 'byte-exact-delivery': all, 'custom-headers': all, 'content-type-control': all, 'directory-index': all, 'custom-404': all, 'log-retention-control': all }
    }),
    dest.createDestination('i2p', {
      id: 'ready-i2p', label: 'I2P mirror via Java I2P, address pending (sample)',
      config: { router: 'java-i2p', addressMode: 'pending-operator', localTarget: '127.0.0.1:8080', tunnelName: 'replikrazy-mirror', keysFile: '' },
      capabilities: { 'byte-exact-delivery': all, 'custom-headers': all, 'content-type-control': all, 'directory-index': all, 'custom-404': all, 'log-retention-control': all }
    })
  ];
}

const SCENARIOS = [
  {
    name: 'demo-draft',
    description: 'Built-in demo as shipped: bait files excluded, two unsafe paths rejected, mixed destination states. planState = draft.',
    entries: () => demo.entries(),
    destinations: () => demo.destinations(),
    settings: () => demo.settings()
  },
  {
    name: 'clean-ready-for-manual-review',
    description: 'Clean demo site with fully declared operator-managed destinations. planState = ready-for-manual-review (still unverified).',
    entries: () => demo.entries({ includeBait: false, includeUnsafe: false }),
    destinations: readyDestinations,
    settings: () => demo.settings()
  }
];

async function render(scn) {
  const entries = scn.entries();
  const inventory = await core.buildInventory(entries);
  const destinations = scn.destinations();
  const settings = scn.settings();
  const p = plan.buildPlan({ inventory, destinations, settings, generatedAt: GENERATED_AT });
  const artifacts = plan.exportArtifacts(p, { inventory, destinations, settings });
  const files = new Map();
  for (const a of artifacts) files.set(a.path, Buffer.from(a.content, 'utf8'));
  // Bundle: artifacts + included site files, verbatim, re-hashed before packing.
  const byPath = new Map();
  const stripped = core.stripCommonRoot(entries.map((e) => e.path));
  entries.forEach((e, i) => byPath.set(stripped.paths[i], e));
  const zipEntries = artifacts.map((a) => ({ path: a.path, bytes: core.utf8Encode(a.content) }));
  for (const f of inventory.files) {
    const bytes = new Uint8Array(await byPath.get(f.path).read());
    const h = await core.sha256Hex(bytes);
    if (h !== f.sha256) throw new Error('hash changed for ' + f.path);
    zipEntries.push({ path: 'offline-mirror-plan/site/' + f.path, bytes });
  }
  files.set('offline-mirror-plan-bundle.zip', Buffer.from(zip.createZip(zipEntries, { modified: GENERATED_AT })));
  return { plan: p, files };
}

function writeTree(root, files) {
  for (const [rel, buf] of files) {
    const target = path.join(root, rel);
    if (!target.startsWith(root + path.sep)) throw new Error('refusing to write outside ' + root);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, buf);
  }
}

function listTree(root) {
  const out = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full); else out.push(path.relative(root, full).split(path.sep).join('/'));
    }
  })(root);
  return out.sort();
}

async function main() {
  const check = process.argv.includes('--check');
  const outRoot = check ? fs.mkdtempSync(path.join(os.tmpdir(), 'omp-samples-')) : SAMPLES;
  const index = [];
  for (const scn of SCENARIOS) {
    const { plan: p, files } = await render(scn);
    const dir = path.join(outRoot, scn.name);
    if (!check && fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
    writeTree(dir, files);
    index.push({ name: scn.name, description: scn.description, planState: p.planState, destinations: p.destinations.map((d) => ({ label: d.label, type: d.type, state: d.state })) });
  }
  fs.writeFileSync(path.join(outRoot, 'index.json'), JSON.stringify({ generatedAt: GENERATED_AT, notice: plan.NOTICE, samples: index }, null, 2) + '\n');

  if (check) {
    const a = listTree(outRoot), b = fs.existsSync(SAMPLES) ? listTree(SAMPLES).filter((f) => f !== 'README.md') : [];
    const diffs = [];
    if (a.join('\n') !== b.join('\n')) diffs.push('file list differs');
    for (const f of a) {
      if (b.includes(f) && !fs.readFileSync(path.join(outRoot, f)).equals(fs.readFileSync(path.join(SAMPLES, f)))) diffs.push('content differs: ' + f);
    }
    fs.rmSync(outRoot, { recursive: true });
    if (diffs.length) { console.error('samples/ is out of date:\n  ' + diffs.join('\n  ') + '\nRun: node scripts/export-samples.cjs'); process.exit(1); }
    console.log('samples/ is up to date.');
  } else {
    for (const i of index) console.log(i.name + ': planState=' + i.planState + ' (' + i.destinations.map((d) => d.state).join(', ') + ')');
  }
}

main().catch((e) => { console.error(e && e.stack || e); process.exit(1); });

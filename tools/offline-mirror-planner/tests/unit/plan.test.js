'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { core, dest, plan, demo, GENERATED_AT, fullDestinations, cleanDemoInventory, raw, ALL_YES, sha } = require('./_helpers.js');

function hasBin(name) {
  try { execFileSync('sh', ['-c', 'command -v ' + name], { stdio: 'pipe' }); return true; } catch (e) { return false; }
}

async function readyInput() {
  return { inventory: await cleanDemoInventory(), destinations: fullDestinations(), settings: demo.settings(), generatedAt: GENERATED_AT };
}

test('buildPlan is deterministic for fixed generatedAt (and exportArtifacts too)', async () => {
  const input = await readyInput();
  const a = JSON.stringify(plan.buildPlan(input));
  const b = JSON.stringify(plan.buildPlan(input));
  assert.strictEqual(a, b);
  const fa = plan.exportArtifacts(plan.buildPlan(input), input);
  const fb = plan.exportArtifacts(plan.buildPlan(input), input);
  assert.deepStrictEqual(fa, fb);
  // Input destinations are not mutated by planning.
  const before = JSON.stringify(input.destinations);
  plan.buildPlan(input);
  assert.strictEqual(JSON.stringify(input.destinations), before);
});

test('buildPlan is deterministic even for destination records without a valid id', () => {
  const input = { destinations: [{ type: 'generic-static', label: 'x', config: { address: 'https://m.example/' } }], generatedAt: GENERATED_AT };
  const a = plan.buildPlan(input), b = plan.buildPlan(input);
  assert.ok(JSON.stringify(a) === JSON.stringify(b), 'ids differ between runs: ' + a.destinations[0].id + ' vs ' + b.destinations[0].id);
});

test('exportArtifacts does not crash for destination records without a valid id', () => {
  const input = { destinations: [{ type: 'generic-static', label: 'x', config: {} }], generatedAt: GENERATED_AT };
  const p = plan.buildPlan(input);
  assert.doesNotThrow(() => plan.exportArtifacts(p, input));
});

test('duplicate destination ids: each destination gets its own instructions', async () => {
  const [local] = fullDestinations();
  const broken = dest.sanitizeDestination(raw('generic-static', { address: 'ftp://bad' }, { id: local.id, label: 'Broken static' }));
  const input = { inventory: await cleanDemoInventory(), destinations: [local, broken], settings: demo.settings(), generatedAt: GENERATED_AT };
  const p = plan.buildPlan(input);
  const files = plan.exportArtifacts(p, input);
  const ins = files.filter((f) => f.path.endsWith('INSTRUCTIONS.md'));
  assert.strictEqual(ins.length, 2);
  const brokenIns = ins.find((f) => f.path.includes('broken-static'));
  assert.match(brokenIns.content, /Broken static/);
  assert.match(brokenIns.content, /needs-configuration/);
});

test('planState is ready-for-manual-review only for a clean site with fully declared destinations; verification never performed', async () => {
  const input = await readyInput();
  const p = plan.buildPlan(input);
  assert.strictEqual(p.planState, 'ready-for-manual-review');
  assert.strictEqual(p.verification.performed, false);
  assert.strictEqual(p.verification.networkRequests, 0);
  for (const d of p.destinations) {
    assert.strictEqual(d.verified, false);
    assert.strictEqual(d.state, 'ready-for-manual-review');
  }
  assert.match(p.planStateReasons.join(' '), /manually/);
});

test('planState is draft with reasons for every kind of incompleteness', async () => {
  const base = await readyInput();
  const cases = {
    'no inventory': Object.assign({}, base, { inventory: null }),
    'no destinations': Object.assign({}, base, { destinations: [] }),
    'bait + unsafe site': Object.assign({}, base, { inventory: await core.buildInventory(demo.entries()) }),
    'demo destinations': Object.assign({}, base, { destinations: demo.destinations() }),
    'bad header setting': Object.assign({}, base, { settings: { siteLabel: 'x', headers: [{ name: 'Set-Cookie', value: 'a=b' }] } }),
    'empty site label': Object.assign({}, base, { settings: { siteLabel: '' } }),
    'one unverified destination': Object.assign({}, base, { destinations: fullDestinations().concat([dest.createDestination('local-server', { config: { documentRoot: '/srv/x' } })]) }),
    'one blocked destination': Object.assign({}, base, { destinations: [dest.sanitizeDestination(Object.assign(raw('local-server', { serverSoftware: 'nginx', listenAddress: '127.0.0.1:8080', documentRoot: '/srv/x' }), { capabilities: Object.assign({}, ALL_YES, { 'byte-exact-delivery': 'no' }) }))] }),
    'too many destinations': Object.assign({}, base, { destinations: Array.from({ length: core.LIMITS.maxDestinations + 1 }, (_, i) => Object.assign(JSON.parse(JSON.stringify(fullDestinations()[0])), { id: 'l' + i })) }),
    'all junk destinations': Object.assign({}, base, { destinations: [null, 5, { type: 'x' }] })
  };
  const rejectedOnly = await core.buildInventory([{ path: 'index.html', size: 1, read: () => Promise.reject(new Error('x')) }, { path: 'a.txt', size: 1, read: () => Promise.resolve(new Uint8Array([1])) }], { stripRoot: false });
  cases['read error'] = Object.assign({}, base, { inventory: rejectedOnly });
  for (const [name, input] of Object.entries(cases)) {
    const p = plan.buildPlan(input);
    assert.strictEqual(p.planState, 'draft', name);
    assert.ok(p.planStateReasons.length > 0, name);
    assert.strictEqual(p.verification.performed, false);
  }
});

test('planState draft when inventory has zero publishable files (everything excluded)', async () => {
  const inv = await core.buildInventory([{ path: '.env', size: 1, read() { throw new Error('no'); } }], { stripRoot: false });
  const p = plan.buildPlan({ inventory: inv, destinations: fullDestinations(), settings: demo.settings(), generatedAt: GENERATED_AT });
  assert.strictEqual(p.planState, 'draft');
});

test('buildPlan does not throw for incomplete or junk input', () => {
  for (const input of [{}, { settings: 5 }, { inventory: null, destinations: [{}] }, { destinations: [null, 7, 'x', []] }]) {
    assert.doesNotThrow(() => plan.buildPlan(input), JSON.stringify(input));
  }
});

test('buildPlan does not throw when a local-server Caddy destination has an invalid publicUrl', () => {
  const d = dest.sanitizeDestination(raw('local-server', { serverSoftware: 'caddy', listenAddress: '127.0.0.1:8080', documentRoot: '/srv/x', publicUrl: 'not a url' }));
  const p = plan.buildPlan({ destinations: [d], generatedAt: GENERATED_AT });
  assert.strictEqual(p.destinations[0].state, 'needs-configuration');
});

test('no state string anywhere in the plan claims verified / live / published', async () => {
  const inputs = [await readyInput(), { inventory: await core.buildInventory(demo.entries()), destinations: demo.destinations(), settings: demo.settings(), generatedAt: GENERATED_AT }];
  const bad = (s) => {
    const l = String(s).toLowerCase().replace(/unverified|not verified/g, '');
    return /verified|\blive\b|published/.test(l);
  };
  for (const input of inputs) {
    const p = plan.buildPlan(input);
    assert.ok(!bad(p.planState));
    for (const d of p.destinations) {
      for (const s of [d.state, d.stateLabel, d.addressStatus]) assert.ok(!bad(s), s);
      for (const c of d.capabilities) assert.ok(!bad(c.status) && !bad(c.declared) && !bad(c.level), JSON.stringify(c));
    }
    // Any JSON key/value "verified" must be false
    JSON.stringify(p, (k, v) => { if (/^verified$/i.test(k)) assert.strictEqual(v, false); if (k === 'performed') assert.strictEqual(v, false); return v; });
  }
});

test('plan, README and every INSTRUCTIONS.md state no network/verification and include the browser-storage and blockchain limitations', async () => {
  const input = await readyInput();
  const p = plan.buildPlan(input);
  const files = plan.exportArtifacts(p, input);
  const checks = [/no network request/i, /verif/i, /storage/i, /not shared/i, /blockchain|cryptocurrency/i, /does not make blockchain or cryptocurrency transactions anonymous/i];
  const docs = [JSON.stringify(p)].concat(files.filter((f) => /README-FIRST|INSTRUCTIONS\.md/.test(f.path)).map((f) => f.content));
  assert.ok(docs.length >= 1 + 1 + input.destinations.length);
  for (const d of docs) for (const re of checks) assert.match(d, re);
  assert.ok(p.limitations.some((l) => /localStorage/.test(l) && /IndexedDB/.test(l)));
  for (const f of files.filter((x) => x.path.endsWith('INSTRUCTIONS.md'))) assert.match(f.content, /Verified by planner: \*\*no\*\*/);
});

test('instructions never claim support for a capability the user left unknown', async () => {
  const inv = await cleanDemoInventory();
  const d = dest.createDestination('generic-static', { id: 'u1', label: 'Unknown host', config: { address: 'https://m.example/' } });
  const p = plan.buildPlan({ inventory: inv, destinations: [d], settings: demo.settings(), generatedAt: GENERATED_AT });
  const pd = p.destinations[0];
  for (const c of pd.capabilities) {
    assert.ok(c.declared === 'unknown' || c.declared === 'n/a', JSON.stringify(c));
    assert.ok(!/supported/.test(c.status), JSON.stringify(c));
  }
  const ins = plan.buildInstructions(p, 'u1');
  assert.ok(!/declared-supported|\| yes \|/.test(ins));
  assert.match(ins, /does not know whether this provider supports/);
  assert.strictEqual(pd.state, 'unverified');
});

test('buildInstructions throws a PlannerError for an unknown destination id', async () => {
  const p = plan.buildPlan(await readyInput());
  assert.throws(() => plan.buildInstructions(p, 'nope'), (e) => e.code === 'NO_DEST');
});

// -------------------------------------------------------------- headers

function headersOf(p, id) { return p.destinations.find((d) => d.id === id).requiredHeaders; }
function names(hs) { return hs.map((h) => h.name.toLowerCase()); }

const V3 = 'pg6mmjiyjmcrsslvykfwnntlaru7p5svn6y2ymmju6nubxndf4pscryd.onion';

test('Strict-Transport-Security only for https destinations', () => {
  const ds = [
    dest.sanitizeDestination(raw('generic-static', { address: 'https://s.example/' }, { id: 'https' })),
    dest.sanitizeDestination(raw('generic-static', { address: 'http://s.example/' }, { id: 'http' })),
    dest.sanitizeDestination(raw('local-server', { listenAddress: '127.0.0.1:8080', documentRoot: '/srv/x' }, { id: 'local' })),
    dest.sanitizeDestination(raw('local-server', { listenAddress: '127.0.0.1:8080', documentRoot: '/srv/x', publicUrl: 'https://l.example/' }, { id: 'localhttps' })),
    dest.sanitizeDestination(raw('tor-onion', { addressMode: 'entered', address: V3, hiddenServiceDir: '/var/lib/tor/x' }, { id: 'onion' })),
    dest.sanitizeDestination(raw('i2p', { addressMode: 'entered', address: 'mirror.i2p' }, { id: 'i2p' }))
  ];
  const p = plan.buildPlan({ destinations: ds, settings: plan.defaultSettings(), generatedAt: GENERATED_AT });
  assert.ok(names(headersOf(p, 'https')).includes('strict-transport-security'));
  assert.ok(names(headersOf(p, 'localhttps')).includes('strict-transport-security'));
  for (const id of ['http', 'local', 'onion', 'i2p']) assert.ok(!names(headersOf(p, id)).includes('strict-transport-security'), id);
});

test('HSTS / Onion-Location listed globally never reach onion, I2P or http destinations', () => {
  const settings = { siteLabel: 'x', headers: [{ name: 'Strict-Transport-Security', value: 'max-age=1' }] };
  const ds = [dest.sanitizeDestination(raw('tor-onion', { hiddenServiceDir: '/var/lib/tor/x' }, { id: 'onion' })),
    dest.sanitizeDestination(raw('generic-static', { address: 'http://s.example/' }, { id: 'http' }))];
  const p = plan.buildPlan({ destinations: ds, settings, generatedAt: GENERATED_AT });
  for (const id of ['onion', 'http']) assert.ok(!names(headersOf(p, id)).includes('strict-transport-security'), id);
});

test('Onion-Location only when enabled AND an onion address is entered (mode "entered"), only on https destinations', () => {
  const https = dest.sanitizeDestination(raw('generic-static', { address: 'https://s.example/' }, { id: 'https' }));
  const http = dest.sanitizeDestination(raw('generic-static', { address: 'http://s.example/' }, { id: 'http' }));
  const mk = (cfg) => dest.sanitizeDestination(raw('tor-onion', Object.assign({ hiddenServiceDir: '/var/lib/tor/x' }, cfg), { id: 'onion' }));
  const s = (on) => Object.assign(plan.defaultSettings(), { advertiseOnionLocation: on });
  const run = (onion, on) => plan.buildPlan({ destinations: [https, http, onion], settings: s(on), generatedAt: GENERATED_AT });
  const entered = mk({ addressMode: 'entered', address: V3 });
  let p = run(entered, true);
  const ol = headersOf(p, 'https').find((h) => h.name === 'Onion-Location');
  assert.ok(ol);
  assert.strictEqual(ol.value, 'http://' + V3 + '/');
  assert.ok(!names(headersOf(p, 'http')).includes('onion-location'));
  assert.ok(!names(headersOf(p, 'onion')).includes('onion-location'));
  assert.ok(!names(run(entered, false).destinations.find((d) => d.id === 'https').requiredHeaders).includes('onion-location'));
  // Pending mode with an address typed in → no header and no leak of that address
  p = run(mk({ addressMode: 'pending-operator', address: V3 }), true);
  assert.ok(!names(headersOf(p, 'https')).includes('onion-location'));
  assert.ok(!JSON.stringify(p).includes(V3.slice(0, 20)));
  // Invalid entered onion → no header
  p = run(mk({ addressMode: 'entered', address: 'expyuzz4wqqyqhjn.onion' }), true);
  assert.ok(!names(headersOf(p, 'https')).includes('onion-location'));
});

// ------------------------------------------------------------ SHA256SUMS

test('SHA256SUMS validates with the real `sha256sum -c` against the exact bytes', { skip: !hasBin('sha256sum') && 'sha256sum not installed' }, async () => {
  const input = await readyInput();
  const p = plan.buildPlan(input);
  const files = plan.exportArtifacts(p, input);
  const sums = files.find((f) => f.path === 'offline-mirror-plan/SHA256SUMS').content;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'omp-sums-'));
  try {
    const site = path.join(dir, 'site');
    for (const e of demo.entries({ includeBait: false, includeUnsafe: false })) {
      const rel = e.path.slice(demo.ROOT.length + 1);
      fs.mkdirSync(path.dirname(path.join(site, rel)), { recursive: true });
      fs.writeFileSync(path.join(site, rel), e.bytes);
    }
    fs.writeFileSync(path.join(dir, 'SHA256SUMS'), sums);
    const out = execFileSync('sha256sum', ['-c', '--strict', '../SHA256SUMS'], { cwd: site, encoding: 'utf8' });
    const lines = out.trim().split('\n');
    assert.strictEqual(lines.length, p.site.totals.fileCount);
    assert.ok(lines.every((l) => / OK$/.test(l)), out);
    // Tamper one byte → sha256sum must fail
    const victim = path.join(site, 'docs', 'visiting.txt');
    const b = fs.readFileSync(victim); b[0] ^= 1; fs.writeFileSync(victim, b);
    assert.throws(() => execFileSync('sha256sum', ['-c', '--quiet', '../SHA256SUMS'], { cwd: site, stdio: 'pipe' }));
    // manifestSha256 in the plan matches the SHA256SUMS file
    assert.strictEqual(p.site.manifestSha256, sha(fs.readFileSync(path.join(dir, 'SHA256SUMS'))));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('SHA256SUMS lists only included files: excluded/rejected files never get a hash anywhere in the export', async () => {
  const inv = await core.buildInventory(demo.entries());
  const input = { inventory: inv, destinations: demo.destinations(), settings: demo.settings(), generatedAt: GENERATED_AT };
  const p = plan.buildPlan(input);
  const files = plan.exportArtifacts(p, input);
  const all = files.map((f) => f.content).join('\n');
  const sums = files.find((f) => f.path.endsWith('SHA256SUMS')).content;
  for (const b of demo.baitFiles().concat(demo.unsafeEntries())) {
    const h = sha(b.bytes);
    assert.ok(!all.includes(h), 'hash of excluded/rejected ' + b.path + ' leaked');
    assert.ok(!sums.includes(' ' + b.path + '\n'), b.path);
  }
  for (const x of p.site.excluded.concat(p.site.rejected)) assert.strictEqual(x.sha256, undefined);
  assert.strictEqual(sums.trim().split('\n').length, p.site.files.length);
});

test('content types map in the plan matches inventory media types', async () => {
  const p = plan.buildPlan(await readyInput());
  assert.strictEqual(p.contentTypes.html, 'text/html; charset=utf-8');
  assert.strictEqual(p.contentTypes.png, 'image/png');
  for (const v of Object.values(p.contentTypes)) assert.strictEqual(typeof v, 'string');
});

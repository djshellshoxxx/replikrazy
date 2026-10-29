'use strict';
// Unit tests: plan building, header rules, instructions and export safety.

const test = require('node:test');
const assert = require('node:assert/strict');

const inventory = require('../../src/core/inventory.js');
const D = require('../../src/core/destinations.js');
const plan = require('../../src/core/plan.js');
const sha256 = require('../../src/core/sha256.js');
const demo = require('../../src/demo-data.js');

const AT = '2026-10-27T00:00:00.000Z';
let demoInv;
async function inv() {
  if (!demoInv) demoInv = await inventory.build(inventory.entriesFromDemo(demo), { label: demo.siteLabel, source: 'demo' });
  return demoInv;
}

// Strings from demo decoy files and excluded paths; none may appear in any export.
// (".env" itself appears in generic advice text, so excluded paths are also checked against the manifest.)
const FORBIDDEN = ['DEMO DECOY', 'DEMO_FAKE_VALUE', 'not-a-real-secret', 'contact.php',
  'subscribers.sqlite', 'eepPriv', 'server.pem', 'draft.html.bak', 'hs_ed25519_secret_key', 'backup-2026-09'];

test('validateHeaders: accepts safe headers, rejects unsafe ones', () => {
  assert.deepEqual(plan.validateHeaders(plan.DEFAULT_HEADERS).errors, []);
  const bad = [
    { name: 'Set-Cookie', value: 'a=b' },
    { name: 'Authorization', value: 'x' },
    { name: 'Content-Type', value: 'text/html' },
    { name: 'Bad Name', value: 'x' },
    { name: 'X-Ok', value: 'has "quote"' },
    { name: 'X-Var', value: '$host' },
    { name: 'X-Newline', value: 'a\r\nInjected: 1' },
    { name: 'X-Empty', value: '' },
    { name: 'X-Secret', value: 'token=' + 'abc123' },
    { name: 'X-Dup', value: '1' },
    { name: 'x-dup', value: '2' }
  ];
  const r = plan.validateHeaders(bad);
  assert.equal(r.errors.length, 10);
  assert.deepEqual(r.headers, [{ name: 'X-Dup', value: '1' }]);
  assert.ok(plan.validateHeaders(Array.from({ length: 21 }, (_, i) => ({ name: 'X-H' + i, value: 'v' }))).errors.length > 0);
  assert.deepEqual(plan.validateHeaders([{ name: 'Content-Security-Policy', value: "default-src 'self'" }]).errors, []);
});

test('buildPlan: refuses without site, files or destinations', async () => {
  assert.throws(() => plan.buildPlan({}), { code: 'no-site' });
  const site = await inv();
  const empty = Object.assign({}, site, { files: [] });
  assert.throws(() => plan.buildPlan({ inventory: empty, destinations: demo.destinations }), { code: 'no-files' });
  assert.throws(() => plan.buildPlan({ inventory: site, destinations: [] }), { code: 'no-destinations' });
  assert.throws(() => plan.buildPlan({ inventory: site, destinations: demo.destinations, settings: { requiredHeaders: [{ name: 'Cookie', value: 'x' }] } }), { code: 'bad-headers' });
});

test('buildPlan: demo plan shape, statuses and byte-preservation fields', async () => {
  const p = plan.buildPlan({ inventory: await inv(), destinations: demo.destinations, generatedAt: AT });
  assert.equal(p.schema, 'offline-mirror-planner/deployment-plan@1');
  assert.equal(p.mode, 'offline-plan-only');
  assert.equal(p.verification.performedByTool, false);
  assert.equal(p.verification.networkRequests, 0);
  assert.equal(p.site.bytesPreserved, true);
  assert.equal(p.site.transformations, 'none');
  assert.equal(p.site.files.length, 14);
  assert.equal(p.site.excludedSummary.count, 9);
  assert.equal(p.site.manifestSha256, sha256.sha256HexSync(plan.renderSha256Sums(p.site.files)));
  assert.deepEqual(p.summary.byStatus, { incomplete: 1, blocked: 1, unverified: 1, 'ready-for-manual-review': 2 });
  for (const d of p.destinations) {
    assert.equal(d.verified, false);
    for (const k of D.CAP_KEYS) assert.deepEqual(Object.keys(d.capabilities[k]).sort(), ['declared', 'source', 'verified']);
    for (const k of D.CAP_KEYS) assert.equal(d.capabilities[k].verified, false);
    assert.equal(d.instructionsFile, 'instructions/' + d.fileId + '.md');
  }
  const i2p = p.destinations.find((d) => d.id === 'i2p-eepsite-draft');
  assert.deepEqual(i2p.missingConfiguration.map((m) => m.field), ['listen']);
  assert.equal(i2p.addressState, 'pending-operator-generated');
  assert.ok(p.disclaimers.some((s) => /browser storage/i.test(s) && /not shared/i.test(s)));
  assert.ok(p.disclaimers.some((s) => /blockchain/i.test(s) && /not make/i.test(s)));
  assert.ok(!p.disclaimers.some((s) => /\bshares? (browser )?storage\b/i.test(s.replace(/not shared/gi, ''))));
});

test('exports never contain excluded files, decoy contents or credentials', async () => {
  const leaky = D.createDestination('static-host', {
    id: 'leaky', name: 'Leaky', providerLabel: 'Example', address: 'https://mirror.example.org/',
    notes: 'password=' + 'hunter2'
  });
  const p = plan.buildPlan({ inventory: await inv(), destinations: demo.destinations.concat([leaky]), generatedAt: AT });
  const files = plan.buildExportFiles(p);
  assert.deepEqual(files.map((f) => f.name), ['README.txt', 'deployment-plan.json', 'SHA256SUMS',
    'instructions/static-host-a.md', 'instructions/static-host-b.md', 'instructions/lan-server.md',
    'instructions/onion-mirror.md', 'instructions/i2p-eepsite-draft.md', 'instructions/leaky.md']);
  const all = files.map((f) => f.text).join('\n');
  for (const s of FORBIDDEN.concat(['hunter2'])) assert.ok(!all.includes(s), 'export leaked: ' + s);
  const site = await inv();
  const manifest = files.find((f) => f.name === 'SHA256SUMS').text.split('\n').map((l) => l.slice(66));
  const planned = JSON.parse(files[1].text).site.files.map((f) => f.path);
  for (const e of site.excluded) {
    assert.ok(!manifest.includes(e.path) && !planned.includes(e.path), 'excluded path in manifest: ' + e.path);
  }
  assert.equal(p.destinations.find((d) => d.id === 'leaky').status, 'incomplete');
  assert.equal(JSON.parse(files[1].text).destinations.find((d) => d.id === 'leaky').config.notes, '[REDACTED: looked like a credential]');
});

test('SHA256SUMS is sha256sum-compatible and sorted', async () => {
  const p = plan.buildPlan({ inventory: await inv(), destinations: demo.destinations, generatedAt: AT });
  const sums = plan.buildExportFiles(p).find((f) => f.name === 'SHA256SUMS').text;
  const lines = sums.trimEnd().split('\n');
  assert.equal(lines.length, 14);
  for (const l of lines) assert.match(l, /^[0-9a-f]{64} {2}\S/);
  const ps = lines.map((l) => l.slice(66));
  assert.deepEqual(ps, ps.slice().sort());
  assert.ok(sums.endsWith('\n'));
});

test('instructions: inert templates per type, no identities created', async () => {
  const p = plan.buildPlan({ inventory: await inv(), destinations: demo.destinations, generatedAt: AT });
  const md = (id) => plan.renderInstructions(p, id);
  const onion = md('onion-mirror');
  assert.match(onion, /HiddenServiceDir \/var\/lib\/tor\/onion-mirror\//);
  assert.match(onion, /HiddenServicePort 80 127\.0\.0\.1:8081/);
  assert.match(onion, /did \*\*not\*\* create an onion identity/);
  assert.match(onion, /listen 127\.0\.0\.1:8081;/);
  assert.match(onion, /access_log off;/);
  assert.ok(!/[a-z2-7]{56}\.onion/.test(onion), 'no onion address is invented');
  const i2p = md('i2p-eepsite-draft');
  assert.match(i2p, /type = http/);
  assert.match(i2p, /port = <PORT>/, 'missing listen becomes a placeholder');
  assert.match(i2p, /\*\*incomplete\*\*/);
  assert.match(i2p, /`listen`: /);
  assert.ok(!/[a-z2-7]{52}\.b32\.i2p/.test(i2p), 'no i2p address is invented');
  const lan = md('lan-server');
  assert.match(lan, /location \/field-notes\/ \{/);
  assert.match(lan, /error_page 404 \/field-notes\/404\.html;/);
  assert.match(lan, /TARGET='\/srv\/mirror\/site\/field-notes'/);
  assert.match(lan, /Root-relative links \(5\) reviewed/);
  const host = md('static-host-a');
  assert.match(host, /provider's own upload method/);
  assert.match(host, /\*\*unverified\*\*/);
  assert.ok(!/HiddenService|tunnels\.conf/.test(host));
  for (const id of ['static-host-a', 'static-host-b', 'lan-server', 'onion-mirror', 'i2p-eepsite-draft']) {
    assert.match(md(id), /PLANNING DOCUMENT ONLY/);
    assert.match(md(id), /Verified by this tool \| no/);
  }
  assert.throws(() => md('nope'), { code: 'unknown-destination' });
});

test('instructions: invalid or redacted values never reach templates', async () => {
  const evil = D.createDestination('local-server', {
    id: 'evil', name: 'Evil', serverSoftware: 'nginx', listen: '127.0.0.1:80; include /etc/passwd',
    documentRoot: "/srv/x'; rm -rf / #"
  });
  const p = plan.buildPlan({ inventory: await inv(), destinations: [evil], generatedAt: AT });
  const text = plan.renderInstructions(p, 'evil');
  assert.ok(!text.includes('rm -rf'), 'document root injection must not render');
  assert.ok(!text.includes('include /etc/passwd'), 'listen injection must not render');
  assert.match(text, /root <DOCUMENT_ROOT>;/);
  assert.match(text, /listen 127\.0\.0\.1:<PORT>;/);
});

test('caddy and java-i2p variants render', async () => {
  const caddy = D.createDestination('tor-onion', { id: 'c', name: 'C', serverSoftware: 'caddy', listen: '[::1]:9000', documentRoot: '/srv/c' });
  const java = D.createDestination('i2p', { id: 'j', name: 'J', router: 'java-i2p', serverSoftware: 'other', listen: '127.0.0.1:9001', documentRoot: '/srv/j' });
  const p = plan.buildPlan({ inventory: await inv(), destinations: [caddy, java], generatedAt: AT });
  const c = plan.renderInstructions(p, 'c');
  assert.match(c, /http:\/\/\[::1\]:9000 \{/);
  assert.match(c, /bind ::1/);
  assert.match(c, /HiddenServicePort 80 \[::1\]:9000/);
  const j = plan.renderInstructions(p, 'j');
  assert.match(j, /Hidden Services Manager/);
  assert.match(j, /listen on `127\.0\.0\.1:9001` \(loopback only\)/);
});

test('plan name falls back when empty or secret-like', async () => {
  const base = { inventory: await inv(), destinations: demo.destinations, generatedAt: AT };
  assert.equal(plan.buildPlan(Object.assign({}, base, { settings: { planName: '  Spring mirror  ' } })).planName, 'Spring mirror');
  assert.equal(plan.buildPlan(Object.assign({}, base, { settings: { planName: 'token=' + 'zzz' } })).planName, 'lantern-field-notes mirror plan');
});

'use strict';
// Canary tests: plant unique strings in every place a secret could enter and
// grep every exported artifact for them.
const test = require('node:test');
const assert = require('node:assert');
const { core, dest, plan, demo, GENERATED_AT, cleanDemoInventory, raw, ALL_YES, exportAll, entries } = require('./_helpers.js');

const GH = 'ghp_' + 'Q7x9Kp2LmN4vB8cR1tY6wZ3aS5dF0gHjE2uI'; // 40 chars, fake

function noCanary(text, canaries, where, caseSensitiveOnly) {
  for (const c of canaries) {
    assert.ok(!text.includes(c), (where || 'export') + ' contains canary ' + c);
    if (!caseSensitiveOnly) assert.ok(!text.toLowerCase().includes(c.toLowerCase()), (where || 'export') + ' contains (case-folded) canary ' + c);
  }
}

test('unknown destination fields (password/apiToken/privateKey, top level and in config) never reach any export', async () => {
  const canaries = ['CANARYCFGPW', 'CANARYCFGTOK', 'CANARYCFGKEY', 'CANARYTOPPW', 'CANARYTOPTOK', 'CANARYTOPKEY', 'CANARYNESTED', 'CANARYCAP'];
  const r = raw('generic-static', { address: 'https://s.example/', password: 'CANARYCFGPW', apiToken: 'CANARYCFGTOK', privateKey: 'CANARYCFGKEY' },
    { password: 'CANARYTOPPW', apiToken: 'CANARYTOPTOK', privateKey: 'CANARYTOPKEY', auth: { user: 'CANARYNESTED' }, capabilities: { 'tls-https': 'yes', secret: 'CANARYCAP' } });
  const { text } = exportAll({ inventory: await cleanDemoInventory(), destinations: [r], settings: demo.settings() });
  noCanary(text, canaries);
  // Also via import of the same record
  const imp = plan.importDestinations(JSON.stringify([r]));
  noCanary(JSON.stringify(imp.destinations), canaries, 'import');
});

test('credential-looking notes / labels / free-text fields are redacted in the plan and destinations.json', async () => {
  const d = dest.sanitizeDestination(raw('generic-static', { address: 'https://s.example/', providerName: 'password=CANARYPROV1', deployMethod: 'token: CANARYDEP12' },
    { id: 'red', label: 'api_key=CANARYLBL1', notes: 'Login: password = CANARYNOTE1' }));
  const { text, plan: p } = exportAll({ destinations: [d], settings: demo.settings() });
  // Case-sensitive here; the lower-cased label slug leak is covered by the next (todo) test.
  noCanary(text, ['CANARYPROV1', 'CANARYDEP12', 'CANARYLBL1', 'CANARYNOTE1'], 'export', true);
  noCanary(text, ['CANARYPROV1', 'CANARYDEP12', 'CANARYNOTE1']);
  assert.match(JSON.stringify(p), /(redacted|omitted) by planner/);
  assert.strictEqual(p.destinations[0].state, 'needs-configuration');
});

test('a credential in a label does not leak through the generated directory slug / file paths', () => {
  const d = dest.sanitizeDestination(raw('generic-static', { address: 'https://s.example/' }, { id: 'slug', label: GH }));
  const { text, plan: p } = exportAll({ destinations: [d], settings: demo.settings() });
  assert.notStrictEqual(p.destinations[0].label, GH);
  noCanary(text, [GH.slice(4, 24)]);
});

test('URLs with userinfo are rejected and never echoed into any export (address and publicUrl)', () => {
  const ds = [
    dest.sanitizeDestination(raw('generic-static', { address: 'https://alice:CANARYURLPW1@s.example/' }, { id: 'u1' })),
    dest.sanitizeDestination(raw('local-server', { listenAddress: '127.0.0.1:8080', documentRoot: '/srv/x', publicUrl: 'https://bob:CANARYURLPW2@l.example/' }, { id: 'u2' }))
  ];
  for (const d of ds) assert.ok(dest.validateDestination(d).errors.length > 0);
  const { text } = exportAll({ destinations: ds, settings: demo.settings() });
  noCanary(text, ['CANARYURLPW1', 'CANARYURLPW2', 'alice:', 'bob:']);
});

test('rejected URLs with tokens in the query string are not echoed into exports', () => {
  const d = dest.sanitizeDestination(raw('generic-static', { address: 'https://s.example/?access_token=CANARYQUERY1' }, { id: 'q' }));
  assert.ok(dest.validateDestination(d).errors.some((e) => e.field === 'address'));
  const { text } = exportAll({ destinations: [d], settings: demo.settings() });
  noCanary(text, ['CANARYQUERY1']);
});

test('credential-looking header values (and names) are redacted from every export', () => {
  const settings = { siteLabel: 'x', headers: [
    { name: 'X-Api-Key', value: GH },
    { name: 'X-Debug', value: 'Bearer CANARYBEARERTOKEN12345' },
    { name: 'X-' + GH.replace('_', '-'), value: 'v' }
  ] };
  const ds = [dest.sanitizeDestination(raw('local-server', { serverSoftware: 'nginx', listenAddress: '127.0.0.1:8080', documentRoot: '/srv/x' }, { id: 'h' }))];
  const { text } = exportAll({ destinations: ds, settings });
  noCanary(text, [GH.slice(4, 30), 'CANARYBEARERTOKEN12345']);
});

test('free-text URLs with userinfo in notes / deployMethod are redacted', () => {
  const d = dest.sanitizeDestination(raw('generic-static', { address: 'https://s.example/', deployMethod: 'rsync to sftp://deploy:CANARYDEPPW@h.example/' }, { id: 'n', notes: 'upload via https://admin:CANARYNOTEPW@h.example/' }));
  const { text } = exportAll({ destinations: [d], settings: demo.settings() });
  noCanary(text, ['CANARYNOTEPW', 'CANARYDEPPW']);
});

test('sensitive and secret-bearing site files: content never exported; listed by path+reason only', async () => {
  const CANARY = 'CANARYFILECONTENT';
  const PEM = '-----BEGIN ' + 'OPENSSH PRIVATE KEY-----\n' + CANARY + 'PEM\n';
  const es = entries([
    ['site/index.html', '<p>ok</p>'],
    ['site/.env', 'SECRET=' + CANARY + 'ENV'],
    ['site/.git/config', 'url = https://u:' + CANARY + 'GIT@h/'],
    ['site/keys/hidden_service/hs_ed25519_secret_key', CANARY + 'TOR'],
    ['site/wallet.dat', CANARY + 'WALLET'],
    ['site/db/app.sqlite', CANARY + 'DB'],
    ['site/notes.txt', 'hello\n' + PEM],
    ['site/deploy.js', 'const k = "AKIA' + 'ABCDEFGHIJKLMNOP"; // ' + CANARY + 'JS']
  ]);
  const inv = await core.buildInventory(es);
  const input = { inventory: inv, destinations: demo.destinations(), settings: demo.settings(), generatedAt: GENERATED_AT };
  const p = plan.buildPlan(input);
  const files = plan.exportArtifacts(p, input);
  const all = files.map((f) => f.path + '\n' + f.content).join('\n');
  noCanary(all, [CANARY]);
  assert.ok(!all.includes('AKIAABCDEFGHIJKLMNOP'));
  assert.deepStrictEqual(p.site.files.map((f) => f.path), ['index.html']);
  for (const x of p.site.excluded) assert.deepStrictEqual(Object.keys(x).sort(), ['category', 'path', 'reason', 'size']);
  // excluded paths appear, but not in SHA256SUMS
  const sums = files.find((f) => f.path.endsWith('SHA256SUMS')).content;
  for (const x of p.site.excluded) { assert.ok(all.includes(x.path)); assert.ok(!sums.includes(x.path)); }
  for (const e of es) if (!['site/index.html', 'site/notes.txt', 'site/deploy.js'].includes(e.path)) assert.strictEqual(e.reads, 0, e.path);
});

test('demo bait files: none of their bytes or hashes appear in any export', async () => {
  const input = { inventory: await core.buildInventory(demo.entries()), destinations: demo.destinations(), settings: demo.settings(), generatedAt: GENERATED_AT };
  const { text } = exportAll(input);
  noCanary(text, ['DEMO_ONLY=this-is-not-a-real-secret', 'DEMO-ONLY-NOT-A-REAL-KEY', 'bare = false', 'traversal attempt (demo)']);
});

test('importDestinations output never contains credential fields, and re-export of an export is stable', async () => {
  const input = { inventory: await cleanDemoInventory(), destinations: demo.destinations(), settings: demo.settings(), generatedAt: GENERATED_AT };
  const { files } = exportAll(input);
  const dj = files.find((f) => f.path.endsWith('destinations.json')).content;
  const imp = plan.importDestinations(dj);
  assert.strictEqual(imp.destinations.length, demo.destinations().length);
  assert.deepStrictEqual(imp.destinations.map((d) => d.id), demo.destinations().map((d) => d.id));
  const again = exportAll(Object.assign({}, input, { destinations: imp.destinations, settings: imp.settings }));
  assert.strictEqual(again.files.find((f) => f.path.endsWith('destinations.json')).content, dj);
  // plan.json import yields the same records
  const pj = files.find((f) => f.path.endsWith('plan.json')).content;
  assert.deepStrictEqual(plan.importDestinations(pj).destinations, imp.destinations);
});

test('the full ready export contains no secret-shaped strings at all', async () => {
  const input = { inventory: await cleanDemoInventory(), destinations: demo.destinations(), settings: demo.settings(), generatedAt: GENERATED_AT };
  const { files } = exportAll(input);
  for (const f of files) {
    const hits = core.scanTextForSecrets(f.content);
    assert.deepStrictEqual(hits, [], f.path);
  }
});

test('ALL_YES helper sanity', () => { assert.ok(Object.keys(ALL_YES).length >= 8); });

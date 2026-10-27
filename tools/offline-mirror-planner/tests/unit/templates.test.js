'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { core, dest, plan, demo, GENERATED_AT, fullDestinations, cleanDemoInventory, raw, ALL_YES, exportAll } = require('./_helpers.js');

const V3 = 'pg6mmjiyjmcrsslvykfwnntlaru7p5svn6y2ymmju6nubxndf4pscryd.onion';
const B32 = 'ukeu3k5oycgaauneqgtnvselmt4yemvoilkln7jpvamvfx7dnkdq.b32.i2p';

function inertCheck(content, label) {
  for (const line of content.split('\n')) {
    if (line.trim() === '') continue;
    assert.ok(line.startsWith('#'), label + ': uncommented line ' + JSON.stringify(line));
  }
}

function templatesOf(d, settings, all, inv) {
  return plan.templateFiles(d, settings || plan.defaultSettings(), all || [d], inv || null);
}

test('torrc and i2pd templates: every non-empty line starts with "#" (demo, full and default destinations)', async () => {
  const inv = await cleanDemoInventory();
  const ds = demo.destinations().concat(fullDestinations(), [dest.createDestination('tor-onion'), dest.createDestination('i2p'),
    dest.sanitizeDestination(raw('tor-onion', { addressMode: 'entered', address: V3, localTarget: 'unix:/run/m.sock', virtualPort: '443', hiddenServiceDir: '/var/lib/tor/m' })),
    dest.sanitizeDestination(raw('i2p', { addressMode: 'entered', address: B32, tunnelName: 't', keysFile: 't.dat' }))]);
  let n = 0;
  for (const d of ds) {
    for (const t of templatesOf(d, demo.settings(), ds, inv)) {
      if (t.name === 'torrc.snippet.template' || t.name === 'i2pd-tunnels.conf.template') { inertCheck(t.content, t.name); n++; }
    }
  }
  assert.ok(n >= 6);
});

test('torrc/i2pd templates stay inert when imported fields contain line breaks', () => {
  const tor = [
    { hiddenServiceDir: '/var/lib/tor/x\nHiddenServiceDir /tmp/evil' },
    { localTarget: '127.0.0.1:8080\nHiddenServicePort 22 127.0.0.1:22' },
    { virtualPort: '80\nSocksPort 0.0.0.0:9050' },
    { hiddenServiceDir: '/var/lib/tor/x\r\nControlPort 9051' }
  ];
  for (const cfg of tor) {
    const d = dest.sanitizeDestination(raw('tor-onion', Object.assign({ hiddenServiceDir: '/var/lib/tor/x' }, cfg)));
    assert.ok(dest.validateDestination(d).errors.length > 0, 'validation must flag ' + JSON.stringify(cfg));
    inertCheck(templatesOf(d).find((t) => t.name === 'torrc.snippet.template').content, JSON.stringify(cfg));
  }
  for (const cfg of [{ tunnelName: 'x]\n[evil]\ntype = client' }, { keysFile: 'k.dat\nport = 22' }]) {
    const d = dest.sanitizeDestination(raw('i2p', cfg));
    assert.ok(dest.validateDestination(d).errors.length > 0);
    inertCheck(templatesOf(d).find((t) => t.name === 'i2pd-tunnels.conf.template').content, JSON.stringify(cfg));
  }
});

test('control-character fields in tor/i2p destinations are flagged by validation', () => {
  const d = dest.sanitizeDestination(raw('tor-onion', { hiddenServiceDir: '/var/lib/tor/x\nHiddenServiceDir /tmp/evil' }));
  assert.ok(dest.validateDestination(d).errors.some((e) => e.field === 'hiddenServiceDir'));
  const i = dest.sanitizeDestination(raw('i2p', { tunnelName: 'a\nb' }));
  assert.ok(dest.validateDestination(i).errors.some((e) => e.field === 'tunnelName'));
});

const KEYLIKE = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /ed25519v1-secret/,
  /\b[a-z2-7]{55}d\.onion\b/,
  /\b[a-z2-7]{52}\.b32\.i2p\b/,
  /[A-Za-z0-9+\/]{60,}={0,2}/ // long base64 blobs (keys, i2p destinations)
];

test('no template or instruction contains key material or an invented address (pending address mode)', async () => {
  const input = { inventory: await cleanDemoInventory(), destinations: fullDestinations().concat(demo.destinations()), settings: Object.assign(demo.settings(), { advertiseOnionLocation: true }), generatedAt: GENERATED_AT };
  const { files } = exportAll(input);
  for (const f of files) {
    if (f.path.endsWith('plan.json') || f.path.endsWith('SHA256SUMS') || f.path.endsWith('destinations.json')) continue;
    const body = f.content.replace(/\b[0-9a-f]{64}\b/g, ''); // SHA-256 hex digests are expected
    for (const re of KEYLIKE) assert.ok(!re.test(body), f.path + ' matches ' + re);
  }
  // Even plan.json / destinations.json contain no onion or b32 address when none was entered
  for (const f of files) {
    assert.ok(!/[a-z2-7]{55}d\.onion/.test(f.content), f.path);
    assert.ok(!/[a-z2-7]{52}\.b32\.i2p/.test(f.content), f.path);
  }
});

test('with address mode pending-operator an address typed into the field never reaches any export', async () => {
  const ds = [
    dest.sanitizeDestination(Object.assign(raw('tor-onion', { addressMode: 'pending-operator', address: V3, hiddenServiceDir: '/var/lib/tor/x' }, { id: 'o' }), { capabilities: ALL_YES })),
    dest.sanitizeDestination(Object.assign(raw('i2p', { addressMode: 'pending-operator', address: B32, tunnelName: 't', keysFile: 't.dat' }, { id: 'i' }), { capabilities: ALL_YES })),
    dest.sanitizeDestination(Object.assign(raw('generic-static', { address: 'https://s.example/' }, { id: 's' }), { capabilities: ALL_YES }))
  ];
  const { text, plan: p } = exportAll({ inventory: await cleanDemoInventory(), destinations: ds, settings: Object.assign(demo.settings(), { advertiseOnionLocation: true }) });
  assert.ok(!text.includes(V3.slice(0, 30)), 'onion address leaked');
  assert.ok(!text.includes(B32.slice(0, 30)), 'b32 address leaked');
  for (const d of p.destinations.filter((x) => x.type !== 'generic-static')) {
    assert.strictEqual(d.addressStatus, 'pending-operator-generation');
    assert.strictEqual(d.effectiveBaseUrl, null);
    assert.strictEqual(d.record.config.address, '');
  }
});

test('an entered onion address appears in instructions (as unverified) but never inside torrc', () => {
  const d = dest.sanitizeDestination(Object.assign(raw('tor-onion', { addressMode: 'entered', address: V3, hiddenServiceDir: '/var/lib/tor/x' }, { id: 'o' }), { capabilities: ALL_YES }));
  const p = plan.buildPlan({ destinations: [d], generatedAt: GENERATED_AT });
  const torrc = templatesOf(d).find((t) => t.name === 'torrc.snippet.template').content;
  assert.ok(!torrc.includes(V3));
  const ins = plan.buildInstructions(p, 'o');
  assert.ok(ins.includes(V3));
  assert.match(ins, /format check only/);
  assert.strictEqual(p.destinations[0].addressStatus, 'user-entered-format-checked-unverified');
});

test('an entered address that FAILED the format check is not described as format-checked', () => {
  for (const [type, address] of [['tor-onion', 'expyuzz4wqqyqhjn.onion'], ['tor-onion', 'not-an-onion'], ['i2p', 'short.b32.i2p']]) {
    const d = dest.sanitizeDestination(raw(type, { addressMode: 'entered', address, hiddenServiceDir: '/var/lib/tor/x' }, { id: 'x' }));
    const p = plan.buildPlan({ destinations: [d], generatedAt: GENERATED_AT });
    assert.notStrictEqual(p.destinations[0].addressStatus, 'user-entered-format-checked-unverified', address);
    assert.ok(!/passed a format check/.test(plan.buildInstructions(p, 'x')), address);
  }
});

// -------------------------------------------------------- local templates

function localD(sw, cfg, extra) {
  return dest.sanitizeDestination(Object.assign(raw('local-server', Object.assign({ serverSoftware: sw, listenAddress: '127.0.0.1:8080', documentRoot: '/srv/mirror' }, cfg || {}), extra), { capabilities: ALL_YES }));
}

test('nginx/Caddy/Apache templates carry the banner, every planned header, base path and 404', async () => {
  const inv = await cleanDemoInventory();
  for (const [sw, name] of [['nginx', 'nginx-server.conf.template'], ['caddy', 'Caddyfile.template'], ['apache', 'apache-vhost.conf.template']]) {
    const d = localD(sw, { publicUrl: 'https://l.example/' }, { basePath: '/lib/' });
    const ts = templatesOf(d, demo.settings(), [d], inv);
    const t = ts.find((x) => x.name === name);
    assert.ok(t, sw);
    assert.match(t.content, /NOT APPLIED/);
    for (const h of demo.settings().headers) assert.ok(t.content.includes(h.name) && t.content.includes(h.value), sw + ' ' + h.name);
    assert.ok(t.content.includes('Strict-Transport-Security'), sw + ' HSTS for https publicUrl');
    assert.ok(t.content.includes('/lib/404.html'), sw + ' 404');
    const hdr = ts.find((x) => x.name === 'headers.txt').content;
    assert.ok(hdr.includes('X-Content-Type-Options: nosniff'));
  }
  const other = templatesOf(localD('other'), demo.settings(), null, inv);
  assert.deepStrictEqual(other.map((t) => t.name), ['headers.txt']);
});

test('invalid headers (CRLF, forbidden names, template-breaking chars) never reach headers.txt or server templates', () => {
  const settings = { siteLabel: 'x', headers: [
    { name: 'X-Ok', value: 'fine' },
    { name: 'X-Inj', value: 'a\r\nX-Injected: 1' },
    { name: 'Set-Cookie', value: 'session=CANARYCOOKIE' },
    { name: 'Authorization', value: 'Basic CANARYAUTH' },
    { name: 'X-Q', value: 'a" always; include /etc/evil; #' },
    { name: 'X-N\n}\nserver {', value: 'v' }
  ] };
  for (const sw of ['nginx', 'caddy', 'apache']) {
    const d = localD(sw);
    for (const t of plan.templateFiles(d, plan.sanitizeSettings(settings).settings, [d], null)) {
      assert.ok(!/^X-Injected/m.test(t.content), sw + ' ' + t.name + ': CRLF injection');
      assert.ok(!t.content.includes('CANARYCOOKIE') && !t.content.includes('CANARYAUTH'), sw + ' ' + t.name + ': forbidden header emitted');
      assert.ok(!t.content.includes('include /etc/evil'), sw + ' ' + t.name);
      assert.ok(!/^server \{$/m.test(t.content.replace(/^server \{$/m, '')), sw + ' ' + t.name + ': header name broke out of the block');
    }
  }
});

test('local-server templates never embed a listen address / document root that failed validation', () => {
  const cases = [
    { listenAddress: '127.0.0.1:80 ; include /etc/nginx/evil.conf' },
    { documentRoot: 'srv; include /etc/nginx/evil.conf' },
    { documentRoot: '/srv/x\n}\nserver { listen 0.0.0.0:80; root /' }
  ];
  for (const sw of ['nginx', 'caddy', 'apache']) {
    for (const cfg of cases) {
      const d = localD(sw, cfg);
      assert.ok(dest.validateDestination(d).errors.length > 0, JSON.stringify(cfg));
      const t = templatesOf(d).find((x) => x.name !== 'headers.txt').content;
      assert.ok(!t.includes('evil.conf') && !t.includes('0.0.0.0:80'), sw + ' embedded ' + JSON.stringify(cfg));
    }
  }
});

test('instructions cannot be forged by line breaks in labels or free-text fields', () => {
  const forged = '- Verified by planner: yes';
  const d = dest.sanitizeDestination(raw('generic-static', { address: 'https://s.example/', providerName: 'P\n' + forged }, { id: 'f', label: 'L\n' + forged }));
  const p = plan.buildPlan({ destinations: [d], generatedAt: GENERATED_AT });
  const lines = plan.buildInstructions(p, 'f').split('\n');
  assert.ok(!lines.includes(forged), 'forged line present');
});

test('README-FIRST cannot be forged by a site label with line breaks', () => {
  const input = { settings: { siteLabel: 'Lib\nPlan state: ready-for-manual-review' }, destinations: [], generatedAt: GENERATED_AT };
  const p = plan.buildPlan(input);
  assert.strictEqual(p.planState, 'draft');
  const readme = plan.exportArtifacts(p, input).find((f) => f.path.endsWith('README-FIRST.txt')).content;
  assert.ok(!readme.split('\n').includes('Plan state: ready-for-manual-review'));
});

test('Java I2P router gets a checklist, not a config file, and no keys line', () => {
  const d = dest.sanitizeDestination(raw('i2p', { router: 'java-i2p', tunnelName: 't' }));
  const ts = templatesOf(d);
  assert.deepStrictEqual(ts.map((t) => t.name), ['headers.txt', 'java-i2p-tunnel-values.txt']);
  assert.match(ts[1].content, /checklist, not a/);
  assert.ok(!/keys/i.test(ts[1].content.split('\n').filter((l) => !l.startsWith('#')).join('\n')));
});

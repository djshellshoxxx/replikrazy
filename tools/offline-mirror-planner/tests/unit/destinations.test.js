'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { core, dest, plan, raw, ALL_YES } = require('./_helpers.js');

// ---------------------------------------------------------------- headers

test('validateHeader: accepts ordinary security headers (incl. the defaults)', () => {
  for (const h of plan.defaultHeaders()) assert.deepStrictEqual(core.validateHeader(h), [], h.name);
  assert.deepStrictEqual(core.validateHeader({ name: 'X-Frame-Options', value: 'DENY' }), []);
  assert.deepStrictEqual(core.validateHeader({ name: 'X-Tab', value: 'a\tb' }), []);
});

test('validateHeader: CR, LF, NUL and other controls in names or values are rejected', () => {
  for (const v of ['a\r\nSet-Cookie: x=1', 'a\nb', 'a\rb', 'a\u0000b', 'a\u0085b', 'a\u2028b', 'a\u202eb', 'a\u001bb']) {
    assert.ok(core.validateHeader({ name: 'X-A', value: v }).length > 0, JSON.stringify(v));
  }
  for (const n of ['X-A\r\nX-B', 'X A', 'X:A', 'X-A\u0000', 'Ä-Header', 'X(A)', 'X/A', 'X@A', 'X{A}', 'X"A', 'X;A', 'X,A']) {
    assert.ok(core.validateHeader({ name: n, value: 'v' }).length > 0, JSON.stringify(n));
  }
});

test('validateHeader: forbidden connection-level / credential headers are rejected in any case', () => {
  for (const n of ['Set-Cookie', 'set-cookie', 'AUTHORIZATION', 'Proxy-Authorization', 'Cookie', 'Content-Length', 'Transfer-Encoding', 'Connection', 'Host', 'Upgrade', 'TE', 'Trailer', 'Keep-Alive']) {
    assert.ok(core.validateHeader({ name: n, value: 'x' }).length > 0, n);
  }
});

test('validateHeader: template-breaking value characters are rejected', () => {
  for (const c of ['"', '\\', '`', '$', '{', '}']) assert.ok(core.validateHeader({ name: 'X-A', value: 'a' + c + 'b' }).length > 0, c);
  assert.ok(core.validateHeader({ name: 'X-A', value: '${jndi:x}' }).length > 0);
  assert.ok(core.validateHeader({ name: 'X-A', value: '$request_uri' }).length > 0);
  assert.ok(core.validateHeader({ name: 'X-A', value: '{http.request.host}' }).length > 0);
});

test('validateHeader: names that break nginx/Caddy/Apache templates (#, quote, $ etc.) are rejected', () => {
  for (const n of ['#X-A', "X'A", 'X`A', 'X$A', '-Server', '+X', 'X|A', '~X', '!X', '%X', '&X', '*', '^X']) {
    assert.ok(core.validateHeader({ name: n, value: 'v' }).length > 0, 'accepted header name ' + JSON.stringify(n));
  }
});

test('validateHeader: length limits and empty values; credential-looking values rejected', () => {
  const L = core.LIMITS;
  assert.deepStrictEqual(core.validateHeader({ name: 'X-' + 'a'.repeat(L.maxHeaderNameLength - 2), value: 'v' }), []);
  assert.ok(core.validateHeader({ name: 'X-' + 'a'.repeat(L.maxHeaderNameLength - 1), value: 'v' }).length);
  assert.deepStrictEqual(core.validateHeader({ name: 'X-A', value: 'a '.repeat(L.maxHeaderValueLength / 2).trim() }), []);
  assert.ok(core.validateHeader({ name: 'X-A', value: 'a'.repeat(L.maxHeaderValueLength + 1) }).length);
  assert.ok(core.validateHeader({ name: 'X-A', value: '   ' }).length);
  assert.ok(core.validateHeader({ name: '', value: 'v' }).length);
  for (const bad of [null, undefined, 'str', 5]) assert.ok(core.validateHeader(bad).length);
  assert.ok(core.validateHeader({ name: 'X-Api-Key', value: 'ghp_' + 'Ab1'.repeat(12) }).length);
  assert.ok(core.validateHeader({ name: 'X-A', value: 'Bearer abcdefghijklmnop1234' }).length);
});

test('sanitizeSettings: HSTS / Onion-Location may not be listed globally; duplicates flagged case-insensitively; >maxHeaders flagged', () => {
  const r = plan.sanitizeSettings({ siteLabel: 'x', headers: [{ name: 'Strict-Transport-Security', value: 'max-age=1' }, { name: 'onion-location', value: 'http://x' }, { name: 'X-A', value: '1' }, { name: 'x-a', value: '2' }] });
  const msgs = r.errors.map((e) => e.message).join('\n');
  assert.match(msgs, /Strict-Transport-Security/);
  assert.match(msgs, /onion-location/i);
  assert.match(msgs, /listed twice/);
  const many = plan.sanitizeSettings({ siteLabel: 'x', headers: Array.from({ length: 100 }, (_, i) => ({ name: 'X-' + i, value: 'v' })) });
  assert.strictEqual(many.settings.headers.length, core.LIMITS.maxHeaders + 1);
  assert.ok(many.errors.some((e) => e.field === 'headers'));
});

test('sanitizeSettings: header names "constructor"/"toString" are not false duplicates', () => {
  const r = plan.sanitizeSettings({ siteLabel: 'x', headers: [{ name: 'constructor', value: 'v' }, { name: 'toString', value: 'v' }] });
  assert.deepStrictEqual(r.errors, []);
});

test('sanitizeSettings: siteLabel with control / line-break characters is rejected', () => {
  for (const l of ['Lib\nPlan state: ready-for-manual-review', 'a\u202eb', 'a\u0000']) {
    const r = plan.sanitizeSettings({ siteLabel: l });
    assert.ok(r.errors.some((e) => e.field === 'siteLabel'), JSON.stringify(l));
  }
});

test('sanitizeSettings: junk input falls back to defaults; advertiseOnionLocation only for literal true', () => {
  for (const x of [null, undefined, 5, 'x', [], { headers: 'nope' }, { advertiseOnionLocation: 'true' }, { advertiseOnionLocation: 1 }]) {
    const r = plan.sanitizeSettings(x);
    assert.strictEqual(r.settings.advertiseOnionLocation, false);
    assert.ok(Array.isArray(r.settings.headers));
  }
  const h = plan.sanitizeSettings({ headers: [null, 5, { name: 7, value: {} }] });
  assert.strictEqual(h.settings.headers.length, 3);
  assert.ok(h.errors.length >= 3);
});

// ------------------------------------------------------------ destinations

function errsFor(type, config, extra) {
  const d = dest.sanitizeDestination(raw(type, config, extra));
  return dest.validateDestination(d);
}
function fieldErr(v, field) { return v.errors.some((e) => e.field === field); }

test('createDestination: every type starts with all capabilities "unknown" and validates', () => {
  for (const t of dest.TYPE_KEYS) {
    const d = dest.createDestination(t);
    for (const v of Object.values(d.capabilities)) assert.strictEqual(v, 'unknown');
    assert.ok(dest.isValidId(d.id));
    const a = dest.assessDestination(d, null);
    assert.strictEqual(a.verified, false);
    assert.notStrictEqual(a.state, dest.STATES.READY, t + ' must not start ready');
  }
  assert.throws(() => dest.createDestination('ftp'), (e) => e.code === 'BAD_TYPE');
});

test('type names inherited from Object.prototype ("constructor", "__proto__", "toString") are unknown types, not crashes', () => {
  for (const t of ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf']) {
    assert.throws(() => dest.createDestination(t), (e) => e.code === 'BAD_TYPE', t);
    assert.strictEqual(dest.sanitizeDestination({ type: t, config: {} }), null, t);
  }
  const r = plan.importDestinations(JSON.stringify([{ type: 'constructor' }, { type: 'generic-static' }]));
  assert.strictEqual(r.destinations.length, 1);
  const p = plan.buildPlan({ destinations: [{ type: '__proto__' }], generatedAt: 'x' });
  assert.strictEqual(p.destinations.length, 0);
});

test('generic-static URL: scheme, userinfo, query, fragment, onion/i2p hosts', () => {
  const bad = ['ftp://x.example/', 'javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd', 'example.com', '//example.com/',
    'https://user:pass@example.com/', 'https://user@example.com/', 'https://:pw@example.com/', 'https://example.com/?a=1', 'https://example.com/?',
    'https://example.com/#x', 'https://example.com/#', 'https://' + 'a'.repeat(55) + 'd.onion/', 'https://x.i2p/', 'https://x.b32.i2p/',
    'https://exa mple.com/', 'https://example.com:99999/', 'https://ex\u202eample.com/'];
  for (const u of bad) assert.ok(fieldErr(errsFor('generic-static', { address: u }), 'address'), 'accepted ' + u);
  for (const u of ['https://mirror.example.com/', 'https://mirror.example.com', 'https://[2001:db8::1]:8443/x/', 'http://example.com/']) {
    assert.ok(!fieldErr(errsFor('generic-static', { address: u }), 'address'), 'rejected ' + u);
  }
  assert.ok(errsFor('generic-static', { address: 'http://example.com/' }).warnings.some((w) => /http:/.test(w.message)));
});

test('URL validation error messages never echo the URL (so userinfo never leaks via errors)', () => {
  const v = errsFor('generic-static', { address: 'https://bob:CANARYPW1@example.com/' });
  assert.ok(!JSON.stringify(v).includes('CANARYPW1'));
  const v2 = errsFor('local-server', { publicUrl: 'https://bob:CANARYPW1@example.com/', documentRoot: '/srv/x' });
  assert.ok(!JSON.stringify(v2).includes('CANARYPW1'));
});

test('local-server: host:port parsing and listen warnings', () => {
  const ok = ['127.0.0.1:8080', 'localhost:80', '[::1]:8080', '0.0.0.0:80', 'mirror.lan:8080', '10.0.0.5:65535'];
  const bad = ['127.0.0.1', '127.0.0.1:0', '127.0.0.1:65536', '127.0.0.1:99999', '256.0.0.1:80', '01.2.3.4:80', 'host:port', ':80', 'a_b:80',
    '-a.example:80', 'a-.example:80', 'a..b:80', 'http://127.0.0.1:80', '127.0.0.1:80/x', '127.0.0.1:80 ; include /etc/x', '[::1]80', '1.2.3.4:80\nx'];
  for (const s of ok) assert.ok(!fieldErr(errsFor('local-server', { listenAddress: s, documentRoot: '/srv/x' }), 'listenAddress'), s);
  for (const s of bad) assert.ok(fieldErr(errsFor('local-server', { listenAddress: s, documentRoot: '/srv/x' }), 'listenAddress'), 'accepted ' + JSON.stringify(s));
  assert.ok(errsFor('local-server', { listenAddress: '0.0.0.0:80', documentRoot: '/srv/x' }).warnings.some((w) => w.field === 'listenAddress'));
});

test('local-server: documentRoot must be absolute without ".."', () => {
  for (const p of ['srv/x', './x', '../x', '/srv/../etc', '/srv/x/..', 'C:\\www\\..\\x', '~/www', '']) {
    const v = errsFor('local-server', { documentRoot: p });
    assert.ok(fieldErr(v, 'documentRoot') || v.missing.some((m) => m.field === 'documentRoot'), 'accepted ' + JSON.stringify(p));
  }
  for (const p of ['/srv/mirror', '/var/www/html', 'C:\\www\\mirror']) assert.ok(!fieldErr(errsFor('local-server', { documentRoot: p }), 'documentRoot'), p);
});

test('local-server: documentRoot with config-breaking characters (; { } " #) is rejected', () => {
  for (const p of ['/srv/x; include /etc/nginx/evil.conf', '/srv/x"', '/srv/x }', '/srv/{x}', '/srv/x #c', '/srv/$x', "/srv/x'"]) {
    assert.ok(fieldErr(errsFor('local-server', { documentRoot: p }), 'documentRoot'), 'accepted ' + JSON.stringify(p));
  }
});

test('local-server: system / home document roots are warned about', () => {
  for (const p of ['/etc', '/etc/nginx', '/root', '/home/alice', '/home/alice/', '/var/lib/tor', '/var/lib/tor/hs']) {
    assert.ok(errsFor('local-server', { documentRoot: p }).warnings.some((w) => w.field === 'documentRoot'), p);
  }
});

test('local-server: filesystem-root document roots ("/", "C:\\", "/var", "/usr") are flagged', () => {
  for (const p of ['/', '//', 'C:\\', '/usr', '/var', '/home']) {
    const v = errsFor('local-server', { documentRoot: p });
    assert.ok(v.warnings.concat(v.errors).some((w) => w.field === 'documentRoot'), 'no warning for ' + p);
  }
});

test('tor/i2p localTarget must be loopback; unix: only for Tor', () => {
  const okTor = ['127.0.0.1:8080', '127.5.6.7:80', 'localhost:8080', '[::1]:8080', 'unix:/var/run/mirror.sock'];
  const badTor = ['0.0.0.0:8080', '10.0.0.1:80', '192.168.1.2:80', 'example.com:80', '127.0.0.1.nip.io:80', 'localhost.example.com:80', '[::]:80',
    '[::ffff:7f00:1]:80', '127.0.0.1', 'unix:relative.sock', 'unix:/a/../b', '128.0.0.1:80', '127.256.0.1:80'];
  for (const t of okTor) assert.ok(!fieldErr(errsFor('tor-onion', { localTarget: t, hiddenServiceDir: '/var/lib/tor/x' }), 'localTarget'), t);
  for (const t of badTor) assert.ok(fieldErr(errsFor('tor-onion', { localTarget: t, hiddenServiceDir: '/var/lib/tor/x' }), 'localTarget'), 'accepted ' + t);
  assert.ok(fieldErr(errsFor('i2p', { localTarget: 'unix:/var/run/x.sock' }), 'localTarget'));
  assert.ok(fieldErr(errsFor('i2p', { localTarget: '0.0.0.0:80' }), 'localTarget'));
  assert.ok(!fieldErr(errsFor('i2p', { localTarget: '127.0.0.1:80' }), 'localTarget'));
});

const V3 = 'pg6mmjiyjmcrsslvykfwnntlaru7p5svn6y2ymmju6nubxndf4pscryd.onion';

test('onion address: v3 accepted; v2, wrong last char, uppercase, wrong length, junk rejected', () => {
  assert.strictEqual(V3.length, 62);
  const ok = errsFor('tor-onion', { addressMode: 'entered', address: V3, hiddenServiceDir: '/var/lib/tor/x' });
  assert.ok(!fieldErr(ok, 'address'));
  const v2 = errsFor('tor-onion', { addressMode: 'entered', address: 'expyuzz4wqqyqhjn.onion', hiddenServiceDir: '/var/lib/tor/x' });
  assert.ok(v2.errors.some((e) => e.field === 'address' && /v2/.test(e.message)));
  const bads = [V3.replace('d.onion', 'a.onion'), V3.toUpperCase(), V3.slice(1), 'a' + V3, V3 + '.', 'http://' + V3, V3.replace('.onion', '.onion.com'),
    'sub.' + V3, V3.replace('p', '1'), V3.replace('p', '8'), '.onion', V3 + '/'];
  for (const b of bads) assert.ok(fieldErr(errsFor('tor-onion', { addressMode: 'entered', address: b, hiddenServiceDir: '/var/lib/tor/x' }), 'address'), 'accepted ' + b);
});

test('i2p address: .b32.i2p (52 chars) and registered .i2p names', () => {
  const b32 = 'a'.repeat(52) + '.b32.i2p';
  const ok = [b32, 'mirror.i2p', 'my-mirror.i2p', 'sub.mirror.i2p'];
  const bad = ['a'.repeat(51) + '.b32.i2p', 'a'.repeat(53) + '.b32.i2p', 'short.b32.i2p', 'A'.repeat(52) + '.b32.i2p', '1'.repeat(52) + '.b32.i2p',
    '-mirror.i2p', 'mirror.i2p.', 'i2p', '.i2p', 'mirror..i2p', 'mirror.I2P', 'http://mirror.i2p', 'mirror_x.i2p', 'a'.repeat(64) + '.i2p', 'mirror.onion'];
  for (const a of ok) assert.ok(!fieldErr(errsFor('i2p', { addressMode: 'entered', address: a }), 'address'), a);
  for (const a of bad) assert.ok(fieldErr(errsFor('i2p', { addressMode: 'entered', address: a }), 'address'), 'accepted ' + a);
});

test('i2pd keys file must be a bare .dat file name; required only for i2pd', () => {
  for (const k of ['../keys.dat', '/var/lib/i2pd/keys.dat', 'dir/keys.dat', 'keys.txt', 'keys.dat.bak', '.dat', 'k eys.dat', 'keys.DAT', 'C:\\k.dat', 'keys\n.dat']) {
    assert.ok(fieldErr(errsFor('i2p', { keysFile: k }), 'keysFile'), 'accepted ' + JSON.stringify(k));
  }
  assert.ok(!fieldErr(errsFor('i2p', { keysFile: 'mirror-keys.dat' }), 'keysFile'));
  assert.ok(errsFor('i2p', { router: 'i2pd', keysFile: '' }).missing.some((m) => m.field === 'keysFile'));
  assert.ok(!errsFor('i2p', { router: 'java-i2p', keysFile: '' }).missing.some((m) => m.field === 'keysFile'));
});

test('tunnel name: token characters only', () => {
  for (const n of ['a b', 'a/b', '[x]', 'a\nb', 'x;y', '']) {
    const v = errsFor('i2p', { tunnelName: n });
    assert.ok(fieldErr(v, 'tunnelName') || v.missing.some((m) => m.field === 'tunnelName'), JSON.stringify(n));
  }
});

test('HiddenServiceDir inside a web-served folder is rejected', () => {
  for (const p of ['/var/www/hs', '/var/www/html/tor', '/srv/site/hs', '/home/u/public_html/hs', '/usr/share/nginx/html/hs', '/srv/mirror/dist/keys', '/opt/htdocs/x', '/srv/PUBLIC/hs']) {
    assert.ok(fieldErr(errsFor('tor-onion', { hiddenServiceDir: p }), 'hiddenServiceDir'), 'accepted ' + p);
  }
  assert.ok(!fieldErr(errsFor('tor-onion', { hiddenServiceDir: '/var/lib/tor/mirror/' }), 'hiddenServiceDir'));
  assert.ok(fieldErr(errsFor('tor-onion', { hiddenServiceDir: 'relative/hs' }), 'hiddenServiceDir'));
  assert.ok(fieldErr(errsFor('tor-onion', { hiddenServiceDir: '/var/lib/tor/../www/hs' }), 'hiddenServiceDir'));
});

test('HiddenServiceDir inside a web root is rejected for Windows paths and other common web roots', () => {
  for (const p of ['C:\\www\\hs', 'C:\\inetpub\\wwwroot\\hs', '/srv/http/hs', '/var/wwwroot/hs']) {
    assert.ok(fieldErr(errsFor('tor-onion', { hiddenServiceDir: p }), 'hiddenServiceDir'), 'accepted ' + p);
  }
});

test('free-text and label fields with credentials are errors; control chars in single-line fields are errors', () => {
  assert.ok(fieldErr(errsFor('generic-static', { providerName: 'password=hunter22' }), 'providerName'));
  assert.ok(fieldErr(errsFor('generic-static', { deployMethod: 'token: abcdefgh' }), 'deployMethod'));
  assert.ok(fieldErr(errsFor('generic-static', {}, { label: 'api_key=abcd1234' }), 'label'));
  assert.ok(fieldErr(errsFor('generic-static', {}, { notes: 'Bearer abcdefghijklmnopqrstuvwxyz' }), 'notes'));
  assert.ok(fieldErr(errsFor('generic-static', {}, { label: 'a\nb' }), 'label'));
  assert.ok(fieldErr(errsFor('generic-static', { providerName: 'a\u202eb' }), 'providerName'));
});

test('sanitizeDestination drops unknown fields (password/apiToken/privateKey) at top level and in config', () => {
  const r = raw('generic-static', { address: 'https://x.example/', password: 'CANARY1', apiToken: 'CANARY2', privateKey: 'CANARY3', __proto__: { polluted: 1 } },
    { password: 'CANARY4', apiToken: 'CANARY5', privateKey: 'CANARY6', secrets: { a: 'CANARY7' } });
  r.capabilities = { 'tls-https': 'yes', bogus: 'yes', password: 'CANARY8', 'custom-headers': { declared: 'no', extra: 'CANARY9' } };
  const d = dest.sanitizeDestination(r);
  assert.deepStrictEqual(Object.keys(d).sort(), ['basePath', 'capabilities', 'config', 'id', 'label', 'notes', 'type']);
  assert.deepStrictEqual(Object.keys(d.config).sort(), ['address', 'declaredMaxFileBytes', 'declaredMaxFiles', 'deployMethod', 'providerName']);
  assert.deepStrictEqual(Object.keys(d.capabilities).sort(), dest.capabilityKeysFor('generic-static').sort());
  assert.strictEqual(d.capabilities['custom-headers'], 'no');
  assert.ok(!/CANARY/.test(JSON.stringify(d)));
  assert.strictEqual({}.polluted, undefined);
});

test('sanitizeDestination: hostile types and values', () => {
  for (const x of [null, 5, 'x', [], { type: 'nope' }, { type: ['generic-static'] }, { type: 'GENERIC-STATIC' }]) {
    assert.strictEqual(dest.sanitizeDestination(x), null, JSON.stringify(x));
  }
  const d = dest.sanitizeDestination(raw('generic-static', { address: { toString() { return 'https://evil/'; } }, providerName: ['a'], declaredMaxFiles: 12 }, { label: { x: 1 }, id: '../../x' }));
  assert.strictEqual(d.config.address, '');
  assert.strictEqual(d.config.providerName, '');
  assert.strictEqual(d.config.declaredMaxFiles, '12');
  assert.strictEqual(d.label, 'Generic static hosting');
  assert.ok(dest.isValidId(d.id) && d.id !== '../../x');
  // Overlong fields are bounded (max+1) so validation reports them
  const long = dest.sanitizeDestination(raw('generic-static', {}, { notes: 'n'.repeat(1e6), label: 'l'.repeat(1e5) }));
  assert.strictEqual(long.notes.length, core.LIMITS.maxNotesLength + 1);
  assert.strictEqual(long.label.length, core.LIMITS.maxLabelLength + 1);
  const v = dest.validateDestination(long);
  assert.ok(fieldErr(v, 'notes') && fieldErr(v, 'label'));
});

test('capability values outside unknown/yes/no become unknown', () => {
  const d = dest.sanitizeDestination(raw('local-server', {}, { capabilities: { 'byte-exact-delivery': 'YES', 'custom-headers': true, 'content-type-control': 1, 'directory-index': 'verified' } }));
  for (const v of Object.values(d.capabilities)) assert.strictEqual(v, 'unknown');
});

// -------------------------------------------------------------- readiness

function localDest(caps, cfg, extra) {
  return dest.sanitizeDestination(Object.assign(raw('local-server', Object.assign({ serverSoftware: 'nginx', listenAddress: '127.0.0.1:8080', documentRoot: '/srv/m' }, cfg || {})), { capabilities: caps || {} }, extra || {}));
}

test('readiness: needs-configuration → blocked-by-declared-capability → unverified → ready-for-manual-review', () => {
  const S = dest.STATES;
  // Missing required config wins over everything, even with all caps "no".
  const noCaps = {};
  Object.keys(ALL_YES).forEach((k) => { noCaps[k] = 'no'; });
  assert.strictEqual(dest.assessDestination(localDest(noCaps, { documentRoot: '' }), null).state, S.NEEDS_CONFIGURATION);
  // A field error also means needs-configuration.
  assert.strictEqual(dest.assessDestination(localDest(ALL_YES, { listenAddress: 'nope' }), null).state, S.NEEDS_CONFIGURATION);
  // Credential in notes → needs-configuration.
  assert.strictEqual(dest.assessDestination(localDest(ALL_YES, {}, { notes: 'password=hunter22' }), null).state, S.NEEDS_CONFIGURATION);
  // Required declared "no" beats unknown.
  const blocked = dest.assessDestination(localDest({ 'byte-exact-delivery': 'no' }), null);
  assert.strictEqual(blocked.state, S.BLOCKED);
  assert.deepStrictEqual(blocked.blockingCapabilities, ['byte-exact-delivery']);
  // Unknown required → unverified.
  const unv = dest.assessDestination(localDest({}), null);
  assert.strictEqual(unv.state, S.UNVERIFIED);
  assert.ok(unv.unknownRequiredCapabilities.includes('byte-exact-delivery'));
  // All required declared yes → ready-for-manual-review, verified still false.
  const ready = dest.assessDestination(localDest(ALL_YES), null);
  assert.strictEqual(ready.state, S.READY);
  assert.strictEqual(ready.verified, false);
  assert.match(ready.stateLabel, /not verified/);
  // Recommended "no" does not block.
  const rec = dest.assessDestination(localDest(Object.assign({}, ALL_YES, { 'log-retention-control': 'no' })), null);
  assert.strictEqual(rec.state, S.READY);
});

test('readiness: derived file-size/count limits block when the declared limit is below the site', async () => {
  const { inventory } = require('./_helpers.js');
  const inv = await inventory({ 'index.html': 'x'.repeat(100), 'b.txt': 'y' });
  const mk = (maxBytes, maxFiles) => dest.sanitizeDestination(Object.assign(raw('generic-static', { address: 'https://m.example/', declaredMaxFileBytes: maxBytes, declaredMaxFiles: maxFiles }), { capabilities: ALL_YES }));
  const ctx = { inventory: inv, headers: plan.defaultHeaders() };
  assert.strictEqual(dest.assessDestination(mk('100', '2'), ctx).state, dest.STATES.READY);
  assert.strictEqual(dest.assessDestination(mk('99', '2'), ctx).state, dest.STATES.BLOCKED);
  assert.strictEqual(dest.assessDestination(mk('100', '1'), ctx).state, dest.STATES.BLOCKED);
  assert.strictEqual(dest.assessDestination(mk('', '2'), ctx).state, dest.STATES.UNVERIFIED);
  assert.strictEqual(dest.assessDestination(mk('1e9', '2'), ctx).state, dest.STATES.NEEDS_CONFIGURATION);
});

test('readiness: subdirectory-base-path and tls-https become required only when relevant', () => {
  const noSub = Object.assign({}, ALL_YES); delete noSub['subdirectory-base-path'];
  assert.strictEqual(dest.assessDestination(localDest(noSub), null).state, dest.STATES.READY);
  assert.strictEqual(dest.assessDestination(localDest(noSub, {}, { basePath: '/sub/' }), null).state, dest.STATES.UNVERIFIED);
  const noTls = Object.assign({}, ALL_YES); delete noTls['tls-https'];
  assert.strictEqual(dest.assessDestination(localDest(noTls), null).state, dest.STATES.READY);
  assert.strictEqual(dest.assessDestination(localDest(noTls, { publicUrl: 'https://m.example/' }), null).state, dest.STATES.UNVERIFIED);
  const onion = dest.sanitizeDestination(Object.assign(raw('tor-onion', { hiddenServiceDir: '/var/lib/tor/x' }), { capabilities: ALL_YES }));
  assert.strictEqual(dest.assessDestination(onion, null).capabilities.find((r) => r.key === 'tls-https').level, 'not-applicable');
});

test('readiness: "entered" onion/i2p address mode with empty address is needs-configuration; pending does not block', () => {
  const t = (cfg) => dest.assessDestination(dest.sanitizeDestination(Object.assign(raw('tor-onion', Object.assign({ hiddenServiceDir: '/var/lib/tor/x' }, cfg)), { capabilities: ALL_YES })), null);
  assert.strictEqual(t({ addressMode: 'entered', address: '' }).state, dest.STATES.NEEDS_CONFIGURATION);
  const p = t({ addressMode: 'pending-operator' });
  assert.strictEqual(p.state, dest.STATES.READY);
  assert.ok(p.pending.length === 1);
  assert.strictEqual(t({ addressMode: 'generated' }).state, dest.STATES.NEEDS_CONFIGURATION);
});

test('no state string or label claims verified / live / published', () => {
  const ok = (s) => {
    const l = String(s).toLowerCase().replace(/unverified|not verified|never verifies|verified: false/g, '');
    return !/verified|\blive\b|published/.test(l);
  };
  for (const s of Object.values(dest.STATES)) assert.ok(ok(s), s);
  for (const s of Object.values(dest.STATE_LABELS)) assert.ok(ok(s), s);
  assert.ok(!Object.values(dest.STATES).includes('verified'));
});

test('effectiveBaseUrl: never includes userinfo/query; null when not known; uses origin + base path', () => {
  const g = (address, bp) => dest.effectiveBaseUrl(dest.sanitizeDestination(raw('generic-static', { address }, { basePath: bp || '/' })));
  assert.strictEqual(g('https://m.example/x/', '/lib/'), 'https://m.example/lib/');
  assert.strictEqual(g('https://m.example/x/?q=CANARY#f', '/lib/'), null); // invalid address (query/fragment) has no base URL
  assert.strictEqual(g('https://u:CANARY@m.example/'), null);
  assert.strictEqual(g('not a url'), null);
  assert.strictEqual(g('https://m.example/', '/../'), null);
  const onionPending = dest.sanitizeDestination(raw('tor-onion', { addressMode: 'pending-operator', address: V3 }));
  assert.strictEqual(dest.effectiveBaseUrl(onionPending), null);
  const onionEntered = dest.sanitizeDestination(raw('tor-onion', { addressMode: 'entered', address: V3 }));
  assert.strictEqual(dest.effectiveBaseUrl(onionEntered), 'http://' + V3 + '/');
});

test('effectiveBaseUrl is null for addresses that failed validation (ftp:, onion/i2p hosts, short .b32.i2p)', () => {
  const g = (address) => dest.effectiveBaseUrl(dest.sanitizeDestination(raw('generic-static', { address })));
  assert.strictEqual(g('ftp://files.example.com/'), null);
  assert.strictEqual(g('https://' + 'a'.repeat(55) + 'd.onion/'), null);
  assert.strictEqual(g('javascript:alert(1)'), null);
  const i2p = dest.sanitizeDestination(raw('i2p', { addressMode: 'entered', address: 'short.b32.i2p' }));
  assert.strictEqual(dest.effectiveBaseUrl(i2p), null);
});

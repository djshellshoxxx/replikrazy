'use strict';
// Unit tests: destination validation, secret detection, status evaluation, import.

const test = require('node:test');
const assert = require('node:assert/strict');

const D = require('../../src/core/destinations.js');
const demo = require('../../src/demo-data.js');

// Credential-shaped strings are assembled at runtime so none sit in the repo verbatim.
const FAKE = {
  github: 'gh' + 'p_' + 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4',
  apiKey: 's' + 'k-' + 'abcdefghijklmnopqrstuvwx1234',
  pem: '-----BEGIN ' + 'OPENSSH PRIVATE KEY-----',
  blob: 'Zm9vYmFyQmF6UXV4MTIzNDU2Nzg5MEFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFla'
};

const ONION = 'a'.repeat(52) + '2345' + '.onion';
const B32 = 'b'.repeat(48) + '7777' + '.b32.i2p';

const facts = { hasRootIndex: true, hasAnyIndex: true, has404: true, rootRelativeRefCount: 3, externalHosts: ['cdn.example.com'], usesBrowserStorage: false };
const stats = { largestFileBytes: 3 * 1024 * 1024 };
const headers = [{ name: 'X-Content-Type-Options', value: 'nosniff' }];
const allYes = Object.fromEntries(D.CAP_KEYS.map((k) => [k, 'yes']));

function staticHost(over) {
  return D.createDestination('static-host', Object.assign({
    id: 'host', name: 'Host', providerLabel: 'Example provider', address: 'https://mirror.example.org/', maxFileMB: 10, capabilities: allYes
  }, over));
}

test('findSecretLike flags credential-shaped text and ignores ordinary text', () => {
  for (const s of [FAKE.github, FAKE.apiKey, FAKE.pem, FAKE.blob, 'password=' + 'hunter2', 'token: ' + 'abc123',
    'https://user:' + 'pw@example.org/', 'Bearer ' + 'abcdefghijklmnopqrstu', '== ed25519v1-secret: type0 ==']) {
    assert.ok(D.findSecretLike(s), 'should flag: ' + s.slice(0, 12));
  }
  for (const s of ['', 'https://mirror.example.org/', '/srv/mirror/lantern-field-notes/production/site/public/html',
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', ONION, B32,
    'Demo record. All values are user-declared examples.']) {
    assert.equal(D.findSecretLike(s), null, 'should not flag: ' + s);
  }
});

test('validate: required fields per type', () => {
  const req = (type) => D.validate(D.createDestination(type, { id: 'x' })).errors.filter((e) => e.code === 'required').map((e) => e.field).sort();
  assert.deepEqual(req('static-host'), ['address', 'name', 'providerLabel']);
  assert.deepEqual(req('local-server'), ['documentRoot', 'listen', 'name', 'serverSoftware']);
  assert.deepEqual(req('tor-onion'), ['documentRoot', 'listen', 'name', 'serverSoftware']);
  assert.deepEqual(req('i2p'), ['documentRoot', 'listen', 'name', 'router', 'serverSoftware']);
  assert.ok(D.validate({ type: 'ftp' }).errors.some((e) => e.code === 'type-invalid'));
});

test('validate: addresses', () => {
  const codes = (over) => D.validate(staticHost(over)).errors.map((e) => e.code);
  assert.deepEqual(codes({}), []);
  assert.ok(codes({ address: 'mirror.example.org' }).includes('address-invalid'));
  assert.ok(codes({ address: 'ftp://mirror.example.org/' }).includes('address-scheme'));
  assert.ok(codes({ address: 'https://u:' + 'p@mirror.example.org/' }).includes('address-credentials'));
  assert.ok(codes({ address: 'https://mirror.example.org/?k=1' }).includes('address-query'));
  assert.ok(codes({ address: 'http://' + ONION + '/' }).includes('address-wrong-type'));
  assert.ok(D.validate(staticHost({ address: 'http://mirror.example.org/' })).warnings.some((w) => w.code === 'address-http'));

  const tor = (address) => D.validate(D.createDestination('tor-onion', { id: 't', name: 'T', serverSoftware: 'nginx', listen: '127.0.0.1:8080', documentRoot: '/srv/t', address }));
  assert.deepEqual(tor(ONION).errors, []);
  assert.equal(tor('http://' + ONION.toUpperCase() + '/').normalized.address, ONION);
  assert.ok(tor('abcdefghijklmnop.onion').errors.some((e) => e.code === 'onion-v2'));
  assert.ok(tor('example.org').errors.some((e) => e.code === 'onion-invalid'));
  assert.ok(tor('').warnings.some((w) => w.code === 'address-pending'));

  const i2p = (address) => D.validate(D.createDestination('i2p', { id: 'i', name: 'I', router: 'i2pd', serverSoftware: 'nginx', listen: '127.0.0.1:8080', documentRoot: '/srv/i', address }));
  assert.deepEqual(i2p(B32).errors, []);
  assert.deepEqual(i2p('lantern-notes.i2p').errors, []);
  assert.ok(i2p('short.b32.i2p').errors.some((e) => e.code === 'i2p-b32-invalid'));
  assert.ok(i2p('example.org').errors.some((e) => e.code === 'i2p-invalid'));
});

test('validate: listen, document root, base path, numbers, capabilities', () => {
  const base = { id: 'l', name: 'L', serverSoftware: 'nginx', listen: '127.0.0.1:8080', documentRoot: '/srv/site' };
  const codes = (type, over) => D.validate(D.createDestination(type, Object.assign({}, base, over))).errors.map((e) => e.code);
  assert.deepEqual(codes('local-server', {}), []);
  assert.ok(codes('local-server', { listen: '127.0.0.1' }).includes('listen-invalid'));
  assert.ok(codes('local-server', { listen: '127.0.0.1:70000' }).includes('listen-invalid'));
  assert.ok(codes('local-server', { listen: '999.1.1.1:80' }).includes('listen-invalid'));
  assert.deepEqual(codes('local-server', { listen: '192.168.1.5:80' }), []);
  assert.ok(D.validate(D.createDestination('local-server', Object.assign({}, base, { listen: '0.0.0.0:80' }))).warnings.some((w) => w.code === 'listen-all-interfaces'));
  assert.ok(codes('tor-onion', { listen: '192.168.1.5:80' }).includes('listen-not-loopback'));
  assert.deepEqual(codes('tor-onion', { listen: '[::1]:8080' }), []);
  assert.deepEqual(codes('tor-onion', { listen: 'localhost:8080' }), []);
  assert.ok(codes('local-server', { documentRoot: 'srv/site' }).includes('docroot-invalid'));
  assert.ok(codes('local-server', { documentRoot: '/srv/../etc' }).includes('docroot-invalid'));
  assert.ok(codes('local-server', { documentRoot: '/srv/a;rm' }).includes('docroot-invalid'));
  assert.ok(codes('local-server', { documentRoot: '/' }).includes('docroot-unsafe'));
  assert.ok(codes('tor-onion', { documentRoot: '/var/lib/tor' }).includes('docroot-unsafe'));
  assert.equal(D.validate(D.createDestination('local-server', Object.assign({}, base, { documentRoot: '/srv/site/' }))).normalized.documentRoot, '/srv/site');
  assert.ok(codes('local-server', { basePath: 'mirror' }).includes('basepath-leading-slash'));
  assert.ok(codes('local-server', { maxFileMB: -1 }).includes('maxfile-invalid'));
  assert.ok(codes('local-server', { maxFileMB: 'lots' }).includes('maxfile-invalid'));
  assert.equal(D.validate(D.createDestination('local-server', Object.assign({}, base, { maxFileMB: '12' }))).normalized.maxFileMB, 12);
  assert.ok(codes('local-server', { serverSoftware: 'iis' }).includes('enum'));
  assert.ok(codes('local-server', { capabilities: { https: 'maybe' } }).includes('cap-invalid'));
  assert.ok(codes('local-server', { name: 'x'.repeat(81) }).includes('too-long'));
  assert.ok(codes('local-server', { name: 'a\u0007b' }).includes('control-char'));
  assert.ok(codes('local-server', { id: 'Bad Id' }).includes('id-invalid'));
});

test('validate: secret-like values are errors and unknown fields are dropped', () => {
  const v = D.validate(Object.assign(staticHost({ notes: 'api_key=' + 'abc123' }), { password: 'x', capabilities: Object.assign({ teleport: 'yes' }, allYes) }));
  assert.ok(v.errors.some((e) => e.field === 'notes' && e.code === 'secret-like'));
  assert.ok(!JSON.stringify(v.errors).includes('abc123'), 'error messages never echo the value');
  assert.equal(v.normalized.password, undefined);
  assert.equal(v.normalized.capabilities.teleport, undefined);
  assert.ok(v.warnings.some((w) => w.code === 'unknown-field'));
  assert.ok(v.warnings.some((w) => w.code === 'unknown-capability'));
});

test('evaluate: status ladder incomplete > blocked > unverified > ready', () => {
  const ctx = { facts, stats, requiredHeaders: headers };
  assert.equal(D.evaluate(staticHost({ name: '' }), ctx).status, 'incomplete');
  assert.equal(D.evaluate(staticHost({ capabilities: Object.assign({}, allYes, { customHeaders: 'no' }) }), ctx).status, 'blocked');
  assert.equal(D.evaluate(staticHost({ maxFileMB: 2 }), ctx).status, 'blocked');
  assert.equal(D.evaluate(staticHost({ capabilities: Object.assign({}, allYes, { correctMimeTypes: 'unknown' }) }), ctx).status, 'unverified');
  assert.equal(D.evaluate(staticHost({ maxFileMB: null }), ctx).status, 'unverified');
  const ready = D.evaluate(staticHost(), ctx);
  assert.equal(ready.status, 'ready-for-manual-review');
  assert.equal(ready.verified, false);
  // Recommended items never block.
  assert.equal(D.evaluate(staticHost({ capabilities: Object.assign({}, allYes, { https: 'no', customErrorPages: 'no' }) }), ctx).status, 'ready-for-manual-review');
});

test('evaluate: requirements depend on site, headers and base path', () => {
  const sub = staticHost({ basePath: '/mirror/', capabilities: Object.assign({}, allYes, { subpathHosting: 'no' }) });
  const ev = D.evaluate(sub, { facts, stats, requiredHeaders: headers });
  assert.equal(ev.status, 'blocked');
  assert.deepEqual(ev.blockers.map((r) => r.key), ['subpathHosting']);
  assert.ok(ev.warnings.some((w) => w.code === 'root-relative-under-subpath'));
  const noHeaders = D.evaluate(staticHost({ capabilities: Object.assign({}, allYes, { customHeaders: 'no' }) }), { facts, stats, requiredHeaders: [] });
  assert.equal(noHeaders.status, 'ready-for-manual-review');
  assert.equal(noHeaders.requirements.find((r) => r.key === 'customHeaders').level, 'n/a');
  const tor = D.createDestination('tor-onion', { id: 't', name: 'T', serverSoftware: 'nginx', listen: '127.0.0.1:8080', documentRoot: '/srv/t', maxFileMB: 10, capabilities: Object.assign({}, allYes, { https: 'unknown' }) });
  const tev = D.evaluate(tor, { facts, stats, requiredHeaders: headers });
  assert.equal(tev.status, 'ready-for-manual-review');
  assert.equal(tev.requirements.find((r) => r.key === 'https').level, 'n/a');
  assert.ok(tev.warnings.some((w) => w.code === 'external-refs-anon'));
  assert.ok(tev.warnings.some((w) => w.code === 'address-pending'));
});

test('evaluate: demo sample destinations reach the documented statuses', () => {
  const ctx = { facts, stats: { largestFileBytes: 2209 }, requiredHeaders: headers };
  const got = Object.fromEntries(demo.destinations.map((d) => [d.id, D.evaluate(d, ctx).status]));
  assert.deepEqual(got, {
    'static-host-a': 'unverified',
    'static-host-b': 'blocked',
    'lan-server': 'ready-for-manual-review',
    'onion-mirror': 'ready-for-manual-review',
    'i2p-eepsite-draft': 'incomplete'
  });
});

test('redactForExport replaces secret-like fields', () => {
  const r = D.redactForExport(staticHost({ notes: 'token=' + 'abc', providerLabel: FAKE.github }));
  assert.equal(r.notes, '[REDACTED: looked like a credential]');
  assert.equal(r.providerLabel, '[REDACTED: looked like a credential]');
  assert.equal(r.address, 'https://mirror.example.org/');
  assert.ok(!JSON.stringify(r).includes(FAKE.github));
});

test('parseImport: bounded, deduplicated, secrets cleared', () => {
  const big = 'x'.repeat(D.MAX_IMPORT_BYTES + 1);
  assert.ok(D.parseImport(big).errors[0].includes('limit'));
  assert.ok(D.parseImport('{nope').errors[0].includes('not valid JSON'));
  assert.ok(D.parseImport('{"a":1}').errors[0].includes('Expected'));
  const res = D.parseImport(JSON.stringify({ destinations: [staticHost({ id: 'host' }), staticHost({ id: 'host', notes: 'password=' + 'pw1' }), 7] }), ['host']);
  assert.deepEqual(res.destinations.map((d) => d.id), ['host-2', 'host-3']);
  assert.equal(res.destinations[1].notes, '');
  assert.ok(res.errors.some((e) => e.includes('not an object')));
  assert.ok(res.warnings.some((w) => w.includes('cleared')));
  const many = Array.from({ length: 60 }, (_, i) => staticHost({ id: 'h' + i }));
  assert.equal(D.parseImport(JSON.stringify(many)).destinations.length, D.MAX_DESTINATIONS);
  const ids = D.parseImport(JSON.stringify(demo.destinations)).destinations.map((d) => d.id);
  assert.deepEqual(ids, demo.destinations.map((d) => d.id));
});

test('validateList finds duplicate ids; uniqueId avoids taken ids', () => {
  assert.equal(D.validateList([{ id: 'a' }, { id: 'a' }])[0].code, 'id-duplicate');
  assert.equal(D.uniqueId('My Host!', ['my-host', 'my-host-2']), 'my-host-3');
  assert.equal(D.uniqueId('', []), 'destination');
});

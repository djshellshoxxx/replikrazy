'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { core, dest, plan, raw } = require('./_helpers.js');

const imp = plan.importDestinations;

function protoClean() {
  assert.strictEqual({}.polluted, undefined, 'Object.prototype polluted');
  assert.strictEqual({}.isAdmin, undefined, 'Object.prototype polluted');
  assert.strictEqual(Object.prototype.polluted, undefined);
  assert.strictEqual([].polluted, undefined);
}

test('importDestinations: non-string, invalid JSON and wrong schemas throw PlannerErrors with codes', () => {
  for (const x of [null, undefined, 5, {}, [], Buffer.from('[]')]) assert.throws(() => imp(x), (e) => e.code === 'BAD_IMPORT', String(x));
  for (const x of ['', '{', '[1,', 'undefined', "{'a':1}", '\u0000', 'NaN']) assert.throws(() => imp(x), (e) => e.code === 'BAD_JSON', JSON.stringify(x));
  for (const x of ['null', '5', '"str"', 'true', '{}', '{"schema":"other"}', '{"destinations":[]}', '{"schema":"replikrazy.offline-mirror-plan-x","destinations":[]}']) {
    assert.throws(() => imp(x), (e) => e.code === 'BAD_SCHEMA', x);
  }
  for (const x of ['{"schema":"replikrazy.offline-mirror-destinations"}', '{"schema":"replikrazy.offline-mirror-destinations","destinations":{"0":{}}}', '{"schema":"replikrazy.offline-mirror-destinations","destinations":"x"}']) {
    assert.throws(() => imp(x), (e) => e.code === 'BAD_SCHEMA', x);
  }
});

test('importDestinations: size limit (characters) enforced before parsing', () => {
  const big = '[' + ' '.repeat(core.LIMITS.maxImportBytes) + ']';
  assert.throws(() => imp(big), (e) => e.code === 'IMPORT_TOO_LARGE');
  const atLimit = '[' + ' '.repeat(core.LIMITS.maxImportBytes - 2) + ']';
  assert.deepStrictEqual(imp(atLimit).destinations, []);
});

test('importDestinations: size limit is measured in bytes, not UTF-16 code units', () => {
  const s = JSON.stringify([{ type: 'generic-static', notes: '\u20ac'.repeat(2e6) }]);
  assert.ok(Buffer.byteLength(s) > core.LIMITS.maxImportBytes);
  assert.throws(() => imp(s), (e) => e.code === 'IMPORT_TOO_LARGE');
});

test('importDestinations: deeply nested JSON is rejected cleanly or handled, never crashes with a non-PlannerError', () => {
  for (const s of ['['.repeat(1e6), '['.repeat(2e5) + ']'.repeat(2e5), '{"a":'.repeat(2e5) + '1' + '}'.repeat(2e5)]) {
    try { const r = imp(s); assert.ok(Array.isArray(r.destinations)); } catch (e) { assert.strictEqual(e.name, 'PlannerError', e.message); }
  }
});

test('importDestinations: more than maxDestinations entries are truncated with a warning', () => {
  const list = Array.from({ length: core.LIMITS.maxDestinations + 25 }, (_, i) => raw('generic-static', {}, { id: 'id' + i }));
  const r = imp(JSON.stringify(list));
  assert.strictEqual(r.destinations.length, core.LIMITS.maxDestinations);
  assert.ok(r.warnings.some((w) => /Only the first/.test(w)));
  const r2 = imp(JSON.stringify({ schema: plan.DEST_SCHEMA, destinations: list }));
  assert.strictEqual(r2.destinations.length, core.LIMITS.maxDestinations);
});

test('importDestinations: prototype-pollution payloads have no effect', () => {
  const payloads = [
    '{"__proto__":{"polluted":1},"schema":"replikrazy.offline-mirror-destinations","destinations":[]}',
    '[{"type":"generic-static","__proto__":{"isAdmin":true,"polluted":1},"config":{"__proto__":{"polluted":1},"address":"https://x.example/"},"capabilities":{"__proto__":{"tls-https":"yes"}}}]',
    '[{"type":"generic-static","constructor":{"prototype":{"polluted":1}},"config":{"constructor":{"prototype":{"polluted":1}}}}]',
    '{"schema":"replikrazy.offline-mirror-destinations","destinations":[],"settings":{"__proto__":{"polluted":1},"headers":[{"__proto__":{"polluted":1},"name":"X-A","value":"1"}]}}',
    '{"schema":"replikrazy.offline-mirror-plan","destinations":[{"record":{"type":"i2p","__proto__":{"polluted":1}}},{"__proto__":{"record":{"type":"generic-static"}}}]}',
    '[{"type":"generic-static","id":"__proto__"},{"type":"generic-static","id":"constructor"},{"type":"generic-static","id":"hasOwnProperty"}]'
  ];
  for (const p of payloads) {
    const r = imp(p);
    protoClean();
    for (const d of r.destinations) {
      assert.deepStrictEqual(Object.keys(d).sort(), ['basePath', 'capabilities', 'config', 'id', 'label', 'notes', 'type']);
      assert.strictEqual(Object.getPrototypeOf(d), Object.prototype);
      assert.strictEqual(Object.getPrototypeOf(d.config), Object.prototype);
      assert.strictEqual(d.isAdmin, undefined);
      for (const v of Object.values(d.capabilities)) assert.strictEqual(v, 'unknown');
      assert.ok(dest.isValidId(d.id));
    }
    if (r.settings) {
      assert.strictEqual(r.settings.polluted, undefined);
      for (const h of r.settings.headers) assert.deepStrictEqual(Object.keys(h).sort(), ['name', 'value']);
    }
  }
  // ids must be unique after import
  const r = imp(payloads[5]);
  assert.strictEqual(new Set(r.destinations.map((d) => d.id)).size, 3);
});

test('createDestination overrides with __proto__/constructor keys do not pollute', () => {
  const over = JSON.parse('{"__proto__":{"polluted":1},"config":{"__proto__":{"polluted":1}},"capabilities":{"__proto__":{"polluted":1}}}');
  const d = dest.createDestination('generic-static', over);
  protoClean();
  assert.strictEqual(d.polluted, undefined);
  assert.strictEqual(d.config.polluted, undefined);
});

test('importDestinations: duplicate ids are made unique; junk entries skipped with warnings', () => {
  const r = imp(JSON.stringify([raw('generic-static', {}, { id: 'same' }), raw('i2p', {}, { id: 'same' }), null, 5, { type: 'nope' }, 'x', []]));
  assert.strictEqual(r.destinations.length, 2);
  assert.notStrictEqual(r.destinations[0].id, r.destinations[1].id);
  assert.strictEqual(r.destinations[0].id, 'same');
  assert.strictEqual(r.warnings.filter((w) => /skipped/.test(w)).length, 5);
});

test('importDestinations: unknown config keys are dropped and reported (names escaped), top-level unknown keys dropped', () => {
  const r = imp(JSON.stringify([raw('generic-static', { password: 'CANARYIMP1', 'evil\u0000key': 1 }, { apiToken: 'CANARYIMP2' })]));
  assert.ok(r.warnings.some((w) => /password/.test(w)));
  assert.ok(!r.warnings.join('\n').includes('\u0000'));
  assert.ok(!JSON.stringify(r).includes('CANARYIMP'));
});

test('importDestinations: settings are sanitized; invalid settings produce a warning, not an exception', () => {
  const r = imp(JSON.stringify({ schema: plan.DEST_SCHEMA, destinations: [], settings: { siteLabel: 'x'.repeat(1000), headers: [{ name: 'Set-Cookie', value: 'a' }], advertiseOnionLocation: 'yes' } }));
  assert.ok(r.settings.siteLabel.length <= core.LIMITS.maxLabelLength + 1);
  assert.strictEqual(r.settings.advertiseOnionLocation, false);
  assert.ok(r.warnings.some((w) => /settings/.test(w)));
  const r2 = imp('[]');
  assert.strictEqual(r2.settings, null);
});

test('importDestinations: capability values accepted in plan-export shape {declared}', () => {
  const r = imp(JSON.stringify([Object.assign(raw('local-server', {}), { capabilities: { 'byte-exact-delivery': { declared: 'yes' }, 'custom-headers': { declared: 'verified' } } })]));
  assert.strictEqual(r.destinations[0].capabilities['byte-exact-delivery'], 'yes');
  assert.strictEqual(r.destinations[0].capabilities['custom-headers'], 'unknown');
});

test('importDestinations: rejects explicit unsupported versions without changing missing-version legacy', () => {
  for (const schema of [plan.SCHEMA, plan.DEST_SCHEMA]) {
    const d = raw('generic-static', { address: 'https://example.invalid/' });
    const record = { schema, destinations: schema === plan.SCHEMA ? [{ record: d }] : [d] };
    assert.strictEqual(imp(JSON.stringify(record)).destinations.length, 1);
    assert.strictEqual(imp(JSON.stringify({ ...record, schemaVersion: 1 })).destinations.length, 1);
    for (const schemaVersion of [0, 2, 999, '1', null]) {
      assert.throws(() => imp(JSON.stringify({ ...record, schemaVersion })), e => e.name === 'PlannerError' && e.code === 'BAD_SCHEMA');
    }
  }
});

test('importDestinations: malformed plan destination containers produce only a fixed PlannerError', () => {
  for (const destinations of [{ privateMarker: 'synthetic' }, 'synthetic', 17, false, null]) {
    assert.throws(() => imp(JSON.stringify({ schema: plan.SCHEMA, schemaVersion: 1, destinations })), e => {
      assert.strictEqual(e.name, 'PlannerError');
      assert.strictEqual(e.code, 'BAD_SCHEMA');
      assert.ok(!e.message.includes('synthetic'));
      return true;
    });
  }
});

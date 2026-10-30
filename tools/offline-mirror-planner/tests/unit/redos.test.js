'use strict';
// Catastrophic-backtracking and large-input checks for every regex-driven
// function. Each call gets a generous budget; a ReDoS would take minutes.
const test = require('node:test');
const assert = require('node:assert');
const { core, dest, plan, raw } = require('./_helpers.js');

const BUDGET_MS = 2000;
function fast(name, fn) {
  const t = process.hrtime.bigint();
  fn();
  const ms = Number(process.hrtime.bigint() - t) / 1e6;
  assert.ok(ms < BUDGET_MS, name + ' took ' + ms.toFixed(0) + ' ms');
}

const N = 1e6;

test('ReDoS: secret scanners on long hostile strings', () => {
  const inputs = {
    spaces: ' '.repeat(N),
    alnum: 'a'.repeat(N) + '!',
    mixed: 'aA1'.repeat(N / 3) + '!',
    passwordSpaces: 'password' + ' '.repeat(N),
    passwordRepeat: 'password:'.repeat(N / 9),
    tokenRepeat: 'token = '.repeat(N / 8),
    bearer: 'bearer '.repeat(N / 7),
    bearerTabs: 'bearer' + '\t'.repeat(N),
    db: 'mysql://' + 'a'.repeat(N / 2) + ':' + 'b'.repeat(N / 2),
    dbRepeat: 'mysql://a:'.repeat(N / 10),
    dbColons: 'postgres://' + 'a:'.repeat(N / 2),
    pem: '-----BEGIN ' + 'A '.repeat(N / 2),
    pemRepeat: '-----BEGIN '.repeat(N / 11),
    gh: 'ghp_'.repeat(N / 4),
    slack: 'xoxb-'.repeat(N / 5),
    aws: 'AKIA'.repeat(N / 4),
    b64: ('A'.repeat(39) + '=').repeat(N / 40)
  };
  for (const [k, s] of Object.entries(inputs)) {
    fast('scanTextForSecrets/' + k, () => core.scanTextForSecrets(s));
    fast('scanFieldForSecrets/' + k, () => core.scanFieldForSecrets(s));
  }
});

test('ReDoS: link analysis on long hostile HTML/CSS', () => {
  const inputs = [
    'href' + ' '.repeat(N), 'href=' + ' '.repeat(N), '<a href="//'.repeat(N / 11), 'url( '.repeat(N / 5), 'url("' + '/'.repeat(N),
    '@import "'.repeat(N / 9), 'src = \''.repeat(N / 7) , 'href="https://' + 'a'.repeat(N)
  ];
  for (const s of inputs) for (const ext of ['a.html', 'a.css', 'a.svg']) fast('analyseText ' + ext + ' ' + s.slice(0, 12), () => core.analyseText(ext, s));
});

test('ReDoS: path, base path, header and host validators on long strings', () => {
  const long = 'a'.repeat(N);
  fast('validateRelativePath', () => core.validateRelativePath(long));
  fast('validateRelativePath segs', () => core.validateRelativePath('a/'.repeat(N / 2)));
  fast('pathAdvisories', () => core.pathAdvisories('%2'.repeat(N / 3)));
  fast('classifySensitivePath', () => core.classifySensitivePath('a/'.repeat(N / 2) + 'x'));
  fast('classifySensitivePath2', () => core.classifySensitivePath('#'.repeat(N)));
  fast('normaliseBasePath', () => core.normaliseBasePath('/a'.repeat(N / 2)));
  fast('validateHeader', () => core.validateHeader({ name: 'X-' + long, value: long }));
  fast('validateHeader value', () => core.validateHeader({ name: 'X-A', value: 'password = '.repeat(N / 11) }));
  fast('parseHostPort', () => dest.parseHostPort(long + '!:80'));
  fast('parseHostPort labels', () => dest.parseHostPort(('a'.repeat(62) + '.').repeat(N / 63) + '-:80'));
  fast('parseHostPort ipv6', () => dest.parseHostPort('[' + ':'.repeat(N) + ']x'));
  fast('slugify', () => dest.slugify('a-'.repeat(N / 2)));
});

test('ReDoS: destination validation with maximal-length hostile fields', () => {
  const d = dest.sanitizeDestination(raw('i2p', { addressMode: 'entered', address: 'a.'.repeat(N) + '!', localTarget: '1'.repeat(N), tunnelName: '.'.repeat(N), keysFile: 'a'.repeat(N) + '.dat' }, { notes: 'token='.repeat(N / 6), label: 'x'.repeat(N) }));
  fast('validateDestination i2p', () => dest.validateDestination(d));
  const t = dest.sanitizeDestination(raw('tor-onion', { addressMode: 'entered', address: 'a'.repeat(N), hiddenServiceDir: '/www'.repeat(N / 4), localTarget: 'unix:/' + '../'.repeat(N / 3) }));
  fast('validateDestination tor', () => dest.validateDestination(t));
  const g = dest.sanitizeDestination(raw('generic-static', { address: 'https://' + 'a.'.repeat(N), providerName: 'aA1'.repeat(N) }));
  fast('validateDestination static', () => dest.validateDestination(g));
  fast('buildPlan with hostile destinations', () => plan.buildPlan({ destinations: [d, t, g], generatedAt: 'x' }));
});

test('inventory secret scan of a 2 MiB+ text file finishes quickly', async () => {
  const big = new TextEncoder().encode('token = '.repeat(400000));
  const t = Date.now();
  const inv = await core.buildInventory([{ path: 'big.txt', size: big.byteLength, read: () => Promise.resolve(big) }], { stripRoot: false });
  assert.ok(Date.now() - t < 5000);
  assert.strictEqual(inv.files.length, 1);
  assert.ok(inv.files[0].notes.some((n) => /Only the first/.test(n)));
});

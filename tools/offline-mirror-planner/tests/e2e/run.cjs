#!/usr/bin/env node
/*
 * End-to-end tests for the Offline Mirror Planner UI.
 *
 * Opens index.html from file:// in headless Chromium (Playwright) and drives
 * every feature: demo and real-folder inventory, destinations of all four
 * types, compare matrix, headers & settings, every download, the site bundle,
 * import round-trip, hostile names/labels, and network isolation.
 *
 *   node tests/e2e/run.cjs            (from tools/offline-mirror-planner)
 *
 * Playwright is resolved from: $OMP_PLAYWRIGHT_MODULE, the normal Node
 * resolution path, then /opt/npm-tools/node_modules/playwright.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert/strict');
const { pathToFileURL } = require('url');

// ------------------------------------------------------------ setup

function loadPlaywright() {
  const candidates = [];
  if (process.env.OMP_PLAYWRIGHT_MODULE) candidates.push(process.env.OMP_PLAYWRIGHT_MODULE);
  candidates.push('playwright');
  candidates.push('/opt/npm-tools/node_modules/playwright');
  const errors = [];
  for (const c of candidates) {
    try { return require(c); } catch (e) { errors.push('  ' + c + ': ' + e.message.split('\n')[0]); }
  }
  console.error('Could not load Playwright. Tried:\n' + errors.join('\n') +
    '\nInstall it (npm i -D playwright && npx playwright install chromium) or set OMP_PLAYWRIGHT_MODULE to its path.' +
    '\nSet PLAYWRIGHT_BROWSERS_PATH if browsers live outside the default cache.');
  process.exit(2);
}

const { chromium } = loadPlaywright();

const TOOL_ROOT = path.resolve(__dirname, '..', '..');
const INDEX_URL = pathToFileURL(path.join(TOOL_ROOT, 'index.html')).href;
const core = require(path.join(TOOL_ROOT, 'src/core.js'));
const D = require(path.join(TOOL_ROOT, 'src/destinations.js'));
const P = require(path.join(TOOL_ROOT, 'src/plan.js'));
const Z = require(path.join(TOOL_ROOT, 'src/zip.js'));
const demo = require(path.join(TOOL_ROOT, 'src/demo.js'));

const VERBOSE = process.argv.includes('--verbose');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'omp-e2e-'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

async function until(fn, what, timeout = 4000) {
  const end = Date.now() + timeout;
  let last;
  while (Date.now() < end) {
    try { const v = await fn(); if (v) return v; } catch (e) { last = e; }
    await sleep(40);
  }
  throw new Error('Timed out waiting for: ' + what + (last ? ' (last error: ' + last.message + ')' : ''));
}

// ------------------------------------------------------------ runner

const results = [];
async function step(name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, ms: Date.now() - t0 });
    console.log('  PASS  ' + name + ' (' + (Date.now() - t0) + ' ms)');
  } catch (e) {
    results.push({ name, ok: false, ms: Date.now() - t0, error: e });
    console.log('  FAIL  ' + name);
    console.log('        ' + (VERBOSE ? e.stack : String(e.message).split('\n').slice(0, 6).join('\n        ')));
  }
}

// ------------------------------------------------------------ browser fixture

const allRequests = [];      // every request any page made
const blocked = [];          // non-local requests (aborted)
const pageErrors = [];
const consoleErrors = [];
const alerts = [];           // alert()/prompt() dialogs: must never happen
let confirmPolicy = 'accept';
const confirms = [];

let browser, context, page;

async function openPage() {
  if (page) await page.close();
  page = await context.newPage();
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('dialog', async (d) => {
    if (d.type() === 'confirm') {
      confirms.push(d.message());
      if (confirmPolicy === 'accept') await d.accept(); else await d.dismiss();
    } else {
      alerts.push(d.type() + ': ' + d.message());
      await d.dismiss();
    }
  });
  await page.goto(INDEX_URL);
  await page.waitForSelector('html[data-omp-ready="true"]', { timeout: 5000 });
  return page;
}

async function cspViolations() { return page.evaluate(() => window.__ompCsp || []); }

// Chromium silently drops downloads when a page starts more than ~10 within
// about a second, so the tests pace them the way a person clicking would.
let lastDownloadAt = 0;
async function downloadVia(selectorOrLocator, timeout = 10000) {
  const wait = lastDownloadAt + 350 - Date.now();
  if (wait > 0) await sleep(wait);
  lastDownloadAt = Date.now();
  const loc = typeof selectorOrLocator === 'string' ? page.locator(selectorOrLocator) : selectorOrLocator;
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout }), loc.click()]);
  const p = await dl.path();
  return { name: dl.suggestedFilename(), bytes: fs.readFileSync(p), url: dl.url() };
}

async function noDownloadWithin(ms) {
  try { await page.waitForEvent('download', { timeout: ms }); return false; } catch (e) { return true; }
}

const text = (sel) => page.locator(sel).first().textContent();

// destination card helpers
const cards = () => page.locator('.dest-card');
const cardById = (id) => page.locator('.dest-card[data-dest-id="' + id + '"]');
const badgeState = (card) => card.locator('.dest-badge .badge').getAttribute('data-state');
const fieldIn = (card, key) => card.locator('[data-field="' + key + '"]');
async function lastCardId() { return cards().last().getAttribute('data-dest-id'); }
async function waitState(card, st, what) {
  await until(async () => (await badgeState(card)) === st, (what || 'card') + ' to reach state ' + st + ' (now ' + (await badgeState(card).catch(() => '?')) + ')');
}
async function listText(card, cls) {
  const n = await card.locator('.' + cls).count();
  return n ? card.locator('.' + cls).first().innerText() : '';
}
async function settle() { await page.waitForTimeout(220); } // derived views are debounced 150 ms

// ------------------------------------------------------------ expected data (computed in Node)

const ALL_STATES = Object.values(D.STATES);

async function demoInventory(opts) {
  return core.buildInventory(demo.entries(opts));
}

const FIXED_TIME = new Date('2026-01-01T00:00:00Z');

function hostileName() { return '<img src=x onerror=alert(1)>.html'; }

function writeFolder() {
  const root = path.join(TMP, 'my-site');
  const files = {
    'index.html': Buffer.from('<!doctype html><title>Real folder</title><p>Hello <a href="sub/page.html">page</a></p>\n'),
    '404.html': Buffer.from('<!doctype html><title>Not found</title>\n'),
    'sub/page.html': Buffer.from('<!doctype html><title>Sub</title><a href="/">root-absolute</a>\n'),
    'img/bin.png': Buffer.from(Array.from({ length: 2048 }, (_, i) => (i * 37 + 11) & 0xff)),
    'notes.txt': Buffer.from('CRLF line one\r\nline two\r\n'),
    '.env': Buffer.from('API_TOKEN=do-not-read-me\n'),
    '.git/HEAD': Buffer.from('ref: refs/heads/main\n'),
    '.well-known/security.txt': Buffer.from('Contact: mailto:security@example.org\n'),
    'cgi-bin/form.php': Buffer.from('<?php echo 1; ?>\n'),
    'Readme.txt': Buffer.from('upper\n'),
    'readme.txt': Buffer.from('lower\n')
  };
  files[hostileName()] = Buffer.from('<p>hostile name</p>\n');
  for (const [rel, buf] of Object.entries(files)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, buf);
    fs.utimesSync(abs, FIXED_TIME, FIXED_TIME); // whole seconds, so it can be restored exactly
  }
  return { root, files };
}

// ------------------------------------------------------------ tests

async function main() {
  console.log('Offline Mirror Planner e2e — ' + INDEX_URL);
  browser = await chromium.launch();
  context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } });
  context.on('request', (r) => allRequests.push(r.url()));
  // Defence in depth: abort anything that is not a local file, and record it.
  await context.route(/^(https?|wss?|ftp):/i, (route) => { blocked.push(route.request().url()); return route.abort(); });
  // Collect CSP violations from the very start of each document.
  await context.addInitScript(() => {
    window.__ompCsp = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      window.__ompCsp.push(e.violatedDirective + ' ' + (e.blockedURI || '') + ' ' + (e.sourceFile || '') + ':' + (e.lineNumber || ''));
    });
  });

  const invFull = await demoInventory();
  const invClean = await demoInventory({ includeBait: false, includeUnsafe: false });
  const demoFiles = new Map(demo.siteFiles().map((f) => [f.path, Buffer.from(f.bytes)]));
  const unwanted = demo.baitFiles().map((f) => f.path).concat(demo.unsafeEntries().map((f) => f.path));

  await openPage();

  await step('page loads from file:// with notice, limitations, limits and strict CSP', async () => {
    assert.equal(await page.locator('#boot-error').isHidden(), true, 'boot error banner should be hidden');
    const notice = await page.locator('#notice').innerText();
    for (const phrase of ['Nothing is uploaded, published', 'No network requests', 'declared by you', 'never creates Tor or I2P keys', 'memory only']) {
      assert.ok(notice.includes(phrase), 'notice mentions "' + phrase + '"');
    }
    assert.ok((await page.locator('.topbar-notice').innerText()).includes('Nothing is uploaded, published or verified'));
    const lim = await page.locator('#limitations-list li').allTextContents();
    assert.deepEqual(lim, P.LIMITATIONS, 'limitations list mirrors OMP.plan.LIMITATIONS');
    assert.ok(lim.some((l) => /browser storage/i.test(l) && /not shared/i.test(l)), 'storage limitation shown');
    assert.ok(lim.some((l) => /blockchain/i.test(l) && /anonymous/i.test(l)), 'blockchain limitation shown');
    assert.equal(await page.locator('#limits-list li').count(), 6);
    assert.ok((await page.locator('#limits-list').textContent()).includes(String(core.LIMITS.maxFiles)));
    const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
    for (const d of ["default-src 'none'", "script-src 'self'", "style-src 'self'", "img-src 'self' data: blob:", "connect-src 'none'", "form-action 'none'", "base-uri 'none'"]) {
      assert.ok(csp.includes(d), 'CSP includes ' + d);
    }
    assert.equal(await page.locator('script:not([src])').count(), 0, 'no inline scripts');
    assert.equal(await page.locator('style, [style]').count(), 0, 'no inline styles');
    const storage = await page.evaluate(() => ({ ls: localStorage.length, ss: sessionStorage.length, cookie: document.cookie }));
    assert.deepEqual(storage, { ls: 0, ss: 0, cookie: '' });
  });

  await step('built-in demo: inventory counts, files, excluded and rejected lists', async () => {
    await page.click('#demo-site');
    await until(async () => (await page.locator('#inv-file-count').count()) && (await text('#inv-file-count')) === String(invFull.totals.fileCount), 'demo inventory');
    assert.equal(await text('#inv-excluded-count'), String(invFull.totals.excludedCount));
    assert.equal(await text('#inv-rejected-count'), String(invFull.totals.rejectedCount));
    assert.ok(invFull.totals.excludedCount > 0 && invFull.totals.rejectedCount > 0, 'full demo has excluded and rejected entries');
    // Same numbers when the engine runs inside the page itself.
    const inPage = await page.evaluate(() => window.OMP.core.buildInventory(window.OMP.demo.entries()).then((i) => i.totals));
    assert.deepEqual(inPage, invFull.totals);
    assert.equal(await text('#inv-file-count'), String(inPage.fileCount));
    assert.equal(await text('#inv-manifest'), invFull.manifestSha256);
    assert.equal(await page.locator('#files-table tbody tr').count(), invFull.files.length);
    const filePaths = await page.locator('#files-table tbody td.path').allTextContents();
    assert.deepEqual(filePaths, invFull.files.map((f) => f.path));
    const shown = await page.locator('#files-table tbody td code.hash').allTextContents();
    assert.deepEqual(shown, invFull.files.map((f) => f.sha256));
    const excl = await page.locator('#excluded-table tbody td.path').allTextContents();
    assert.deepEqual(excl, invFull.excluded.map((x) => x.path));
    assert.ok(excl.includes('.env') && excl.includes('keys/hidden_service/hs_ed25519_secret_key'));
    const excludedText = await page.locator('#excluded-table').innerText();
    assert.ok(excludedText.includes('bytes were not read'));
    const rej = await page.locator('#rejected-table tbody td.path').allTextContents();
    assert.deepEqual(rej, invFull.rejected.map((x) => x.path));
    assert.ok((await page.locator('#rejected-table').innerText()).includes('traversal'));
    assert.ok((await page.locator('#site-label').inputValue()).includes('Lantern'), 'demo sets the site label');
  });

  await step('clean demo variant has no excluded or rejected entries', async () => {
    await page.click('#demo-site-clean');
    await until(async () => (await text('#inv-excluded-count')) === '0', 'clean demo inventory');
    assert.equal(await text('#inv-rejected-count'), '0');
    assert.equal(await text('#inv-file-count'), String(invClean.totals.fileCount));
    assert.equal(await text('#inv-manifest'), invClean.manifestSha256);
    assert.equal(await page.locator('#excluded-table tbody td.empty').count(), 1);
    await page.click('#demo-site');
    await until(async () => (await text('#inv-excluded-count')) === String(invFull.totals.excludedCount), 'full demo reloaded');
  });

  await step('generic static destination: add, validate, declare, block, duplicate, remove', async () => {
    await page.selectOption('#dest-type', 'generic-static');
    await page.click('#dest-add');
    const id = await lastCardId();
    const card = cardById(id);
    assert.equal(await card.getAttribute('data-type'), 'generic-static');
    assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-field')), 'label', 'focus moves to the new card');
    await fieldIn(card, 'basePath').fill('/-bad/');
    await until(async () => (await listText(card, 'error-list')).includes('Base path segment'), 'base path error');
    await fieldIn(card, 'basePath').fill('/');
    await waitState(card, 'needs-configuration');
    assert.ok((await listText(card, 'missing-list')).includes('Public base URL'));
    await fieldIn(card, 'address').fill('ftp://mirror.example.org/');
    await until(async () => (await listText(card, 'error-list')).includes('Only http:// and https://'), 'URL scheme error');
    assert.equal(await fieldIn(card, 'address').getAttribute('aria-invalid'), 'true');
    assert.ok((await card.locator('[data-field="address"] ~ .field-msg').innerText()).includes('Only http'));
    await fieldIn(card, 'address').fill('https://mirror.example.org/');
    await waitState(card, 'unverified');
    assert.equal(await card.locator('.missing-list').count(), 0);
    assert.equal(await fieldIn(card, 'address').getAttribute('aria-invalid'), null);
    await fieldIn(card, 'declaredMaxFileBytes').fill('1000000');
    await fieldIn(card, 'declaredMaxFiles').fill('100');
    for (const k of D.capabilityKeysFor('generic-static')) await card.locator('[data-field="cap:' + k + '"]').selectOption('yes');
    await waitState(card, 'ready-for-manual-review');
    await card.locator('[data-field="cap:byte-exact-delivery"]').selectOption('no');
    await waitState(card, 'blocked-by-declared-capability');
    assert.ok((await listText(card, 'blocking-list')).includes('byte-for-byte'));
    await fieldIn(card, 'declaredMaxFiles').fill('3');
    await until(async () => (await listText(card, 'blocking-list')).includes('site has ' + invFull.totals.fileCount), 'file-count limit blocks');
    await settle();
    assert.equal(await page.locator('#readiness-table tr[data-dest-id="' + id + '"] .badge').getAttribute('data-state'), 'blocked-by-declared-capability', 'compare table follows edits');

    const before = await cards().count();
    await card.locator('[data-action="duplicate"]').click();
    assert.equal(await cards().count(), before + 1);
    const copy = cards().nth(before); // inserted right after the original (last)
    assert.ok((await copy.locator('.dest-label').textContent()).endsWith('(copy)'));
    assert.equal(await badgeState(copy), 'blocked-by-declared-capability');

    confirmPolicy = 'dismiss';
    await copy.locator('[data-action="remove"]').click();
    assert.equal(await cards().count(), before + 1, 'dismissed confirmation keeps the destination');
    confirmPolicy = 'accept';
    await copy.locator('[data-action="remove"]').click();
    await card.locator('[data-action="remove"]').click();
    assert.equal(await cards().count(), before - 1 < 0 ? 0 : before - 1);
    assert.ok(confirms.some((m) => m.includes('Remove the destination')));
  });

  await step('local web server destination: add, validate, warn, remove', async () => {
    await page.selectOption('#dest-type', 'local-server');
    await page.click('#dest-add');
    const id = await lastCardId();
    const card = cardById(id);
    await waitState(card, 'needs-configuration');
    assert.ok((await listText(card, 'missing-list')).includes('Document root'));
    await fieldIn(card, 'documentRoot').fill('relative/path');
    await until(async () => (await listText(card, 'error-list')).includes('absolute path'), 'abspath error');
    await fieldIn(card, 'documentRoot').fill('/srv/mirror');
    await waitState(card, 'unverified');
    await fieldIn(card, 'listenAddress').fill('0.0.0.0:8080');
    await until(async () => (await listText(card, 'warning-list')).includes('all interfaces'), 'all-interfaces warning');
    await fieldIn(card, 'serverSoftware').selectOption('caddy');
    await fieldIn(card, 'listenAddress').fill('not a host');
    await waitState(card, 'needs-configuration');
    await fieldIn(card, 'listenAddress').fill('127.0.0.1:8081');
    await waitState(card, 'unverified');
    await settle();
    assert.ok((await page.locator('#export-dest-files').innerText()).includes('Caddyfile.template'), 'export lists the Caddy template');
    // Invalid values are shown as errors and left out of exports (the engine omits them).
    const planState = () => page.locator('#plan-state-value').getAttribute('data-state');
    const destFiles = () => page.locator('#export-dest-files .dest-files[data-dest-id="' + id + '"]');
    await fieldIn(card, 'publicUrl').fill('not a url');
    await until(async () => (await listText(card, 'error-list')).includes('Not a valid URL'), 'invalid public URL error');
    await settle();
    assert.equal(await planState(), 'draft', 'export stays available');
    assert.ok((await destFiles().innerText()).includes('Not exported because the value is invalid: Public URL'));
    assert.equal(await page.locator('#dl-plan').isDisabled(), false);
    await fieldIn(card, 'publicUrl').fill('https://operator:s3cret@mirror.example.org/');
    await until(async () => (await listText(card, 'error-list')).includes('username or password'), 'credentials-in-URL error');
    await settle();
    await page.selectOption('#preview-select', 'offline-mirror-plan/plan.json');
    assert.ok(!(await page.locator('#preview').textContent()).includes('s3cret'), 'credential never reaches the plan');
    const zip = await downloadVia('#dl-zip');
    assert.ok(!zip.bytes.toString('latin1').includes('s3cret'), 'credential never reaches any exported file');
    await fieldIn(card, 'publicUrl').fill('');
    await settle();
    assert.equal(await destFiles().locator('.omitted-fields').count(), 0);
    const n = await cards().count();
    await card.locator('[data-action="remove"]').click();
    assert.equal(await cards().count(), n - 1);
  });

  await step('Tor onion destination: add, validate HiddenServiceDir and v3 address, remove', async () => {
    await page.selectOption('#dest-type', 'tor-onion');
    await page.click('#dest-add');
    const card = cardById(await lastCardId());
    await waitState(card, 'needs-configuration');
    assert.ok((await listText(card, 'missing-list')).includes('HiddenServiceDir'));
    assert.ok((await listText(card, 'pending-list')).includes("operator's own Tor"));
    await fieldIn(card, 'hiddenServiceDir').fill('/var/www/html/hs');
    await until(async () => (await listText(card, 'error-list')).includes('web-served folder'), 'HiddenServiceDir error');
    await fieldIn(card, 'hiddenServiceDir').fill('/var/lib/tor/mirror/');
    await waitState(card, 'unverified');
    await fieldIn(card, 'addressMode').selectOption('entered');
    await waitState(card, 'needs-configuration');
    assert.ok((await listText(card, 'missing-list')).includes('marked as entered but empty'));
    await fieldIn(card, 'address').fill('abcdefghijklmnop.onion');
    await until(async () => (await listText(card, 'error-list')).includes('retired v2'), 'v2 onion error');
    await fieldIn(card, 'address').fill('a'.repeat(55) + 'd.onion');
    await waitState(card, 'unverified');
    assert.equal(await card.locator('.pending-list').count(), 0, 'no pending action once an address is entered');
    await fieldIn(card, 'virtualPort').fill('70000');
    await until(async () => (await listText(card, 'error-list')).includes('port number'), 'port error');
    await fieldIn(card, 'virtualPort').fill('80');
    await waitState(card, 'unverified');
    const n = await cards().count();
    await card.locator('[data-action="remove"]').click();
    assert.equal(await cards().count(), n - 1);
  });

  await step('I2P destination: add, missing tunnel name, router switch, remove', async () => {
    await page.selectOption('#dest-type', 'i2p');
    await page.click('#dest-add');
    const card = cardById(await lastCardId());
    await waitState(card, 'unverified'); // defaults fill every required field
    await fieldIn(card, 'tunnelName').fill('');
    await waitState(card, 'needs-configuration');
    assert.ok((await listText(card, 'missing-list')).includes('Tunnel name'));
    await fieldIn(card, 'tunnelName').fill('bad name!');
    await until(async () => (await listText(card, 'error-list')).includes('only letters, digits'), 'token error');
    await fieldIn(card, 'tunnelName').fill('my-tunnel');
    await fieldIn(card, 'keysFile').fill('');
    await waitState(card, 'needs-configuration');
    await fieldIn(card, 'router').selectOption('java-i2p');
    await waitState(card, 'unverified'); // keys file only required for i2pd
    await fieldIn(card, 'localTarget').fill('192.168.1.5:8080');
    await until(async () => (await listText(card, 'error-list')).includes('loopback'), 'loopback error');
    await fieldIn(card, 'localTarget').fill('127.0.0.1:8080');
    await waitState(card, 'unverified');
    await settle();
    assert.ok((await page.locator('#export-dest-files').innerText()).includes('java-i2p-tunnel-values.txt'));
    const n = await cards().count();
    await card.locator('[data-action="remove"]').click();
    assert.equal(await cards().count(), n - 1);
    assert.equal(await cards().count(), 0);
  });

  await step('destination limit is enforced (' + core.LIMITS.maxDestinations + ')', async () => {
    await page.selectOption('#dest-type', 'generic-static');
    for (let i = 0; i < core.LIMITS.maxDestinations; i++) await page.click('#dest-add');
    assert.equal(await cards().count(), core.LIMITS.maxDestinations);
    assert.equal(await page.locator('#dest-add').isDisabled(), true);
    assert.ok((await text('#dest-count')).includes('maximum'));
    await cards().first().locator('[data-action="duplicate"]').click();
    assert.equal(await cards().count(), core.LIMITS.maxDestinations, 'duplicate refused at the limit');
    assert.ok((await text('#dest-message')).includes('At most'));
  });

  await step('demo destinations + compare matrix states match the engine', async () => {
    await page.click('#dest-demo'); // replaces the 50 (confirm accepted)
    assert.equal(await cards().count(), 4);
    await settle();
    const ctx = { inventory: invFull, headers: P.defaultSettings().headers };
    const expected = demo.destinations().map((d) => ({ id: d.id, state: D.assessDestination(d, ctx).state }));
    assert.deepEqual(expected.map((e) => e.state), ['ready-for-manual-review', 'unverified', 'ready-for-manual-review', 'needs-configuration']);
    for (const e of expected) {
      assert.equal(await badgeState(cardById(e.id)), e.state, 'card state for ' + e.id);
      assert.equal(await page.locator('#readiness-table tr[data-dest-id="' + e.id + '"] .badge').getAttribute('data-state'), e.state, 'readiness state for ' + e.id);
      assert.equal(await page.locator('#matrix-table thead th[data-dest-id="' + e.id + '"] .badge').getAttribute('data-state'), e.state);
    }
    assert.equal(await page.locator('#matrix-table tbody tr').count(), D.CAPABILITIES.length);
    assert.equal(await page.locator('#matrix-table thead th').count(), 1 + 4);
    assert.equal(await page.locator('#matrix-table tbody td.cap').count(), D.CAPABILITIES.length * 4);
    const statuses = await page.locator('#matrix-table tbody td.cap').evaluateAll((tds) => tds.map((t) => t.getAttribute('data-status')));
    const allowed = ['declared-supported', 'declared-unsupported-blocking', 'declared-unsupported', 'unknown-blocking', 'unknown', 'n/a'];
    assert.ok(statuses.every((s) => allowed.includes(s)), 'every matrix cell has a known status');
    // Expected cells straight from the engine, row by row.
    const flat = [];
    D.CAPABILITIES.forEach((c, ci) => demo.destinations().forEach((d) => flat.push(D.assessDestination(d, ctx).capabilities[ci].status)));
    assert.deepEqual(statuses, flat);
    const i2pRow = await page.locator('#readiness-table tr[data-dest-id="demo-i2p"]').innerText();
    assert.ok(i2pRow.includes('Tunnel name') && i2pRow.includes('I2P router'), 'missing config and pending actions listed');
    const badges = await page.locator('.badge[data-state]').evaluateAll((b) => b.map((x) => [x.getAttribute('data-state'), x.textContent]));
    for (const [st, label] of badges) {
      assert.ok(ALL_STATES.includes(st) || st === 'draft' || st === 'ready-for-manual-review', 'badge state ' + st);
      assert.ok(!/^\s*(verified|live)\b/i.test(label), 'no badge claims verified/live: ' + label);
    }
  });

  await step('hostile destination label and notes render as text, never HTML', async () => {
    const card = cardById('demo-static');
    const evil = '<img src=x onerror="window.__xss=1">';
    await fieldIn(card, 'label').fill(evil);
    await fieldIn(card, 'notes').fill('<script>window.__xss=2</script><b>bold?</b>');
    await settle();
    assert.equal(await card.locator('.dest-label').textContent(), evil);
    assert.equal(await page.locator('#readiness-table tr[data-dest-id="demo-static"] th').textContent(), evil);
    assert.ok((await page.locator('#export-dest-files [data-dest-id="demo-static"]').innerText()).includes(evil));
    const dom = await page.evaluate(() => ({ imgs: document.querySelectorAll('img').length, bold: document.querySelectorAll('main b').length, xss: window.__xss, scripts: Array.from(document.scripts).filter((s) => !s.src).length }));
    assert.deepEqual(dom, { imgs: 0, bold: 0, xss: undefined, scripts: 0 });
    await page.selectOption('#preview-select', 'offline-mirror-plan/destinations.json');
    assert.ok((await page.locator('#preview').textContent()).includes(JSON.stringify(evil).slice(1, -1)));
    await page.selectOption('#preview-select', 'offline-mirror-plan/plan.json');
    assert.equal(alerts.length, 0, 'no alert dialogs');
    // restore for later comparisons
    await fieldIn(card, 'label').fill(demo.destinations()[1].label);
    await fieldIn(card, 'notes').fill(demo.destinations()[1].notes);
  });

  await step('headers & settings: add/validate/remove headers, site label, Onion-Location warning', async () => {
    const rows = () => page.locator('#headers-table tr[data-header-row]');
    const n0 = await rows().count();
    assert.equal(n0, P.defaultHeaders().length);
    await page.click('#header-add');
    assert.equal(await rows().count(), n0 + 1);
    const nameIn = page.locator('[data-header-name="' + n0 + '"]');
    const valIn = page.locator('[data-header-value="' + n0 + '"]');
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute('data-header-name')), String(n0), 'focus moves to the new header');
    await nameIn.fill('Bad Header');
    await valIn.fill('x');
    await until(async () => (await rows().nth(n0).innerText()).includes('must start with a letter'), 'header name error');
    assert.equal(await page.locator('#settings-errors').isVisible(), true);
    await settle();
    assert.ok((await page.locator('#plan-state').innerText()).includes('plan setting error'));
    assert.ok((await text('#omitted-headers')).includes('1 invalid header is left out'));
    await page.selectOption('#preview-select', 'offline-mirror-plan/plan.json');
    assert.ok(!(await page.locator('#preview').textContent()).includes('Bad Header'), 'invalid header not exported');
    await nameIn.fill('Set-Cookie');
    await until(async () => (await rows().nth(n0).innerText()).includes('credential-bearing'), 'forbidden header error');
    await nameIn.fill('X-Frame-Options');
    await valIn.fill('DENY');
    await until(async () => page.locator('#settings-errors').isHidden(), 'settings errors cleared');
    await settle();
    assert.ok((await page.locator('#preview').textContent()).includes('X-Frame-Options'), 'plan preview has the new header');
    await page.locator('[data-remove-header="' + n0 + '"]').click();
    assert.equal(await rows().count(), n0);

    await page.fill('#site-label', '');
    await until(async () => (await text('#site-label-msg')).includes('required'), 'site label error');
    await page.fill('#site-label', demo.settings().siteLabel);
    await until(async () => (await text('#site-label-msg')) === '', 'site label ok');

    assert.ok((await text('#onion-location-warning')).includes('publicly'), 'Onion-Location warning shown');
    await page.check('#onion-location');
    await settle();
    assert.ok((await text('#onion-location-status')).includes('no onion destination has an entered address'));
    const onion = cardById('demo-onion');
    await fieldIn(onion, 'addressMode').selectOption('entered');
    await fieldIn(onion, 'address').fill('b'.repeat(55) + 'd.onion');
    await settle();
    assert.ok((await text('#onion-location-status')).includes('1 HTTPS destination'));
    assert.ok((await page.locator('#preview').textContent()).includes('"Onion-Location"'));
    await page.uncheck('#onion-location');
    await fieldIn(onion, 'address').fill('');
    await fieldIn(onion, 'addressMode').selectOption('pending-operator');
    await settle();
    assert.ok(!(await page.locator('#preview').textContent()).includes('"Onion-Location"'));
  });

  let destJsonBytes = null, planJsonBytes = null;

  await step('downloads: plan.json, SHA256SUMS, destinations.json, README, per-destination files, plan ZIP', async () => {
    const plan = await downloadVia('#dl-plan');
    assert.equal(plan.name, 'plan.json');
    assert.ok(plan.url.startsWith('blob:'), 'download comes from a blob: URL');
    planJsonBytes = plan.bytes;
    const pj = JSON.parse(plan.bytes.toString('utf8'));
    assert.equal(pj.schema, 'replikrazy.offline-mirror-plan');
    assert.equal(pj.verification.performed, false);
    assert.equal(pj.verification.networkRequests, 0);
    assert.equal(pj.planState, 'draft');
    assert.equal(pj.site.totals.fileCount, invFull.totals.fileCount);
    assert.equal(pj.site.manifestSha256, invFull.manifestSha256);
    assert.equal(pj.destinations.length, 4);
    assert.ok(pj.destinations.every((d) => d.verified === false && ALL_STATES.includes(d.state)));
    assert.deepEqual(pj.destinations.map((d) => d.label), demo.destinations().map((d) => d.label));
    assert.ok(!JSON.stringify(pj).includes('do-not-read-me'));

    const sums = await downloadVia('#dl-sums');
    assert.equal(sums.name, 'SHA256SUMS');
    assert.equal(sums.bytes.toString('utf8'), core.buildSha256Sums(invFull.files));
    assert.equal(sha256(sums.bytes), pj.site.manifestSha256);

    const dj = await downloadVia('#dl-dests');
    assert.equal(dj.name, 'destinations.json');
    destJsonBytes = dj.bytes;
    const djo = JSON.parse(dj.bytes.toString('utf8'));
    assert.equal(djo.schema, P.DEST_SCHEMA);
    assert.equal(djo.destinations.length, 4);

    const readme = await downloadVia('#dl-readme');
    assert.ok(readme.bytes.toString('utf8').startsWith(P.NOTICE));

    const buttons = page.locator('#export-dest-files button[data-artifact]');
    const expectedArtifacts = [].concat(...pj.destinations.map((d) => [d.instructionsFile].concat(d.templates)));
    assert.equal(await buttons.count(), expectedArtifacts.length);
    for (let i = 0; i < expectedArtifacts.length; i++) {
      const b = buttons.nth(i);
      const art = await b.getAttribute('data-artifact');
      assert.equal(art, expectedArtifacts[i]);
      const got = await downloadVia(b).catch((e) => { throw new Error("download " + i + " " + art + ": " + e.message); });
      const dir = art.split('/')[1];
      assert.equal(got.name, dir + '-' + art.split('/').pop());
      assert.ok(got.bytes.length > 0);
      if (art.endsWith('INSTRUCTIONS.md')) assert.ok(got.bytes.toString('utf8').startsWith('# Operator instructions'));
      if (art.endsWith('.template') || art.endsWith('.txt')) assert.ok(got.bytes.toString('utf8').startsWith('# TEMPLATE'));
    }

    const zip = await downloadVia('#dl-zip');
    assert.equal(zip.name, 'offline-mirror-plan.zip');
    const entries = Z.readStoredZip(new Uint8Array(zip.bytes));
    const names = entries.map((e) => e.path).sort();
    const expectedNames = ['offline-mirror-plan/README-FIRST.txt', 'offline-mirror-plan/plan.json', 'offline-mirror-plan/SHA256SUMS', 'offline-mirror-plan/destinations.json']
      .concat(expectedArtifacts.map((a) => 'offline-mirror-plan/' + a)).sort();
    assert.deepEqual(names, expectedNames);
    const zPlan = entries.find((e) => e.path === 'offline-mirror-plan/plan.json');
    assert.ok(Buffer.from(zPlan.bytes).equals(plan.bytes), 'plan.json in ZIP equals the separately downloaded plan.json');
    assert.ok(!names.some((n) => n.includes('/site/')), 'plan ZIP holds no site files');
  });

  await step('demo site bundle: site bytes equal the demo bytes; excluded/rejected never included', async () => {
    const b = await downloadVia('#dl-bundle');
    assert.equal(b.name, 'offline-mirror-plan-with-site.zip');
    const entries = Z.readStoredZip(new Uint8Array(b.bytes));
    const site = entries.filter((e) => e.path.startsWith('offline-mirror-plan/site/'));
    assert.deepEqual(site.map((e) => e.path.slice('offline-mirror-plan/site/'.length)).sort(), Array.from(demoFiles.keys()).sort());
    for (const e of site) {
      const rel = e.path.slice('offline-mirror-plan/site/'.length);
      assert.ok(Buffer.from(e.bytes).equals(demoFiles.get(rel)), 'bytes preserved for ' + rel);
    }
    for (const u of unwanted) {
      assert.ok(!entries.some((e) => e.path.endsWith('/' + u) || e.path.includes(u.replace(/^\.\.\//, ''))), 'bundle must not contain ' + u);
    }
    assert.ok(entries.some((e) => e.path === 'offline-mirror-plan/plan.json'));
    assert.ok(entries.some((e) => e.path === 'offline-mirror-plan/SHA256SUMS'));
    assert.ok((await text('#export-progress')).includes('verified against the inventory'));
  });

  await step('import round-trip of destinations.json (and plan.json, bad JSON, oversize, unknown fields)', async () => {
    await openPage(); // fresh tab: memory-only state is gone
    assert.equal(await cards().count(), 0, 'reload discards all state');
    assert.equal(await page.locator('#inv-summary').count(), 0);
    const djPath = path.join(TMP, 'destinations.json');
    fs.writeFileSync(djPath, destJsonBytes);
    await page.setInputFiles('#import-input', djPath);
    await until(async () => (await cards().count()) === 4, 'imported cards');
    assert.ok((await text('#import-message')).includes('Imported 4 destinations and settings'));
    assert.equal(await page.locator('#site-label').inputValue(), demo.settings().siteLabel);
    const again = await downloadVia('#dl-dests');
    const a = JSON.parse(destJsonBytes.toString('utf8')), b = JSON.parse(again.bytes.toString('utf8'));
    assert.deepEqual(b.destinations, a.destinations, 'destinations survive the round-trip exactly');
    assert.deepEqual(b.settings, a.settings, 'settings survive the round-trip exactly');

    const pjPath = path.join(TMP, 'plan.json');
    fs.writeFileSync(pjPath, planJsonBytes);
    const confirmsBefore = confirms.length;
    await page.setInputFiles('#import-input', pjPath);
    await until(async () => confirms.length === confirmsBefore + 1, 'replace confirmation');
    await until(async () => (await text('#import-message')).includes('Imported 4 destinations'), 'plan.json import');
    assert.equal(await cards().count(), 4);

    const badPath = path.join(TMP, 'bad.json');
    fs.writeFileSync(badPath, '{ not json');
    await page.setInputFiles('#import-input', badPath);
    await until(async () => (await text('#import-message')).includes('not valid JSON'), 'bad JSON error');
    assert.equal(await cards().count(), 4, 'failed import changes nothing');

    const bigPath = path.join(TMP, 'big.json');
    fs.writeFileSync(bigPath, Buffer.alloc(core.LIMITS.maxImportBytes + 1, 0x20));
    await page.setInputFiles('#import-input', bigPath);
    await until(async () => (await text('#import-message')).includes('the limit is'), 'oversize error');

    const oddPath = path.join(TMP, 'odd.json');
    fs.writeFileSync(oddPath, JSON.stringify([{ type: 'generic-static', label: 'Imported <b>odd</b>', config: { address: 'https://x.example/', password: 'hunter2hunter2' } }, { type: 'nope' }]));
    await page.setInputFiles('#import-input', oddPath);
    await until(async () => (await text('#import-message')).includes('ignored unknown field'), 'import warnings');
    assert.ok((await text('#import-message')).includes('was skipped'));
    assert.equal(await cards().count(), 1);
    assert.equal(await cards().first().locator('.dest-label').textContent(), 'Imported <b>odd</b>');
    const exp = await downloadVia('#dl-dests');
    assert.ok(!exp.bytes.toString('utf8').includes('hunter2'), 'unknown credential-like field dropped');
  });

  await step('real folder via setInputFiles: .env excluded, hostile file name shown as text, bundle bytes exact', async () => {
    await openPage();
    const { root, files } = writeFolder();
    await page.setInputFiles('#folder-input', root);
    await until(async () => (await page.locator('#inv-file-count').count()) > 0, 'folder inventory', 10000);
    assert.ok((await text('#inv-source')).includes('my-site'));
    assert.equal(await page.locator('#site-label').inputValue(), 'my-site');
    const included = await page.locator('#files-table tbody td.path').allTextContents();
    const readmes = included.filter((p) => /^readme\.txt$/i.test(p));
    assert.equal(readmes.length, 1, 'exactly one of the case-colliding files is included');
    assert.deepEqual(included.filter((p) => p !== readmes[0]), ['.well-known/security.txt', '404.html', 'img/bin.png', 'index.html', 'notes.txt', 'sub/page.html']);
    const excl = await page.locator('#excluded-table tbody td.path').allTextContents();
    for (const p of ['.env', '.git/HEAD', 'cgi-bin/form.php']) assert.ok(excl.includes(p), p + ' excluded (got ' + excl.join(', ') + ')');
    const rejRows = await page.locator('#rejected-table tbody tr').allInnerTexts();
    assert.ok(rejRows.some((r) => /readme\.txt/i.test(r) && r.includes('case-collision')), 'case collision rejected');
    const rejCodes = await page.locator('#rejected-table tbody td.path code').allTextContents();
    assert.ok(rejCodes.includes(hostileName()), 'hostile file name listed verbatim as text (got ' + rejCodes.join(', ') + ')');
    const dom = await page.evaluate(() => ({ imgs: document.querySelectorAll('img').length }));
    assert.equal(dom.imgs, 0, 'hostile name did not become an <img>');
    assert.equal(alerts.length, 0, 'no alert dialogs');
    const shownHash = await page.locator('#files-table tbody tr', { hasText: 'img/bin.png' }).locator('code.hash').textContent();
    assert.equal(shownHash, sha256(files['img/bin.png']));

    const b = await downloadVia('#dl-bundle');
    const entries = Z.readStoredZip(new Uint8Array(b.bytes));
    const site = entries.filter((e) => e.path.startsWith('offline-mirror-plan/site/'));
    assert.deepEqual(site.map((e) => e.path.slice(25)).sort(), included.slice().sort());
    for (const e of site) assert.ok(Buffer.from(e.bytes).equals(files[e.path.slice(25)]), 'bytes preserved for ' + e.path);
    assert.ok(!entries.some((e) => /\.env$|\.git\/|onerror|\.php$/.test(e.path)), 'no excluded/rejected entries in bundle');
    assert.equal(entries.filter((e) => /readme\.txt$/i.test(e.path)).length, 1, 'only one of the case-colliding files is bundled');
    const sums = entries.find((e) => e.path === 'offline-mirror-plan/SHA256SUMS');
    for (const rel of included) assert.ok(Buffer.from(sums.bytes).toString().includes(sha256(files[rel]) + '  ' + rel));
  });

  await step('bundle is refused, naming the file, when a source file changed after inventory', async () => {
    const target = path.join(TMP, 'my-site', 'notes.txt');
    const orig = fs.readFileSync(target);
    const changedBytes = Buffer.from(orig.toString('utf8').replace('one', 'ONE')); // same size, different bytes
    async function expectRefusal(pattern) {
      await page.click('#dl-bundle');
      await until(async () => page.locator('#export-error').isVisible(), 'bundle refusal', 8000);
      const msg = await text('#export-error');
      assert.ok(msg.includes('Bundle refused') && msg.includes('"notes.txt"'), 'error names the file: ' + msg);
      assert.ok(pattern.test(msg), 'expected ' + pattern + ' in: ' + msg);
      assert.ok(await noDownloadWithin(800), 'no bundle was downloaded');
    }
    // (a) Content changed with the timestamp preserved: the browser reads the new
    // bytes without complaint, so only the re-hash can catch it.
    fs.writeFileSync(target, changedBytes);
    fs.utimesSync(target, FIXED_TIME, FIXED_TIME);
    await expectRefusal(/no longer matches its inventoried SHA-256/);
    // (b) Content and timestamp changed: Chromium refuses to re-read the File.
    fs.utimesSync(target, new Date(Date.now() + 5000), new Date(Date.now() + 5000));
    await expectRefusal(/could not be read again|no longer matches/);
    fs.writeFileSync(target, orig);
  });

  await step('too many files: whole-input error is shown and previous site kept', async () => {
    const big = path.join(TMP, 'too-many');
    fs.mkdirSync(big);
    for (let i = 0; i <= core.LIMITS.maxFiles; i++) fs.writeFileSync(path.join(big, 'f' + i + '.txt'), 'x');
    await page.setInputFiles('#folder-input', big);
    await until(async () => page.locator('#site-error').isVisible(), 'too-many-files error', 30000);
    const msg = await text('#site-error');
    assert.ok(msg.includes('the limit is ' + core.LIMITS.maxFiles), msg);
    assert.ok(msg.includes('previously loaded site is still in use'));
    assert.ok((await text('#inv-source')).includes('my-site'));
  });

  await step('accessibility basics: labelled controls, named buttons, keyboard operation', async () => {
    await openPage();
    await page.click('#demo-site-clean');
    await until(async () => (await page.locator('#inv-file-count').count()) > 0, 'demo');
    await page.click('#dest-demo');
    await settle();
    const unlabeled = await page.evaluate(() => Array.from(document.querySelectorAll('input, select, textarea')).filter((e) => !(e.labels && e.labels.length) && !e.getAttribute('aria-label') && !e.getAttribute('aria-labelledby')).map((e) => e.id || e.outerHTML.slice(0, 80)));
    assert.deepEqual(unlabeled, [], 'every form control has a label');
    const unnamed = await page.evaluate(() => Array.from(document.querySelectorAll('button')).filter((b) => !b.textContent.trim()).length);
    assert.equal(unnamed, 0, 'every button has text');
    await openPage();
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.className), 'skip-link');
    await page.focus('#demo-site');
    await page.keyboard.press('Enter');
    await until(async () => (await page.locator('#inv-file-count').count()) > 0, 'keyboard-triggered demo load');
    await page.focus('#dest-type');
    await page.keyboard.press('ArrowDown'); // -> local-server
    await page.focus('#dest-add');
    await page.keyboard.press('Space');
    assert.equal(await cards().first().getAttribute('data-type'), 'local-server');
  });

  await step('no page errors, console errors or CSP violations', async () => {
    assert.deepEqual(await cspViolations(), []);
    assert.deepEqual(pageErrors, []);
    assert.deepEqual(consoleErrors, []);
    assert.deepEqual(alerts, []);
  });

  await step('zero network requests: every request was file:, data: or blob:', async () => {
    const bad = allRequests.filter((u) => !/^(file|data|blob):/i.test(u));
    assert.deepEqual(bad, [], 'non-local requests');
    assert.deepEqual(blocked, [], 'aborted non-local requests');
    assert.ok(allRequests.filter((u) => u.startsWith('file:')).length >= 8, 'request recording works (saw the page and its scripts)');
  });

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log('\n' + (results.length - failed.length) + '/' + results.length + ' e2e checks passed; ' + allRequests.length + ' requests recorded, ' +
    allRequests.filter((u) => !/^(file|data|blob):/i.test(u)).length + ' non-local.');
  if (failed.length) {
    console.log('Failed: ' + failed.map((f) => f.name).join('; '));
    process.exitCode = 1;
  }
}

main().catch(async (e) => {
  console.error('e2e run aborted: ' + (e && e.stack || e));
  try { if (browser) await browser.close(); } catch (_) { /* ignore */ }
  process.exitCode = 1;
}).finally(() => {
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) { /* ignore */ }
});

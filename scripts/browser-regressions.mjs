// Optional local Chromium checks. Install playwright-core and axe-core@4.10.2
// outside this repo, set BROWSER_TEST_TOOLS to that directory, build, then run
// against `vite preview`. No provider access or imported content execution.
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { zipSync, unzipSync } from 'fflate';
import { browserEngine, launchBrowser } from './browser-tools.mjs';
const browser = await launchBrowser();
const origin = 'http://127.0.0.1:4173';
const errors = [], external = [];
let checks = 0;
const check = (value, expected) => { assert.deepEqual(value, expected); checks++; };
const zip = files => ({ name: 'site.zip', mimeType: 'application/zip', buffer: Buffer.from(zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, new TextEncoder().encode(v)])))) });
const site = zip({ 'index.html': '<script>globalThis.pwned=true</script><h1>Hello</h1>' });
const fixtureDir = await mkdtemp(join(tmpdir(), 'replikrazy-picker-'));
const page = await browser.newPage();
page.on('pageerror', e => errors.push(e.message));
page.on('request', r => { if (!r.url().startsWith(origin + '/')) external.push(r.url()); });
async function load(input = site) {
  await page.locator('#zip-input').setInputFiles(input);
  await page.waitForFunction(() => document.querySelector('#artifact-id').textContent.includes('sha256:'));
}
async function selectNetlify() {
  await page.locator('#provider-list .card').filter({ has: page.getByRole('heading', { name: /Netlify/ }) }).locator('input').check();
}
try {
  await page.goto(origin);
  // A safe explicit wrapper can bring payload paths within the path cap.
  // The chooser must remain reachable even when no unrooted file was valid.
  const wrapper = 'w'.repeat(100);
  const payloadPath = `${'a'.repeat(100)}/${'b'.repeat(100)}/index.html`;
  await page.locator('#zip-input').setInputFiles(zip({ [`${wrapper}/${payloadPath}`]: 'public' }));
  await page.waitForFunction(() => document.querySelector('#root-choice input'));
  check(await page.locator('#payload-btn').isEnabled(), false);
  await page.locator('#root-choice input').check();
  await page.waitForFunction(() => document.querySelector('#intake-status').textContent.includes('site root'));
  await page.locator('#entrypoint').selectOption(payloadPath);
  await page.waitForFunction(() => document.querySelector('#artifact-id').textContent.includes('sha256:'));
  check(await page.locator('#inv-rows tr td').first().textContent(), payloadPath);
  check(await page.locator('#root-choice input').isChecked(), true);
  await load();
  // Exercise the real folder picker, explicit root choice, and ZIP identity parity.
  const zipArtifact = await page.locator('#artifact-id').textContent();
  await writeFile(join(fixtureDir, 'index.html'), '<script>globalThis.pwned=true</script><h1>Hello</h1>');
  await page.locator('#dir-input').setInputFiles(fixtureDir);
  await page.waitForFunction(() => document.querySelector('#root-choice input'));
  await page.locator('#root-choice input').check();
  await page.waitForFunction(() => document.querySelector('#intake-status').textContent.includes('site root') && document.querySelector('#artifact-id').textContent.includes('sha256:'));
  check(await page.locator('#artifact-id').textContent(), zipArtifact);
  // Hold main-thread identity hashes and release them newest-first. Worker
  // hashing is untouched; only the UI identity race is under test.
  await page.evaluate(() => {
    window.realDigest = crypto.subtle.digest.bind(crypto.subtle);
    window.pendingIdentity = [];
    crypto.subtle.digest = (...args) => window.realDigest(...args).then(bytes => new Promise(resolve => window.pendingIdentity.push(() => resolve(bytes))));
  });
  await page.locator('#app-id').fill('older');
  await page.locator('#app-id').dispatchEvent('change');
  await page.waitForFunction(() => window.pendingIdentity.length === 1);
  await page.locator('#app-id').fill('newer');
  await page.locator('#app-id').dispatchEvent('change');
  await page.waitForFunction(() => window.pendingIdentity.length === 2);
  await page.evaluate(() => window.pendingIdentity[1]());
  await page.waitForFunction(() => document.querySelector('#app-id').value === 'newer' && document.querySelector('#artifact-id').textContent.includes('sha256:'));
  const latestArtifact = await page.locator('#artifact-id').textContent();
  await page.evaluate(async () => { window.pendingIdentity[0](); await new Promise(resolve => setTimeout(resolve, 0)); crypto.subtle.digest = window.realDigest; });
  check(await page.locator('#artifact-id').textContent(), latestArtifact);
  check(await page.locator('#app-id').inputValue(), 'newer');
  check(latestArtifact !== zipArtifact, true);
  await selectNetlify();
  await page.locator('#use-public').check();
  check(await page.locator('#payload-btn').isEnabled(), false);
  check(await page.locator('#export-btn').isEnabled(), false);
  await page.locator('#use-rights').check();
  check(await page.locator('#export-btn').isEnabled(), true);
  check(await page.locator('#payload-btn').isEnabled(), true);
  const [handoff] = await Promise.all([page.waitForEvent('download'), page.locator('#export-btn').click()]);
  const exportedPath = join(fixtureDir, 'handoff.zip');
  await handoff.saveAs(exportedPath);
  const archive = unzipSync(await readFile(exportedPath));
  const report = JSON.parse(new TextDecoder().decode(archive['mirrorkit-control/scan.json']));
  check(report.artifactId, latestArtifact.replace('Artifact id: ', ''));
  check(Object.keys(report).sort(), ['artifactId', 'diagnostics', 'diagnosticCounts', 'diagnosticsTruncated', 'dependencies', 'fileMetadata', 'hints', 'scannerVersion'].sort());
  check(report.diagnostics.every(d => typeof d.messageKey === 'string' && typeof d.remediationKey === 'string'), true);
  check(report.hints.externalDependenciesComplete, false);
  check(new TextDecoder().decode(archive['app/index.html']), '<script>globalThis.pwned=true</script><h1>Hello</h1>');

  for (const use of ['payment', 'token']) {
    await page.locator('#use-category').selectOption(use);
    check(await page.locator('#payload-btn').isEnabled(), false);
    check(await page.locator('#export-btn').isEnabled(), false);
  }
  await page.locator('#use-category').selectOption('personal');
  await page.evaluate(() => {
    const id = document.querySelector('#artifact-id').textContent.replace('Artifact id: ', '');
    localStorage.setItem(`replikrazy.plan.${id}`, 'null');
  });
  await page.locator('#use-rights').uncheck();
  check(await page.locator('#payload-btn').isEnabled(), false);
  check(await page.locator('#export-btn').isEnabled(), false);
  await page.locator('#use-rights').check();
  const retainedSource = '{"schemaVersion":"2.0","future":"retain exactly"}';
  const retainedKey = await page.evaluate(raw => {
    const id = document.querySelector('#artifact-id').textContent.replace('Artifact id: ', '');
    const key = `replikrazy.status.v1.${id}`;
    localStorage.setItem(key, raw);
    return key;
  }, retainedSource);
  await page.locator('#use-rights').uncheck();
  await page.locator('#use-rights').check();
  check(await page.locator('#stored-status-export').isVisible(), true);
  check((await page.locator('#stored-status-notice').textContent()).includes('remains unchanged'), true);
  const [retainedDownload] = await Promise.all([page.waitForEvent('download'), page.locator('#stored-status-export').click()]);
  const retainedPath = join(fixtureDir, 'retained-status.json');
  await retainedDownload.saveAs(retainedPath);
  const sourceCopy = JSON.parse(await readFile(retainedPath, 'utf8'));
  check(sourceCopy.source, retainedSource);
  check(await page.evaluate(key => localStorage.getItem(key), retainedKey), retainedSource);
  await page.locator('#cmp-zip').setInputFiles(site);
  await page.waitForFunction(() => document.querySelector('#compare-result').textContent.includes('Every file matches'));
  checks++;
  await page.locator('#cmp-zip').setInputFiles(zip({ 'index.html': '<script>globalThis.pwned=true</script><h1>Hello</h1>', '../bad.txt': 'bad' }));
  await page.waitForFunction(() => document.querySelector('#compare-result').textContent.includes('Could not read'));
  checks++;
  await load(zip({ 'index.html': 'hello', '../bad.txt': 'bad' }));
  await page.locator('#cmp-zip').setInputFiles(zip({ 'index.html': 'hello' }));
  await page.waitForFunction(() => document.querySelector('#compare-result').textContent.includes('original input has errors'));
  checks++;
  check(await page.locator('#export-btn').isEnabled(), false);
  check(await page.locator('#use-public').isChecked(), false);
  check(await page.evaluate(() => globalThis.pwned), undefined);
  await load(zip({ 'index.html': 'hello', '../bad/': '' }));
  await page.locator('#cmp-zip').setInputFiles(zip({ 'index.html': 'hello' }));
  await page.waitForFunction(() => document.querySelector('#compare-result').textContent.includes('original input has errors'));
  checks++;
  const conflicting = zip({ 'index.html': 'hello' });
  conflicting.buffer[6] ^= 1; // only local flags differ from the central record
  await page.locator('#zip-input').setInputFiles(conflicting);
  await page.waitForFunction(() => document.querySelector('#intake-status').textContent.includes('Could not read this ZIP'));
  check(await page.locator('#inventory').isVisible(), false);

  // Full pinned Unicode folding must catch capital sharp-S against ss.
  await page.locator('#zip-input').setInputFiles(zip({ 'index.html': 'ok', 'ẞ.txt': 'a', 'ss.txt': 'b' }));
  await page.waitForFunction(() => document.querySelector('#intake-status').textContent.includes('Input has errors'));
  check((await page.locator('#issues').textContent()).includes('case folding'), true);
  check(await page.locator('#export-btn').isEnabled(), false);
  check(await page.locator('#payload-btn').isEnabled(), false);

  // Storage denial is nonfatal and cannot override fresh policy checks.
  await page.evaluate(() => { Storage.prototype.getItem = () => { throw Error('denied'); }; Storage.prototype.setItem = () => { throw Error('denied'); }; });
  await load();
  await selectNetlify();
  await page.locator('#use-public').check();
  check(await page.locator('#export-btn').isEnabled(), true);
  await page.locator('#use-rights').uncheck();
  check(await page.locator('#export-btn').isEnabled(), false);
  // A comparison has its own visible cancel action, independent of intake.
  await page.evaluate(() => {
    window.Worker = class { postMessage() {} terminate() { window.testTerminated = (window.testTerminated ?? 0) + 1; } };
  });
  await page.locator('#cmp-zip').setInputFiles(site);
  await page.locator('#compare-cancel-btn').click();
  await page.waitForFunction(() => document.querySelector('#compare-result').textContent.includes('Cancelled'));
  check(await page.evaluate(() => window.testTerminated), 1);
  check(await page.locator('#compare-cancel-btn').isVisible(), false);
  await page.evaluate(() => { window.Worker = class { constructor() { throw Error('unavailable'); } }; });
  await page.locator('#zip-input').setInputFiles(site);
  await page.waitForFunction(() => document.querySelector('#intake-status').textContent.includes('requires Web Worker'));
  check(await page.locator('#inventory').isVisible(), false);
  check(await page.locator('#export-btn').isEnabled(), false);
  check(errors, []);
  check(external, []);
  console.log(JSON.stringify({ browserEngine, checks, pageErrors: errors.length, externalRequests: external.length }));
} finally { await browser.close(); await rm(fixtureDir, { recursive: true, force: true }); }

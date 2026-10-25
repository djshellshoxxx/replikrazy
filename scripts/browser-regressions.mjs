// Optional local Chromium checks. Install playwright-core and axe-core@4.10.2
// outside this repo, set BROWSER_TEST_TOOLS to that directory, build, then run
// against `vite preview`. No provider access or imported content execution.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { zipSync } from 'fflate';
const requireTools = createRequire(resolve(process.env.BROWSER_TEST_TOOLS ?? '.', 'package.json'));
const { chromium } = requireTools('playwright-core');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', args: ['--no-sandbox'] });
const origin = 'http://127.0.0.1:4173';
const errors = [], external = [];
let checks = 0;
const check = (value, expected) => { assert.deepEqual(value, expected); checks++; };
const zip = files => ({ name: 'site.zip', mimeType: 'application/zip', buffer: Buffer.from(zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, new TextEncoder().encode(v)])))) });
const site = zip({ 'index.html': '<script>globalThis.pwned=true</script><h1>Hello</h1>' });
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
  await load();
  await selectNetlify();
  await page.locator('#use-public').check();
  check(await page.locator('#payload-btn').isEnabled(), false);
  check(await page.locator('#export-btn').isEnabled(), false);
  await page.locator('#use-rights').check();
  check(await page.locator('#export-btn').isEnabled(), true);
  check(await page.locator('#payload-btn').isEnabled(), true);
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
  // Storage denial is nonfatal and cannot override fresh policy checks.
  await page.evaluate(() => { Storage.prototype.getItem = () => { throw Error('denied'); }; Storage.prototype.setItem = () => { throw Error('denied'); }; });
  await load();
  await selectNetlify();
  await page.locator('#use-public').check();
  check(await page.locator('#export-btn').isEnabled(), true);
  await page.locator('#use-rights').uncheck();
  check(await page.locator('#export-btn').isEnabled(), false);
  await page.evaluate(() => { window.Worker = class { constructor() { throw Error('unavailable'); } }; });
  await page.locator('#zip-input').setInputFiles(site);
  await page.waitForFunction(() => document.querySelector('#intake-status').textContent.includes('requires Web Worker'));
  check(await page.locator('#inventory').isVisible(), false);
  check(await page.locator('#export-btn').isEnabled(), false);
  check(errors, []);
  check(external, []);
  console.log(JSON.stringify({ checks, pageErrors: errors.length, externalRequests: external.length }));
} finally { await browser.close(); }

// Optional local checks; same external tooling setup as browser-regressions.mjs.
// This checks layout, keyboard reachability and automated rules, not screen-reader usability.
import assert from 'node:assert/strict';
import { zipSync } from 'fflate';
import { browserEngine, launchBrowser, requireTools } from './browser-tools.mjs';
const axe = requireTools('axe-core');
const browser = await launchBrowser();
const origin = 'http://127.0.0.1:4173';
const errors = [], external = [];
let scans = 0, layouts = 0, keyboardControls = 0;
const zip = files => ({ name: 'site.zip', mimeType: 'application/zip', buffer: Buffer.from(zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, new TextEncoder().encode(v)])))) });
try {
  for (const colorScheme of ['light', 'dark']) for (const direction of ['ltr', 'rtl']) {
    const page = await browser.newPage({ colorScheme });
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => { if (!r.url().startsWith(origin + '/')) external.push(r.url()); });
    await page.goto(origin);
    await page.evaluate(dir => { document.documentElement.dir = dir; }, direction);
    await page.evaluate(axe.source);
    for (const loaded of [false, true]) {
      if (loaded) {
        await page.locator('#zip-input').setInputFiles(zip({ 'site/index.html': 'a', 'site/مرحبا.html': 'hello' }));
        await page.waitForFunction(() => document.querySelector('#root-choice input'));
        await page.locator('#root-choice input').check();
        await page.waitForFunction(() => document.querySelector('#intake-status').textContent.includes('site root') && document.querySelector('#artifact-id').textContent.includes('sha256:'));
        await page.locator('#provider-list .card').filter({ has: page.getByRole('heading', { name: /Netlify/ }) }).locator('input').check();
        await page.locator('#use-rights').check();
        await page.locator('#use-public').check();
        await page.locator('#inventory details').evaluate(e => { e.open = true; });
        await page.locator('#cmp-zip').setInputFiles(zip({ 'index.html': 'b', 'مرحبا.html': 'hello' }));
        await page.waitForFunction(() => document.querySelector('#compare-result').textContent.includes('SHA-256 expected:'));
        await page.locator('#compare-result details').evaluateAll(items => items.forEach(e => { e.open = true; }));
        const comparison = await page.locator('#compare-result').textContent();
        assert.ok(comparison.includes('expected 1 bytes, got 1'));
        assert.ok(comparison.includes('ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb'));
        assert.ok(comparison.includes('3e23e8160039594a33894f6564e1b1348bbd7a0088d42c4acb73eeaed59c009d'));
      }
      for (const width of [320, 960]) {
        await page.setViewportSize({ width, height: 900 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${colorScheme}/${direction}/${loaded}/${width} reflow`);
        layouts++;
        const result = await page.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } })).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })));
        assert.deepEqual(result, [], `${colorScheme}/${direction}/${loaded}/${width} axe`);
        scans++;
      }
    }
    // Logical CSS mirrors indentation/margins while hashes remain readable LTR.
    assert.equal(await page.locator('#inventory th').first().evaluate(e => getComputedStyle(e).textAlign), 'start');
    assert.equal(await page.locator('#artifact-id').evaluate(e => getComputedStyle(e).direction), 'ltr');
    const ul = await page.locator('#issues').evaluate(e => ({ start: getComputedStyle(e).paddingInlineStart, end: getComputedStyle(e).paddingInlineEnd }));
    assert.deepEqual(ul, { start: '20px', end: '0px' });
    // Give every visible control a stable testing-only token and traverse Tab.
    const expected = await page.evaluate(() => {
      let i = 0;
      return [...document.querySelectorAll('input,select,button,summary,a[href]')].filter(e => e.getClientRects().length && !e.disabled).map(e => { e.dataset.tabCheck = String(i++); return e.dataset.tabCheck; });
    });
    await page.locator('body').click({ position: { x: 1, y: 1 } });
    const reached = new Set();
    for (let i = 0; i < expected.length + 12; i++) {
      await page.keyboard.press('Tab');
      const token = await page.evaluate(() => document.activeElement?.dataset.tabCheck);
      if (token !== undefined) reached.add(token);
    }
    assert.deepEqual(expected.filter(t => !reached.has(t)), [], `${direction} keyboard reachability`);
    keyboardControls += expected.length;
    await page.close();
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  console.log(JSON.stringify({ browserEngine, axeScans: scans, reflowChecks: layouts, keyboardControls, pageErrors: errors.length, externalRequests: external.length }));
} finally { await browser.close(); }

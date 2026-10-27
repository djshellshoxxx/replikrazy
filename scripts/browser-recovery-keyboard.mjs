// Keyboard/reflow acceptance for recovery UI, not an axe or screen-reader audit.
import assert from 'node:assert/strict';
import { launchBrowser } from './browser-tools.mjs';
const browser = await launchBrowser();
const errors = [], external = [];
let controls = 0, layouts = 0, cancellationFocus = 0;
const source = JSON.stringify({ schemaVersion: '1.0', engineVersion: 'fixture', exportedAt: '2026-10-27T00:00:00.000Z', artifacts: [], plans: [], operations: [], provenance: [] });
try {
  for (const colorScheme of ['light', 'dark']) for (const direction of ['ltr', 'rtl']) {
    const page = await browser.newPage({ colorScheme });
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => { if (!r.url().startsWith('http://127.0.0.1:4173/')) external.push(r.url()); });
    await page.addInitScript(() => {
      const Original = window.Worker;
      window.holdRecovery = false;
      window.Worker = class {
        constructor(url, options) {
          if (!window.holdRecovery || !String(url).includes('recovery-worker')) return new Original(url, options);
        }
        postMessage() {}
        terminate() {}
      };
    });
    await page.goto('http://127.0.0.1:4173/');
    await page.evaluate(dir => document.documentElement.dir = dir, direction);
    await page.locator('#recovery details summary').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#recovery details').evaluate(e => e.open), true);
    for (const pending of [false, true]) {
      await page.evaluate(value => window.holdRecovery = value, pending);
      await page.locator('#recovery-file').setInputFiles({ name: pending ? 'pending.json' : 'valid.json', mimeType: 'application/json', buffer: Buffer.from(source) });
      if (pending) await page.locator('#recovery-cancel').waitFor({ state: 'visible' });
      else await page.waitForFunction(() => document.querySelector('#recovery-result').textContent.includes('Recognized metadata'));
      for (const width of [320, 960]) {
        await page.setViewportSize({ width, height: 900 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${colorScheme}/${direction}/${pending}/${width}`);
        layouts++;
      }
      const expected = await page.evaluate(() => {
        let id = 0;
        const all = [...document.querySelectorAll('input,select,button,summary,a[href]')].filter(e => e.getClientRects().length && !e.disabled);
        for (const e of all) e.dataset.recoveryTab = String(id++);
        document.body.tabIndex = -1; document.body.focus(); document.body.removeAttribute('tabindex');
        return { count: all.length, recovery: all.filter(e => e.closest('#recovery')).map(e => e.dataset.recoveryTab) };
      });
      const reached = new Set();
      for (let n = 0; n < expected.count + 3; n++) {
        await page.keyboard.press('Tab');
        const token = await page.evaluate(() => document.activeElement?.dataset.recoveryTab);
        if (token) reached.add(token);
      }
      assert.deepEqual(expected.recovery.filter(token => !reached.has(token)), []);
      controls += expected.recovery.length;
      if (pending) {
        await page.locator('#recovery-cancel').focus();
        const outline = await page.locator('#recovery-cancel').evaluate(e => ({ style: getComputedStyle(e).outlineStyle, width: getComputedStyle(e).outlineWidth }));
        assert.notEqual(outline.style, 'none'); assert.notEqual(outline.width, '0px');
        await page.keyboard.press('Enter');
        await page.waitForFunction(() => document.querySelector('#recovery-result').textContent.includes('cancelled'));
        assert.equal(await page.evaluate(() => document.activeElement?.id), 'recovery-file', 'cancel restores useful keyboard focus');
        cancellationFocus++;
      }
    }
    await page.close();
  }
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  console.log(JSON.stringify({ recoveryControlsReached: controls, reflowChecks: layouts, cancellationFocusChecks: cancellationFocus, pageErrors: errors.length, externalRequests: external.length }));
} finally { await browser.close(); }

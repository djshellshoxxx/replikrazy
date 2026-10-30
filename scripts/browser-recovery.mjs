// Local read-only recovery workflow; uses installed tooling, never downloads.
import assert from 'node:assert/strict';
import { zipSync } from 'fflate';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { launchBrowser } from './browser-tools.mjs';
const browser = await launchBrowser();
const page = await browser.newPage();
const errors = [], external = [];
let checks = 0;
const check = (a, b) => { assert.deepEqual(a, b); checks++; };
page.on('pageerror', e => errors.push(e.message));
page.on('request', r => { if (!r.url().startsWith('http://127.0.0.1:4173/')) external.push(r.url()); });
const dir = await mkdtemp(join(tmpdir(), 'replikrazy-recovery-'));
const empty = { schemaVersion: '1.0', exportedAt: '2026-10-27T00:00:00.000Z', engineVersion: 'fixture', artifacts: [], plans: [], operations: [], provenance: [] };
const upload = async (source) => {
  await page.locator('#recovery-file').setInputFiles({ name: 'record.json', mimeType: 'application/json', buffer: Buffer.from(source) });
  await page.waitForFunction(() => document.querySelector('#recovery-result').textContent !== 'Inspecting locally…');
};
try {
  await page.goto('http://127.0.0.1:4173/');
  check(await page.locator('#recovery-file').count(), 1);
  await page.locator('#zip-input').setInputFiles({ name: 'site.zip', mimeType: 'application/zip', buffer: Buffer.from(zipSync({ 'index.html': new TextEncoder().encode('<h1>Original site</h1>') })) });
  await page.waitForFunction(() => document.querySelector('#artifact-id').textContent.includes('sha256:'));
  const activeArtifact = await page.locator('#artifact-id').textContent();
  const storageBefore = await page.evaluate(() => JSON.stringify(localStorage));
  await upload(JSON.stringify(empty));
  check((await page.locator('#recovery-result').textContent()).includes('0 artifacts'), true);
  check((await page.locator('#recovery-result').textContent()).includes('Nothing was restored'), true);
  check(await page.locator('#recovery-profile').isChecked(), false);
  await page.locator('#recovery details summary').click();
  await page.locator('#recovery-profile').check();
  await page.waitForFunction(() => document.querySelector('#recovery-result').textContent.includes('Local profile checks passed'));
  checks++;
  const raw = '{"schemaVersion":"2.0","untrusted":"<img src=https://example.invalid/track onerror=alert(1)>"}';
  await upload(raw);
  check((await page.locator('#recovery-result').textContent()).includes('Unsupported'), true);
  check(await page.locator('#recovery-result img').count(), 0);
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#recovery-source').click()]);
  const path = join(dir, 'original.json'); await download.saveAs(path);
  check(await readFile(path, 'utf8'), raw);
  await upload('{"schemaVersion":"1.0","schemaVersion":"2.0"}');
  check((await page.locator('#recovery-result').textContent()).includes('Malformed'), true);
  await upload('{"schemaVersion":"2.0","access_token":"synthetic-secret"}');
  check((await page.locator('#recovery-result').textContent()).includes('private material'), true);
  check((await page.locator('#recovery-result').textContent()).includes('synthetic-secret'), false);
  const binary = Buffer.from([0xff, 0xfe, 0x00]);
  await upload(binary);
  check((await page.locator('#recovery-result').textContent()).includes('Malformed'), true);
  const [binaryDownload] = await Promise.all([page.waitForEvent('download'), page.locator('#recovery-source').click()]);
  const binaryPath = join(dir, 'original-bytes.json'); await binaryDownload.saveAs(binaryPath);
  check(await readFile(binaryPath), binary);
  await upload(' '.repeat(10 * 1024 * 1024 + 1));
  check((await page.locator('#recovery-result').textContent()).includes('size, work or time limit'), true);
  await page.locator('#recovery-clear').click();
  check(await page.locator('#recovery-source').isEnabled(), false);
  check(await page.locator('#recovery-profile').isChecked(), false);
  for (const direction of ['ltr', 'rtl']) {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.evaluate(dir => document.documentElement.dir = dir, direction);
    check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  }
  check(await page.locator('#artifact-id').textContent(), activeArtifact);
  check(await page.evaluate(() => JSON.stringify(localStorage)), storageBefore);
  const delayed = await browser.newPage();
  delayed.on('pageerror', e => errors.push(e.message));
  delayed.on('request', r => { if (!r.url().startsWith('http://127.0.0.1:4173/')) external.push(r.url()); });
  await delayed.addInitScript(() => {
    const Original = window.Worker;
    window.recoveryWorkers = [];
    window.Worker = class {
      constructor(url, options) {
        if (!String(url).includes('recovery-worker')) return new Original(url, options);
        window.recoveryWorkers.push(this);
      }
      postMessage() {}
      terminate() { this.terminated = true; }
    };
  });
  await delayed.goto('http://127.0.0.1:4173/');
  await delayed.locator('#recovery-file').setInputFiles({ name: 'pending.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(empty)) });
  await delayed.waitForFunction(() => window.recoveryWorkers.length === 1);
  await delayed.locator('#recovery-file').setInputFiles([]);
  await delayed.evaluate(() => window.recoveryWorkers[0].onmessage({ data: { ok: true, value: { artifacts: 1, plans: 0, operations: 0, provenance: 0, profileChecked: false } } }));
  check(await delayed.locator('#recovery-result').textContent(), 'No recovery file selected.');
  check(await delayed.locator('#recovery-source').isEnabled(), false);
  check(await delayed.evaluate(() => window.recoveryWorkers[0].terminated), true);
  await delayed.close();
  check(errors, []); check(external, []);
  console.log(JSON.stringify({ checks, pageErrors: errors.length, externalRequests: external.length }));
} finally { await browser.close(); await rm(dir, { recursive: true, force: true }); }

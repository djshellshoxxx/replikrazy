// Installed local browser only: exact byte binding, mismatch and stale completion.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { zipSync } from 'fflate';
import { launchBrowser } from './browser-tools.mjs';
const browser = await launchBrowser(), page = await browser.newPage();
const origin = 'http://127.0.0.1:4173', errors = [], external = [];
let checks = 0;
const check = (a,b) => { assert.deepEqual(a,b); checks++; };
page.on('pageerror', e => errors.push(e.message));
page.on('request', r => { if (!r.url().startsWith(origin + '/')) external.push(r.url()); });
const hash = b => createHash('sha256').update(b).digest('hex');
const canonical = x => JSON.stringify(x === null || typeof x !== 'object' ? x : x, function(k,v) { return v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])) : v; });
const manifest = { schemaVersion:'1.0', appId:'recovered', files:[{path:'index.html',size:6,sha256:hash('public')}], entrypoint:'index.html' };
const id = 'sha256:' + hash(canonical(manifest));
const record = { schemaVersion:'1.0', exportedAt:'2026-10-27T00:00:00.000Z', engineVersion:'fixture', artifacts:[{artifactId:id,manifest,totalBytes:6,fileCount:1,sourceKind:'folder',capturedAt:'2026-10-27T00:00:00.000Z'}], plans:[],operations:[],provenance:[] };
const load = async content => {
  await page.locator('#zip-input').setInputFiles({name:'site.zip',mimeType:'application/zip',buffer:Buffer.from(zipSync({'index.html':Buffer.from(content)}))});
  await page.waitForFunction(()=>document.querySelector('#artifact-id').textContent.includes('sha256:'));
};
const upload = async data => {
  await page.locator('#recovery-file').setInputFiles({name:'record.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
  await page.waitForFunction(()=>document.querySelector('#recovery-result').textContent !== 'Inspecting locally…');
};
try {
  await page.goto(origin); await load('public'); await upload(record);
  await page.locator('#provider-list .card').filter({ has: page.getByRole('heading', { name: /Netlify/ }) }).locator('input').check();
  await page.locator('#use-public').check();
  await page.locator('#recovery-restore').click();
  await page.waitForFunction(()=>document.querySelector('#recovery-result').textContent.includes('Exact local payload match'));
  check(await page.locator('#artifact-id').textContent(), 'Artifact id: '+id);
  check(await page.locator('#app-id').inputValue(), 'recovered');
  check(await page.locator('#use-public').isChecked(), false);
  check(await page.locator('#payload-btn').isEnabled(), false);
  check(await page.locator('#export-btn').isEnabled(), false);
  check(await page.evaluate(()=>localStorage.length),0);
  await load('PUBLIC'); const before = await page.locator('#artifact-id').textContent();
  await page.locator('#recovery-restore').click();
  await page.waitForFunction(()=>document.querySelector('#recovery-result').textContent.includes('Nothing was applied'));
  check(await page.locator('#artifact-id').textContent(), before);
  await upload({...record,schemaVersion:'2.0'}); await page.locator('#recovery-restore').click();
  await page.waitForFunction(()=>document.querySelector('#recovery-result').textContent.includes('Unsupported'));
  check(await page.locator('#artifact-id').textContent(),before);
  // Hold a real matching worker result, then replace the active selected bytes.
  await load('public'); await upload(record);
  await page.evaluate(()=>{
    const Native = window.Worker;
    window.Worker = class {
      constructor(url,opts) {
        this.real = new Native(url,opts);
        this.real.onmessage = e => {
          if(e.data?.value?.matchedManifest) window.releaseRecovery = () => this.onmessage?.(e);
          else this.onmessage?.(e);
        };
        this.real.onerror = e => this.onerror?.(e);
        this.real.onmessageerror = e => this.onmessageerror?.(e);
      }
      postMessage(...args) { this.real.postMessage(...args); }
      terminate() { this.real.terminate(); }
    };
  });
  await page.locator('#recovery-restore').click();
  await page.waitForFunction(()=>window.releaseRecovery);
  await load('changed'); const newer = await page.locator('#artifact-id').textContent();
  await page.evaluate(()=>window.releaseRecovery());
  await page.waitForFunction(()=>document.querySelector('#recovery-result').textContent.includes('selected site changed'));
  check(await page.locator('#artifact-id').textContent(), newer);
  // Independently reproduced review case: replacement during final UI hashing.
  await page.reload(); await load('public'); await upload(record);
  await page.evaluate(() => {
    const native = crypto.subtle.digest.bind(crypto.subtle); let calls = 0;
    crypto.subtle.digest = (...args) => {
      if (++calls === 3) return new Promise(resolve => { window.releaseDigest = () => native(...args).then(resolve); });
      return native(...args);
    };
  });
  await page.locator('#recovery-restore').click();
  await page.waitForFunction(() => typeof window.releaseDigest === 'function');
  await load('newest'); const newest = await page.locator('#artifact-id').textContent();
  await page.evaluate(() => window.releaseDigest());
  await page.waitForFunction(() => /Exact local payload match|selected site changed/.test(document.querySelector('#recovery-result').textContent));
  check((await page.locator('#recovery-result').textContent()).includes('selected site changed'), true);
  check(await page.locator('#artifact-id').textContent(), newest);
  check(errors,[]); check(external,[]);
  console.log(JSON.stringify({checks,pageErrors:errors.length,externalRequests:external.length}));
} finally { await browser.close(); }

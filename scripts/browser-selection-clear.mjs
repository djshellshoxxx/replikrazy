import assert from 'node:assert/strict';
import { zipSync } from 'fflate';
import { launchBrowser } from './browser-tools.mjs';
const browser = await launchBrowser(), page = await browser.newPage();
const origin = 'http://127.0.0.1:4173', errors = [], external = [];
let checks = 0;
const check = (a,b) => { assert.deepEqual(a,b); checks++; };
page.on('pageerror', e => errors.push(e.message));
page.on('request', r => { if (!r.url().startsWith(origin + '/')) external.push(r.url()); });
const site = {name:'site.zip',mimeType:'application/zip',buffer:Buffer.from(zipSync({'index.html':Buffer.from('public')}))};
const load = async () => { await page.locator('#zip-input').setInputFiles(site); await page.waitForFunction(()=>document.querySelector('#artifact-id').textContent.includes('sha256:')); };
try {
  await page.goto(origin);
  for (const picker of ['#zip-input','#dir-input']) {
    await load();
    await page.locator(picker).evaluate(el => { el.value = ''; el.dispatchEvent(new Event('change', {bubbles:true})); });
    check((await page.locator('#artifact-id').textContent()).includes('sha256:'), false);
    check(await page.locator('#payload-btn').isEnabled(),false);
  }
  await load();
  for (const picker of ['#cmp-zip','#cmp-dir']) {
    await page.locator('#cmp-zip').setInputFiles(site);
    await page.waitForFunction(()=>document.querySelector('#compare-result').textContent.includes('Every file matches'));
    await page.locator(picker).evaluate(el => { el.value = ''; el.dispatchEvent(new Event('change', {bubbles:true})); });
    check((await page.locator('#compare-result').textContent()).includes('Every file matches'),false);
  }
  await page.evaluate(()=>{
    const Native = window.Worker;
    window.Worker = class {
      constructor(url,opts) {
        this.real = new Native(url,opts);
        this.real.onmessage = e => {
          if(e.data?.type === 'done') window.releaseSelected = () => this.onmessage?.(e);
          else this.onmessage?.(e);
        };
        this.real.onerror = e => this.onerror?.(e);
        this.real.onmessageerror = e => this.onmessageerror?.(e);
      }
      postMessage(...args) { this.real.postMessage(...args); }
      terminate() { this.real.terminate(); }
    };
  });
  // A queued real comparison completion must not resurrect a cleared picker.
  await page.locator('#cmp-zip').setInputFiles(site);
  await page.waitForFunction(()=>window.releaseSelected);
  await page.locator('#cmp-zip').setInputFiles([]);
  await page.evaluate(async()=>{ window.releaseSelected(); await new Promise(requestAnimationFrame); });
  check((await page.locator('#compare-result').textContent()).includes('Every file matches'),false);
  check(await page.locator('#compare-cancel-btn').isVisible(),false);
  await page.evaluate(()=>{ delete window.releaseSelected; });
  await page.locator('#zip-input').setInputFiles(site);
  await page.waitForFunction(()=>window.releaseSelected);
  await page.locator('#zip-input').setInputFiles([]);
  await page.evaluate(async()=>{ window.releaseSelected(); await new Promise(requestAnimationFrame); });
  check((await page.locator('#artifact-id').textContent()).includes('sha256:'),false);
  check(await page.locator('#cancel-btn').isVisible(),false);
  check(errors,[]); check(external,[]);
  console.log(JSON.stringify({checks,pageErrors:errors.length,externalRequests:external.length}));
} finally { await browser.close(); }

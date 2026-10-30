import assert from 'node:assert/strict';
import { zipSync } from 'fflate';
import { launchBrowser } from './browser-tools.mjs';
const origin = process.env.TEST_ORIGIN ?? 'http://127.0.0.1:4174';
const browser = await launchBrowser();
const errors = [], external = [];
let checks = 0;
const fixture = {name:'site.zip',mimeType:'application/zip',buffer:Buffer.from(zipSync({'index.html':Buffer.from('public')}))};
try {
 for (const dir of ['ltr','rtl']) {
  const page = await browser.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => {if (!r.url().startsWith(origin+'/')) external.push(r.url());});
  await page.addInitScript(()=>{
   const Native=window.Worker;
   window.Worker=class {
    constructor(url,options){if(!window.holdAnalysis) return new Native(url,options);}
    postMessage(){} terminate(){}
   };
  });
  await page.goto(origin);
  await page.evaluate(d=>document.documentElement.dir=d,dir);
  for (const [picker,cancel] of [['zip-input','cancel-btn'],['cmp-zip','compare-cancel-btn']]) {
   if (picker==='cmp-zip') {
    await page.evaluate(()=>window.holdAnalysis=false);
    await page.locator('#zip-input').setInputFiles(fixture);
    await page.waitForFunction(()=>document.querySelector('#artifact-id').textContent.includes('sha256:'));
   }
   for (const focused of [true,false]) {
    await page.evaluate(()=>window.holdAnalysis=true);
    await page.locator('#'+picker).setInputFiles(fixture);
    await page.locator('#'+cancel).waitFor({state:'visible'});
    if(focused) {
     await page.locator('#'+cancel).focus(); await page.keyboard.press('Enter');
    } else {
     await page.locator('#dir-input').focus();
     await page.locator('#'+cancel).evaluate(e=>e.click());
    }
    await page.locator('#'+cancel).waitFor({state:'hidden'});
    assert.equal(await page.evaluate(()=>document.activeElement?.id),focused ? picker : 'dir-input',`${dir}/${cancel}/${focused}`);
    checks++;
   }
  }
  await page.close();
 }
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 console.log(JSON.stringify({focusChecks:checks,pageErrors:errors.length,externalRequests:external.length}));
} finally {await browser.close();}

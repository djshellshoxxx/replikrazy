// Run against the canonical Vite dev server (trusted source modules), not a provider.
import assert from 'node:assert/strict';
import { launchBrowser } from './browser-tools.mjs';
const origin=process.env.TEST_ORIGIN ?? 'http://127.0.0.1:4175';
const browser=await launchBrowser(), page=await browser.newPage();
const errors=[],external=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('request',r=>{if(!r.url().startsWith(origin+'/'))external.push(r.url());});
try {
 await page.goto(origin);
 const result=await page.evaluate(async()=>{
  const {buildInventory}=await import('/src/core/inventory.ts');
  const {buildManifest,artifactId}=await import('/src/contracts/manifest.ts');
  const {buildPublishPlan}=await import('/src/contracts/publish-plan.ts');
  const {buildPlan}=await import('/src/core/plan.ts');
  const {analyze}=await import('/src/core/analyze.ts');
  const {getProvider}=await import('/src/providers/catalogue.ts');
  const {buildExport}=await import('/src/core/exporter.ts');
  const {checkCanonicalBundle}=await import('/src/consumers/bundle-check.ts');
  const {createComparisonReport}=await import('/src/consumers/comparison-report.ts');
  const {compareInventories}=await import('/src/core/compare.ts');
  const files=[{path:'index.html',bytes:new TextEncoder().encode('public browser fixture')}];
  const inv=await buildInventory(files), manifest=buildManifest('browser-fixture',inv.entries,'index.html').manifest;
  const aid=await artifactId(manifest), now=Date.parse('2026-10-30T12:00:00.000Z');
  const use={category:'personal',containsPrivateData:false,ownerHasRights:true,description:'public example'};
  const providers=[getProvider('netlify')],dry=buildPlan(aid,analyze(inv.entries),false,providers,undefined,use);
  const plan=await buildPublishPlan(manifest,aid,use,dry,providers,undefined,now);
  const zip=buildExport(files,inv,manifest,dry,providers,undefined,plan);
  return {bundle:await checkCanonicalBundle(zip,now),expired:await checkCanonicalBundle(zip,now+86400000),report:await createComparisonReport(compareInventories(inv.entries,inv.entries),aid)};
 });
 assert.equal(result.bundle.ok,true);assert.equal(result.bundle.value.valid,true);
 assert.equal(result.bundle.value.publishAuthorized,false);assert.equal(result.bundle.value.liveVerified,false);
 assert.equal(result.expired.value.valid,false);assert.equal(result.expired.value.planExpired,true);
 assert.equal(result.report.value.verdict,'identical');assert.equal(result.report.value.liveVerified,false);
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 console.log('10 local consumer browser assertions passed; zero page errors/external requests.');
} finally {await browser.close();}

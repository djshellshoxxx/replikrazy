import { expect, it, vi } from "vitest";
import { zipSync, unzipSync } from "fflate";
import { createComparisonReport } from "../../src/consumers/comparison-report";
import { checkCanonicalBundle } from "../../src/consumers/bundle-check";
import { compareInventories } from "../../src/core/compare";
import { buildInventory, sha256Hex } from "../../src/core/inventory";
import { artifactId, buildManifest } from "../../src/contracts/manifest";
import { canonicalBytes } from "../../src/contracts/canonical";
import { buildPublishPlan } from "../../src/contracts/publish-plan";
import { buildPlan } from "../../src/core/plan";
import { analyze } from "../../src/core/analyze";
import { buildExport } from "../../src/core/exporter";
import { getProvider } from "../../src/providers/catalogue";
const now = Date.parse("2026-10-30T12:00:00.000Z");
const enc = new TextEncoder();
const id = `sha256:${"a".repeat(64)}`;
async function fixture() {
 const files = [{path:"index.html",bytes:enc.encode("public")},{path:"style.css",bytes:enc.encode("body{}") }];
 const inv = await buildInventory(files);
 const m = buildManifest("sample", inv.entries, "index.html"); if(!m.ok) throw Error();
 const aid=await artifactId(m.manifest);
 const use={category:"personal" as const, containsPrivateData:false as const,ownerHasRights:true,description:"example"};
 const providers=[getProvider("netlify")!];
 const dry=buildPlan(aid,analyze(inv.entries),false,providers,undefined,use);
 const plan=await buildPublishPlan(m.manifest,aid,use,dry,providers,undefined,now);
 const zip=buildExport(files,inv,m.manifest,dry,providers,undefined,plan);
 return {zip,plan,aid,manifest:m.manifest};
}
function repack(zip:Uint8Array, edit:(files:Record<string,Uint8Array>)=>void){const f=unzipSync(zip);edit(f);return zipSync(f,{level:0});}
it("creates deterministic sorted reports without mutating input or claiming live verification", async()=>{
 const want=await buildInventory([{path:"z",bytes:enc.encode("a")},{path:"a",bytes:enc.encode("a")}]);
 const got=await buildInventory([{path:"z",bytes:enc.encode("b")},{path:"a",bytes:enc.encode("b")}]);
 const c=compareInventories(want.entries,got.entries);c.changed.reverse();const before=JSON.stringify(c);
 const r=await createComparisonReport(c,id);expect(r.ok).toBe(true);if(!r.ok)return;
 expect(r.value.changed.map(x=>x.path)).toEqual(["a","z"]);expect(r.value.liveVerified).toBe(false);
 const {reportId,...body}=r.value;expect(reportId).toBe(`sha256:${await sha256Hex(canonicalBytes(body))}`);
 expect(JSON.stringify(c)).toBe(before);expect(await createComparisonReport({...c,changed:[...c.changed].reverse()},id)).toEqual(r);
});
it.each([
 {matching:["x","x"],changed:[],missing:[],extra:[]},
 {matching:["../x"],changed:[],missing:[],extra:[]},
 {matching:["x"],changed:[],missing:["x"],extra:[]},
 {matching:new Array(2),changed:[],missing:[],extra:[]},
 {matching:[],changed:[{path:"x",expectedSize:1,actualSize:1,expectedSha256:"a".repeat(64),actualSha256:"a".repeat(64)}],missing:[],extra:[]},
])("rejects malformed comparison input without echoing values",async c=>{const r=await createComparisonReport(c,id);expect(r.ok).toBe(false);expect(JSON.stringify(r)).not.toContain("../x");});
it("bounds report collections and checks digest",async()=>{
 expect((await createComparisonReport({matching:Array(10001).fill("x"),changed:[],missing:[],extra:[]},id)).ok).toBe(false);
 expect((await createComparisonReport({matching:[],changed:[],missing:[],extra:[]},"bad")).ok).toBe(false);
});
it("validates a real canonical exporter roundtrip without network or mutation",async()=>{
 const f=await fixture(), before=f.zip.slice();const fetch=vi.spyOn(globalThis,"fetch").mockImplementation(()=>{throw Error("network prohibited");});
 try {const r=await checkCanonicalBundle(f.zip,now);expect(r.ok).toBe(true);if(!r.ok)return;
 expect(r.value.valid).toBe(true);expect(r.value.artifactId).toBe(f.aid);expect(r.value.comparison.verdict).toBe("identical");
 expect(r.value.publishAuthorized).toBe(false);expect(r.value.liveVerified).toBe(false);expect(r.value.planExpired).toBe(false);
 expect(r.value.uncheckedControlFiles).toContain("mirrorkit-control/handoff-status.json");expect(fetch).not.toHaveBeenCalled();expect(f.zip).toEqual(before);
 }finally{fetch.mockRestore();}
});
it("reports same-size changed, missing and extra payloads with exact hashes",async()=>{
 const f=await fixture();const zip=repack(f.zip,files=>{files['app/index.html']=enc.encode('change');delete files['app/style.css'];files['app/extra.txt']=enc.encode('new');});
 const r=await checkCanonicalBundle(zip,now);expect(r.ok).toBe(true);if(!r.ok)return;
 expect(r.value.valid).toBe(false);expect(r.value.comparison.changed[0]?.expectedSize).toBe(6);expect(r.value.comparison.changed[0]?.actualSize).toBe(6);
 expect(r.value.comparison.missing).toEqual(['style.css']);expect(r.value.comparison.extra).toEqual(['extra.txt']);expect(r.value.errors).toContain('MK_HASH_MISMATCH');
});
it("reports expiry without authorizing stale plans",async()=>{const f=await fixture();const r=await checkCanonicalBundle(f.zip,now+86400000);expect(r.ok && r.value.planExpired).toBe(true);expect(r.ok && r.value.valid).toBe(false);});
it.each(['duplicate','version','hash','private'])('rejects %s manifest/plan records with safe errors',async kind=>{
 const f=await fixture();const zip=repack(f.zip,files=>{
  const key='mirrorkit-control/publish-plan.json';const plan=JSON.parse(new TextDecoder().decode(files[key]));
  if(kind==='duplicate'){files[key]=enc.encode('{"schemaVersion":"1.0","schemaVersion":"1.0"}');return;}
  if(kind==='version')plan.schemaVersion='9.0';if(kind==='hash')plan.artifactId=`sha256:${'b'.repeat(64)}`;if(kind==='private')plan.password='PRIVATE_SENTINEL';
  files[key]=enc.encode(JSON.stringify(plan));
 });const r=await checkCanonicalBundle(zip,now);expect(r.ok).toBe(false);expect(JSON.stringify(r)).not.toContain('PRIVATE_SENTINEL');
});
it("rejects noncanonical manifest bytes even when JSON describes the same manifest",async()=>{const f=await fixture();const r=await checkCanonicalBundle(repack(f.zip,files=>{files['mirrorkit-control/artifact-manifest.json']=enc.encode(JSON.stringify(f.manifest,null,2));}),now);expect(r.ok).toBe(false);});
it.each(['outside.txt','app/../escape','app/INDEX.html','app/index.html/child'])('rejects unsafe or ambiguous bundle path %s',async path=>{const f=await fixture();expect((await checkCanonicalBundle(repack(f.zip,files=>{files[path]=enc.encode('x');}),now)).ok).toBe(false);});
it("rejects planner format, missing plan, corrupt archive and invalid clock",async()=>{
 expect((await checkCanonicalBundle(zipSync({'offline-mirror-plan/site/index.html':enc.encode('x')}),now)).ok).toBe(false);
 const f=await fixture();expect((await checkCanonicalBundle(repack(f.zip,files=>{delete files['mirrorkit-control/publish-plan.json'];}),now)).ok).toBe(false);
 expect((await checkCanonicalBundle(new Uint8Array([1,2,3]),now)).ok).toBe(false);expect((await checkCanonicalBundle(f.zip,NaN)).ok).toBe(false);
});
it("rejects folded file/directory ancestor conflicts",async()=>{
 const f=await fixture();const zip=repack(f.zip,files=>{files['app/Foo']=enc.encode('x');files['app/foo/bar/']=new Uint8Array();});
 expect((await checkCanonicalBundle(zip,now)).ok).toBe(false);
});
it("does not spend payload path budget on the app wrapper",async()=>{
 const path='a'.repeat(119)+'/'+'b'.repeat(115)+'.txt';expect(new TextEncoder().encode(path).length).toBe(239);
 const f=await fixture();const r=await checkCanonicalBundle(repack(f.zip,files=>{files['app/'+path]=enc.encode('x');}),now);
 expect(r.ok).toBe(true);if(r.ok)expect(r.value.comparison.extra).toContain(path);
});
it("binds report facts before awaiting hashes",async()=>{
 const c={matching:[],changed:[],missing:['index.html'],extra:[]};const pending=createComparisonReport(c,id);c.missing[0]='changed-after-call';
 const r=await pending;expect(r.ok && r.value.missing).toEqual(['index.html']);
});
it("rejects unknown comparison fields instead of silently dropping records",async()=>{
 expect((await createComparisonReport({matching:[],changed:[],missing:[],extra:[],secret:'do-not-copy'},id)).ok).toBe(false);
});
it.each(['rights','payment','future','mutation'])('fails closed for rehashed %s plan',async kind=>{
 const f=await fixture();const plan=structuredClone(f.plan);
 if(kind==='rights')plan.intendedUse.ownerHasRights=false;
 if(kind==='payment')plan.intendedUse.category='payment';
 if(kind==='future'){plan.createdAt=new Date(now+1000).toISOString();plan.expiresAt=new Date(now+86400000).toISOString();}
 if(kind==='mutation')(plan.destinations[0]!.operations[0] as {remoteMutation:boolean}).remoteMutation=true;
 const {planId,...body}=plan;plan.planId=`sha256:${await sha256Hex(canonicalBytes(body))}`;
 const r=await checkCanonicalBundle(repack(f.zip,files=>{files['mirrorkit-control/publish-plan.json']=canonicalBytes(plan);}),now);
 if(kind==='mutation')expect(r.ok).toBe(false);else expect(r.ok && r.value.valid).toBe(false);
});
it("never executes uploaded source or fetches declared dependencies",async()=>{
 const f=await fixture();const payload=enc.encode('<script>fetch("https://must-not-run.invalid/");globalThis.EXECUTED=true</script>');
 const fetch=vi.spyOn(globalThis,'fetch').mockImplementation(()=>{throw Error('network prohibited');});
 try {
  const r=await checkCanonicalBundle(repack(f.zip,files=>{files['app/index.html']=payload;}),now);
  expect(r.ok && r.value.valid).toBe(false);expect(fetch).not.toHaveBeenCalled();expect((globalThis as Record<string,unknown>).EXECUTED).toBeUndefined();
 }finally{fetch.mockRestore();}
});
it("rejects oversized records before parsing and malformed UTF-8",async()=>{
 const f=await fixture();
 for(const data of [new Uint8Array(10*1024*1024+1),new Uint8Array([255])]) {
  const r=await checkCanonicalBundle(repack(f.zip,files=>{files['mirrorkit-control/publish-plan.json']=data;}),now);
  expect(r.ok).toBe(false);
 }
});
it("does not mutate unsupported source and never returns its opaque contents",async()=>{
 const zip=zipSync({'unknown/source.txt':enc.encode('PRIVATE_UNCHECKED')},{level:0});const copy=zip.slice();
 const r=await checkCanonicalBundle(zip,now);expect(r.ok).toBe(false);expect(zip).toEqual(copy);expect(JSON.stringify(r)).not.toContain('PRIVATE_UNCHECKED');
});
it("rejects changed-size totals outside the artifact budget",async()=>{
 const changed=Array.from({length:9},(_,n)=>({path:`file-${n}`,expectedSize:32*1024*1024,actualSize:1,expectedSha256:'a'.repeat(64),actualSha256:'b'.repeat(64)}));
 expect((await createComparisonReport({matching:[],changed,missing:[],extra:[]},id)).ok).toBe(false);
});

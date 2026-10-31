// Canonical handoff inspection only. No hydration, execution or upload approval.
import { readZip, ZipError, DEFAULT_ZIP_LIMITS } from "../core/zip";
import { compareUtf8, validatePath, findCaseCollisions } from "../core/paths";
import { buildInventory } from "../core/inventory";
import { compareInventories } from "../core/compare";
import { artifactId, validateManifest, type ArtifactManifest, type Digest } from "../contracts/manifest";
import { canonicalBytes } from "../contracts/canonical";
import { parseRecordJson, RECORD_MAX_BYTES, RecordJsonError } from "../contracts/record-json";
import { hasExcludedRecordMaterial } from "../contracts/record-secrets";
import { validateRecoveryPlan } from "../contracts/recovery-plan";
import { isExpired, type PublishPlan } from "../contracts/publish-plan";
import { exportUseBlockers } from "../contracts/intended-use";
import { isRecord, type ErrorCode, type Result } from "../contracts/diagnostic";
import { createComparisonReport, type ComparisonReportV1 } from "./comparison-report";
export interface CanonicalBundleCheckV1 {
  schema:"replikrazy-bundle-check"; schemaVersion:1; kind:"canonical-handoff";
  valid:boolean; artifactId:Digest; planId:Digest; planExpired:boolean;
  publishAuthorized:false; liveVerified:false; uploadRoot:"app/"; neverUpload:["mirrorkit-control/"];
  comparison:ComparisonReportV1; errors:ErrorCode[]; uncheckedControlFiles:string[];
}
const manifestPath="mirrorkit-control/artifact-manifest.json", planPath="mirrorkit-control/publish-plan.json";
const reject = (code:ErrorCode):Result<never> => ({ok:false,error:{code,messageKey:"consumer.bundle-unapplied",params:{},retry:"after-user-action"}});
function readRecord(bytes:Uint8Array):unknown {
  if (bytes.length > RECORD_MAX_BYTES) throw new RecordJsonError("MK_LIMIT_EXCEEDED");
  const value=parseRecordJson(new TextDecoder("utf-8",{fatal:true,ignoreBOM:true}).decode(bytes));
  if(hasExcludedRecordMaterial(value)) throw new RecordJsonError("MK_RECORD_CORRUPT");
  return value;
}
export async function checkCanonicalBundle(input:Uint8Array, nowMs:number):Promise<Result<CanonicalBundleCheckV1>> {
  if (!(input instanceof Uint8Array) || !Number.isSafeInteger(nowMs) || nowMs < 0 || nowMs > 8.64e15) return reject("MK_RECORD_CORRUPT");
  if(input.byteLength > DEFAULT_ZIP_LIMITS.maxArchiveBytes) return reject("MK_LIMIT_EXCEEDED");
  try {
    // Immutable snapshot, including all control bytes, before asynchronous hashing.
    const archive=readZip(input.slice(),DEFAULT_ZIP_LIMITS,true);
    if(archive.rejected.length) return reject(archive.rejected[0]!.code);
    const payload:{path:string;bytes:Uint8Array}[]=[], controls=new Map<string,Uint8Array>();
    const fileNames=archive.entries.map(e=>e.name), directoryNames=archive.directories ?? [];
    // Wrappers are container structure, not part of the payload's path budget.
    const validContainerPath=(name:string,directory=false) => {
      if(directory && (name==="app" || name==="mirrorkit-control")) return true;
      for(const prefix of ["app/","mirrorkit-control/"]) if(name.startsWith(prefix)) return validatePath(name.slice(prefix.length)).ok;
      return false;
    };
    for (const [names, directory] of [[fileNames, false], [directoryNames, true]] as const)
      for (const name of names) if (!validContainerPath(name, directory))
        return reject(name.startsWith("offline-mirror-plan/") ? "MK_CAPABILITY_UNSUPPORTED" : "MK_PATH_INVALID");
    // Include implicit directory ancestors; compare using both existing Unicode
    // folds. Set membership avoids a files × directories scan at the limits.
    const directories = new Set(directoryNames);
    for (const name of [...fileNames, ...directoryNames]) {
      let at = name.indexOf("/");
      while (at >= 0) { directories.add(name.slice(0, at)); at = name.indexOf("/", at + 1); }
    }
    if (findCaseCollisions([...fileNames, ...directories]).length) return reject("MK_PATH_COLLISION");
    for(const e of archive.entries) {
      if(e.name.startsWith("app/")) payload.push({path:e.name.slice(4),bytes:e.bytes});
      else controls.set(e.name,e.bytes);
    }
    const mb=controls.get(manifestPath), pb=controls.get(planPath);
    if(!mb || !pb) return reject("MK_RECORD_CORRUPT");
    const raw=readRecord(mb);
    if(isRecord(raw) && raw.schemaVersion!=="1.0") return reject("MK_SCHEMA_UNSUPPORTED");
    if(validateManifest(raw).length) return reject("MK_RECORD_CORRUPT");
    const manifest=raw as ArtifactManifest;
    if(manifest.files.some(f=>f.size>DEFAULT_ZIP_LIMITS.maxFileBytes) || manifest.files.reduce((n,f)=>n+f.size,0)>DEFAULT_ZIP_LIMITS.maxTotalBytes) return reject("MK_LIMIT_EXCEEDED");
    const canonical=canonicalBytes(manifest);
    if(canonical.length!==mb.length || !canonical.every((b,i)=>b===mb[i])) return reject("MK_HASH_MISMATCH");
    const aid=await artifactId(manifest);
    const planRaw=readRecord(pb);
    const checked=await validateRecoveryPlan(planRaw,new Map([[aid,{artifactId:aid,manifest,totalBytes:manifest.files.reduce((n,f)=>n+f.size,0),fileCount:manifest.files.length,sourceKind:"zip" as const,capturedAt:new Date(nowMs).toISOString()}]]));
    if(!checked.ok) return reject(checked.error.code);
    const plan=checked.value as unknown as PublishPlan;
    const inv=await buildInventory(payload);
    const report=await createComparisonReport(compareInventories(manifest.files,inv.entries),aid);
    if(!report.ok)return report;
    const errors:ErrorCode[]=[];
    if(report.value.verdict!=="identical")errors.push("MK_HASH_MISMATCH");
    const expired=isExpired(plan,nowMs);
    if(expired || Date.parse(plan.createdAt)>nowMs)errors.push("MK_EVIDENCE_STALE");
    if(exportUseBlockers(plan.intendedUse).length || plan.destinations.some(d=>d.mode==="disabled" || d.diagnostics.some(x=>x.severity==="blocker"))) errors.push("MK_POLICY_BLOCKED");
    return {ok:true,value:{schema:"replikrazy-bundle-check",schemaVersion:1,kind:"canonical-handoff",valid:!errors.length,
      artifactId:aid,planId:plan.planId,planExpired:expired,publishAuthorized:false,liveVerified:false,uploadRoot:"app/",neverUpload:["mirrorkit-control/"],
      comparison:report.value,errors,uncheckedControlFiles:[...controls.keys()].filter(p=>p!==manifestPath && p!==planPath).sort(compareUtf8)}};
  } catch(e) {
    if(e instanceof ZipError || e instanceof RecordJsonError)return reject(e.code);
    return reject("MK_RECORD_CORRUPT");
  }
}

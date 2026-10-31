// Local report identity only; no provider or publishing authority.
import { canonicalBytes } from "../contracts/canonical";
import { exactKeys, isRecord, isUInt, type Result } from "../contracts/diagnostic";
import { digest } from "../contracts/record-fields";
import type { Digest } from "../contracts/manifest";
import type { Comparison } from "../core/compare";
import { compareUtf8, validatePath } from "../core/paths";
import { sha256Hex } from "../core/inventory";
import { DEFAULT_ZIP_LIMITS } from "../core/zip";
export interface ComparisonReportV1 {
  schema: "replikrazy-comparison-report"; schemaVersion: 1;
  reportId: Digest; artifactId: Digest; liveVerified: false;
  verdict: "identical" | "differs";
  counts: { matching: number; changed: number; missing: number; extra: number };
  changed: Comparison["changed"]; missing: string[]; extra: string[];
}
const hash = (x: unknown): x is string => typeof x === "string" && /^[0-9a-f]{64}$/.test(x);
export async function createComparisonReport(input: unknown, artifact: unknown): Promise<Result<ComparisonReportV1>> {
  const reject = (): Result<never> => ({ok:false,error:{code:"MK_RECORD_CORRUPT",messageKey:"consumer.invalid-comparison",params:{},retry:"after-user-action"}});
  if (!digest(artifact) || !isRecord(input) || !exactKeys(input,["matching","changed","missing","extra"])) return reject();
  const cap = DEFAULT_ZIP_LIMITS.maxEntries;
  for (const key of ["matching","changed","missing","extra"])
    if (!Array.isArray(input[key]) || input[key].length > cap) return reject();
  const c = input as unknown as Comparison;
  if (c.matching.length+c.changed.length+c.missing.length > cap || c.matching.length+c.changed.length+c.extra.length > cap) return reject();
  const seen = new Set<string>();
  const path = (x: unknown): x is string => {
    if (typeof x !== "string" || !validatePath(x).ok || seen.has(x)) return false;
    seen.add(x); return true;
  };
  for (const list of [c.matching,c.missing,c.extra]) for (const p of list) if (!path(p)) return reject();
  const changed: Comparison["changed"] = [];
  for (const x of c.changed) {
    if (!isRecord(x) || !exactKeys(x,["path","expectedSize","actualSize","expectedSha256","actualSha256"]) || !path(x.path)
      || !isUInt(x.expectedSize) || !isUInt(x.actualSize) || x.expectedSize > DEFAULT_ZIP_LIMITS.maxFileBytes || x.actualSize > DEFAULT_ZIP_LIMITS.maxFileBytes
      || !hash(x.expectedSha256) || !hash(x.actualSha256) || (x.expectedSize===x.actualSize && x.expectedSha256===x.actualSha256)) return reject();
    changed.push({path:x.path,expectedSize:x.expectedSize,actualSize:x.actualSize,expectedSha256:x.expectedSha256,actualSha256:x.actualSha256});
  }
  if (changed.reduce((n,x)=>n+x.expectedSize,0) > DEFAULT_ZIP_LIMITS.maxTotalBytes ||
    changed.reduce((n,x)=>n+x.actualSize,0) > DEFAULT_ZIP_LIMITS.maxTotalBytes) return reject();
  // Copy before the first await; later caller changes cannot rewrite report facts.
  const body = {schema:"replikrazy-comparison-report" as const,schemaVersion:1 as const,artifactId:artifact as Digest,liveVerified:false as const,
    verdict: c.changed.length || c.missing.length || c.extra.length ? "differs" as const : "identical" as const,
    counts:{matching:c.matching.length,changed:c.changed.length,missing:c.missing.length,extra:c.extra.length},
    changed:changed.sort((a,b)=>compareUtf8(a.path,b.path)),missing:[...c.missing].sort(compareUtf8),extra:[...c.extra].sort(compareUtf8)};
  try {return {ok:true,value:{...body,reportId:`sha256:${await sha256Hex(canonicalBytes(body))}`}};}
  catch {return {ok:false,error:{code:"MK_INTERNAL",messageKey:"consumer.report-unavailable",params:{},retry:"after-user-action"}};}
}

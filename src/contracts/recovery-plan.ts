// Read-only validation of the existing manual-plan subset of MK-CTR-005.
// Unsupported direct/cost/release modes are retained, never reinterpreted.
import type { ArtifactHandle } from "./artifact-handle";
import { isUtc } from "./artifact-handle";
import { canonicalBytes } from "./canonical";
import { isDiagnostic, isId, isRecord, isUInt, type ErrorCode, type Result } from "./diagnostic";
import { USE_CATEGORIES } from "./intended-use";
import { validatePath } from "../core/paths";
import { sha256Hex } from "../core/inventory";
import { array, digest, oneOf, publicUrl, record, text } from "./record-fields";
const reject = (code: ErrorCode): Result<Record<string, unknown>> => ({ ok: false, error: { code, messageKey: "record.plan-unapplied", params: {}, retry: "after-user-action" } });
const evidence = (x: unknown) => typeof x === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(x);
function dependency(x: unknown) {
  return record(x, ["urlPattern", "role", "discovery", "required"]) && text(x.urlPattern, 2048)
    && oneOf(x.role, ["script", "style", "font", "image", "api", "worker", "navigation", "unknown"])
    && oneOf(x.discovery, ["literal", "owner-declared", "heuristic"]) && oneOf(x.required, ["yes", "no", "unknown"]);
}
export async function validateRecoveryPlan(x: unknown, artifacts: ReadonlyMap<string, ArtifactHandle>): Promise<Result<Record<string, unknown>>> {
  if (isRecord(x) && typeof x.schemaVersion === "string" && x.schemaVersion !== "1.0") return reject("MK_SCHEMA_UNSUPPORTED");
  if (!record(x, ["schemaVersion", "planId", "artifactId", "intendedUse", "destinations", "createdAt", "expiresAt", "policyVersion", "catalogDigests"])
    || x.schemaVersion !== "1.0" || !digest(x.planId) || !digest(x.artifactId) || !artifacts.has(x.artifactId)
    || !isUtc(x.createdAt) || !isUtc(x.expiresAt) || x.expiresAt <= x.createdAt || !text(x.policyVersion, 200)
    || !array(x.catalogDigests, 200_000, digest)) return reject("MK_RECORD_CORRUPT");
  const use = x.intendedUse;
  if (isRecord(use) && use.containsPrivateData === true) return reject("MK_PRIVATE_DATA");
  if (!record(use, ["category", "containsPrivateData", "ownerHasRights", "description"], ["country"])
    || !oneOf(use.category, USE_CATEGORIES) || use.containsPrivateData !== false || typeof use.ownerHasRights !== "boolean" || !text(use.description)
    || (Object.hasOwn(use, "country") && (typeof use.country !== "string" || !/^[A-Z]{2}$/.test(use.country)))) return reject("MK_RECORD_CORRUPT");
  if (Array.isArray(x.destinations) && x.destinations.length > 16) return reject("MK_LIMIT_EXCEEDED");
  if (!array(x.destinations, 16, isRecord)) return reject("MK_RECORD_CORRUPT");
  const paths = artifacts.get(x.artifactId)!.manifest.files.map((f) => f.path);
  const targets = new Set<string>();
  for (const target of x.destinations) {
    if (!record(target, ["destination", "mode", "manifestId", "publicFiles", "limitsSnapshot", "costSnapshot", "requiredScopes", "externalDependencies", "operations", "diagnostics", "rollbackStrategy", "backupConfirmed"], ["priorRelease"])) return reject("MK_RECORD_CORRUPT");
    if (target.mode === "qualified-browser-api" || Object.hasOwn(target, "priorRelease")) return reject("MK_CAPABILITY_UNSUPPORTED");
    if (!oneOf(target.mode, ["manual", "disabled"]) || target.manifestId !== x.artifactId || !Array.isArray(target.publicFiles)
      || target.publicFiles.length !== paths.length || !paths.every((p, n) => target.publicFiles instanceof Array && target.publicFiles[n] === p)
      || typeof target.backupConfirmed !== "boolean" || !oneOf(target.rollbackStrategy, ["manual-republish", "none"])) return reject("MK_RECORD_CORRUPT");
    const d = target.destination;
    if (!record(d, ["targetId", "siteLabel", "pathPrefix", "createResource"], ["accountLabel", "accountOpaqueId", "siteOpaqueId", "publicBase"])
      || !isId(d.targetId) || targets.has(d.targetId) || !text(d.siteLabel, 200) || typeof d.createResource !== "boolean"
      || typeof d.pathPrefix !== "string" || (d.pathPrefix !== "" && !validatePath(d.pathPrefix).ok)
      || (Object.hasOwn(d, "publicBase") && !publicUrl(d.publicBase))) return reject("MK_RECORD_CORRUPT");
    for (const key of ["accountLabel", "accountOpaqueId", "siteOpaqueId"]) if (Object.hasOwn(d, key) && !text(d[key], key === "accountLabel" ? 200 : 512)) return reject("MK_RECORD_CORRUPT");
    targets.add(d.targetId);
    const l = target.limitsSnapshot;
    const numeric = ["maxFileBytes", "maxArtifactBytes", "maxFiles", "maxPathUtf8Bytes"];
    if (!record(l, ["bandwidthDescription", "quotaScope", "overage", "unknownFields"], numeric) || !text(l.bandwidthDescription)
      || !oneOf(l.quotaScope, ["account", "project", "site", "unknown"]) || !oneOf(l.overage, ["block", "pause", "bill", "contact", "unknown"])
      || !array(l.unknownFields, 200_000, (v) => text(v, 200)) || numeric.some((key) => Object.hasOwn(l, key) && !isUInt(l[key]))) return reject("MK_RECORD_CORRUPT");
    const cost = target.costSnapshot;
    if (isRecord(cost) && cost.status === "known") return reject("MK_CAPABILITY_UNSUPPORTED");
    if (!record(cost, ["status", "sourceRefs", "notes", "paidActionRequired"]) || cost.status !== "unknown"
      || !array(cost.sourceRefs, 200_000, evidence) || !text(cost.notes) || typeof cost.paidActionRequired !== "boolean") return reject("MK_RECORD_CORRUPT");
    if ((Array.isArray(target.requiredScopes) && target.requiredScopes.length > 32) || (Array.isArray(target.operations) && target.operations.length > 256)) return reject("MK_LIMIT_EXCEEDED");
    if (!array(target.requiredScopes, 32, (v) => text(v, 200)) || !array(target.externalDependencies, 10_000, dependency)
      || !array(target.diagnostics, 10_000, isDiagnostic) || !array(target.operations, 256, isRecord)) return reject("MK_RECORD_CORRUPT");
    const actions = new Set<string>();
    for (const a of target.operations) {
      if (!record(a, ["id", "kind", "description", "remoteMutation", "irreversible", "costMayAccrue"]) || !isId(a.id) || actions.has(a.id)
        || !text(a.description) || typeof a.remoteMutation !== "boolean" || typeof a.irreversible !== "boolean" || typeof a.costMayAccrue !== "boolean") return reject("MK_RECORD_CORRUPT");
      if (!oneOf(a.kind, ["manual-handoff", "verify"]) || a.remoteMutation || a.irreversible) return reject("MK_CAPABILITY_UNSUPPORTED");
      actions.add(a.id);
    }
  }
  const { planId, ...body } = x;
  try { if (`sha256:${await sha256Hex(canonicalBytes(body))}` !== planId) return reject("MK_HASH_MISMATCH"); }
  catch { return reject("MK_INTERNAL"); }
  return { ok: true, value: x };
}

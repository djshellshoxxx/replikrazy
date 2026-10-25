// Contract-shaped PublishPlan for the manual route (research MK-CTR-005).
// Every TargetPlan is "manual" or "disabled": no destination has a qualified
// browser API, so no operation here mutates anything remotely. planId hashes
// the canonical plan without planId, binding it to the artifact, intended use,
// catalogue snapshot and per-target facts.

import { sha256Hex } from "../core/inventory";
import type { DryRunPlan } from "../core/plan";
import type { CompatibilityScan } from "../core/scan";
import { CATALOGUE } from "../providers/catalogue";
import type { ProviderAdapter } from "../providers/types";
import { canonicalBytes } from "./canonical";
import type { IntendedUse } from "./intended-use";
import type { ArtifactManifest, Digest } from "./manifest";

export const POLICY_VERSION = "replikrazy-policy-0.1";
// Proposed plan lifetime: provider facts are dated, so plans go stale.
export const PLAN_TTL_MS = 24 * 60 * 60 * 1000;

import { isDiagnostic, type Diagnostic, type ErrorCode, type Severity } from "./diagnostic";
import { contractDependencies, type ExternalDependency } from "./scan-report";

export interface TargetPlan {
  destination: { targetId: string; siteLabel: string; pathPrefix: string; createResource: boolean };
  mode: "manual" | "disabled";
  manifestId: Digest;
  publicFiles: string[];
  limitsSnapshot: {
    maxFileBytes?: number;
    maxFiles?: number;
    bandwidthDescription: string;
    quotaScope: "unknown";
    overage: "unknown";
    unknownFields: string[];
  };
  costSnapshot: { status: "unknown"; sourceRefs: string[]; notes: string; paidActionRequired: boolean };
  requiredScopes: string[];
  externalDependencies: ExternalDependency[];
  operations: { id: string; kind: "manual-handoff" | "verify"; description: string; remoteMutation: false; irreversible: false; costMayAccrue: boolean }[];
  diagnostics: Diagnostic[];
  rollbackStrategy: "manual-republish";
  backupConfirmed: boolean;
}

export interface PublishPlan {
  schemaVersion: "1.0";
  planId: Digest;
  artifactId: Digest;
  intendedUse: IntendedUse;
  destinations: TargetPlan[];
  createdAt: string;
  expiresAt: string;
  policyVersion: string;
  catalogDigests: Digest[];
}

const sha = async (v: unknown): Promise<Digest> => `sha256:${await sha256Hex(canonicalBytes(v))}`;

// Contract Utc: YYYY-MM-DDTHH:mm:ss.sssZ (toISOString already has this form).
const utc = (ms: number) => new Date(ms).toISOString();

export const catalogueDigest = () => sha(CATALOGUE);

function diagnostics(a: DryRunPlan["destinations"][number]["assessment"]): Diagnostic[] {
  const mk = (severity: Severity, certainty: Diagnostic["certainty"], code: ErrorCode, text: string, i: number): Diagnostic => ({
    id: `${a.providerId}.${i}`,
    requirementId: "MK-POL-002",
    severity,
    certainty,
    code,
    messageKey: code.toLowerCase(),
    params: { text },
    remediationKey: severity === "blocker" ? "fix-upstream-or-choose-another-target" : "review-before-upload",
  });
  let i = 0;
  return [
    ...a.blockers.map((t) => mk("blocker", "definite", "MK_POLICY_BLOCKED", t, i++)),
    ...a.warnings.map((t) => mk("warning", "heuristic", "MK_CAPABILITY_UNSUPPORTED", t, i++)),
    ...a.unknowns.map((t) => mk("warning", "unknown", "MK_ELIGIBILITY_UNKNOWN", t, i++)),
  ];
}

function targetPlan(p: ProviderAdapter, d: DryRunPlan["destinations"][number], m: ArtifactManifest, artifactId: Digest, scan: CompatibilityScan | undefined, backupConfirmed: boolean): TargetPlan {
  const unknownFields = ["maxArtifactBytes", "maxPathUtf8Bytes", "bandwidth", "quotaScope", "overage"];
  if (p.maxFileBytes.value === null) unknownFields.push("maxFileBytes");
  if (p.maxFiles.value === null) unknownFields.push("maxFiles");
  return {
    destination: { targetId: p.id, siteLabel: m.appId, pathPrefix: "", createResource: false },
    mode: d.status === "blocked" ? "disabled" : "manual",
    manifestId: artifactId,
    // Exactly the manifest's files: never an undisclosed subset.
    publicFiles: m.files.map((f) => f.path),
    limitsSnapshot: {
      ...(p.maxFileBytes.value !== null ? { maxFileBytes: p.maxFileBytes.value } : {}),
      ...(p.maxFiles.value !== null ? { maxFiles: p.maxFiles.value } : {}),
      bandwidthDescription: "not verified",
      quotaScope: "unknown",
      overage: "unknown",
      unknownFields,
    },
    costSnapshot: { status: "unknown", sourceRefs: [], notes: "cost not verified; check the provider's current plan before uploading", paidActionRequired: false },
    requiredScopes: [],
    externalDependencies: scan ? contractDependencies(scan) : [],
    operations: [
      { id: "handoff", kind: "manual-handoff", description: "Owner uploads app/ using the provider's own site and account", remoteMutation: false, irreversible: false, costMayAccrue: true },
      { id: "verify", kind: "verify", description: "Owner opens the published site and checks pages and features", remoteMutation: false, irreversible: false, costMayAccrue: false },
    ],
    diagnostics: diagnostics(d.assessment),
    rollbackStrategy: "manual-republish",
    backupConfirmed,
  };
}

export async function buildPublishPlan(
  manifest: ArtifactManifest,
  artifactId: Digest,
  use: IntendedUse,
  dry: DryRunPlan,
  providers: readonly ProviderAdapter[],
  scan: CompatibilityScan | undefined,
  nowMs: number,
  backupConfirmed = false,
): Promise<PublishPlan> {
  const destinations = dry.destinations
    .filter((d) => d.status !== "skipped")
    .map((d) => targetPlan(providers.find((p) => p.id === d.providerId)!, d, manifest, artifactId, scan, backupConfirmed));
  if (destinations.some((d) => !d.diagnostics.every(isDiagnostic))) throw new Error("invalid plan diagnostic");
  const body = {
    schemaVersion: "1.0" as const,
    artifactId,
    intendedUse: use,
    destinations,
    createdAt: utc(nowMs),
    expiresAt: utc(nowMs + PLAN_TTL_MS),
    policyVersion: POLICY_VERSION,
    catalogDigests: [await catalogueDigest()],
  };
  return { ...body, planId: await sha(body) };
}

export async function verifyPlanId(plan: PublishPlan): Promise<boolean> {
  const { planId, ...body } = plan;
  return planId === (await sha(body));
}

export const isExpired = (plan: PublishPlan, nowMs: number) => Date.parse(plan.expiresAt) <= nowMs;

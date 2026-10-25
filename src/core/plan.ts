// Dry-run plan: per-destination status that only the user advances. Nothing
// here contacts a host; "uploaded"/"verified" are the user's own attestations.

import { assess, type Assessment } from "../providers/select";
import type { ProviderAdapter } from "../providers/types";
import type { BundleFacts } from "./analyze";
import type { IntendedUse } from "../contracts/intended-use";
import type { ScanReport } from "./scan";

export type DestinationStatus =
  | "blocked" // incompatible bundle, or bundle has errors
  | "needs-review" // unknown limits/support; user must check provider docs
  | "ready-for-manual-export"
  | "uploaded-by-user"
  | "verified-by-user"
  | "skipped";

export interface Destination {
  providerId: string;
  status: DestinationStatus;
  // Status implied by the assessment; "skipped" can only be undone to this.
  baseStatus: DestinationStatus;
  assessment: Assessment;
}

export interface DryRunPlan {
  // Contract artifactId ("sha256:…" of the canonical ArtifactManifest).
  artifactId: string;
  destinations: Destination[];
}

export function initialStatus(a: Assessment, bundleHasErrors: boolean): DestinationStatus {
  if (bundleHasErrors || a.verdict === "incompatible") return "blocked";
  return a.verdict === "unknown" ? "needs-review" : "ready-for-manual-export";
}

export function buildPlan(
  artifactId: string,
  facts: BundleFacts,
  bundleHasErrors: boolean,
  providers: readonly ProviderAdapter[],
  scan?: ScanReport,
  use?: IntendedUse,
): DryRunPlan {
  return {
    artifactId,
    destinations: providers.map((p) => {
      const assessment = assess(p, facts, scan, use);
      const base = initialStatus(assessment, bundleHasErrors);
      return { providerId: p.id, status: base, baseStatus: base, assessment };
    }),
  };
}

// Allowed user transitions. A blocked destination can only be skipped: the fix
// is to change the bundle, which produces a new digest and a new plan.
const NEXT: Record<DestinationStatus, DestinationStatus[]> = {
  blocked: ["skipped"],
  "needs-review": ["ready-for-manual-export", "skipped"],
  "ready-for-manual-export": ["uploaded-by-user", "skipped"],
  "uploaded-by-user": ["verified-by-user", "ready-for-manual-export"],
  "verified-by-user": ["ready-for-manual-export"],
  skipped: [],
};

export function allowedTransitions(d: Destination): readonly DestinationStatus[] {
  return d.status === "skipped" ? [d.baseStatus] : NEXT[d.status];
}

export function transition(plan: DryRunPlan, providerId: string, to: DestinationStatus): DryRunPlan {
  return {
    ...plan,
    destinations: plan.destinations.map((d) => {
      if (d.providerId !== providerId) return d;
      if (d.status === "skipped" && to === d.baseStatus) return { ...d, status: to };
      if (!NEXT[d.status].includes(to)) throw new Error(`invalid transition ${d.status} -> ${to}`);
      return { ...d, status: to };
    }),
  };
}

// Storage is optional, untrusted convenience data. Restore only exact known
// user attestations along currently allowed transitions; never turn unknown
// values into a request to advance every step, or weaken a fresh assessment.
export function restorePlanStatuses(plan: DryRunPlan, saved: unknown): DryRunPlan {
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return plan;
  let restored = plan;
  for (const d of plan.destinations) {
    if (!Object.prototype.hasOwnProperty.call(saved, d.providerId)) continue;
    const want: unknown = (saved as Record<string, unknown>)[d.providerId];
    if (!["needs-review", "ready-for-manual-export", "uploaded-by-user", "verified-by-user", "skipped"].includes(want as string)) continue;
    let current = restored.destinations.find((x) => x.providerId === d.providerId)!;
    if (want === "skipped") {
      if (allowedTransitions(current).includes("skipped")) restored = transition(restored, d.providerId, "skipped");
      continue;
    }
    const progression = ["needs-review", "ready-for-manual-export", "uploaded-by-user", "verified-by-user"] as const;
    const target = progression.indexOf(want as typeof progression[number]);
    let at = progression.indexOf(current.status as typeof progression[number]);
    // Blocked/skipped and already-later states cannot be advanced by a stale
    // saved attestation. Start from the current state, not the first step.
    while (at >= 0 && at < target) {
      const next = progression[at + 1]!;
      if (!allowedTransitions(current).includes(next)) break;
      restored = transition(restored, d.providerId, next);
      current = restored.destinations.find((x) => x.providerId === d.providerId)!;
      at++;
    }
  }
  return restored;
}

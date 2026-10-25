// Dry-run plan: per-destination status that only the user advances. Nothing
// here contacts a host; "uploaded"/"verified" are the user's own attestations.

import { assess, type Assessment } from "../providers/select";
import type { ProviderAdapter } from "../providers/types";
import type { BundleFacts } from "./analyze";
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
): DryRunPlan {
  return {
    artifactId,
    destinations: providers.map((p) => {
      const assessment = assess(p, facts, scan);
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

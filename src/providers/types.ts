// Provider adapters are pure data plus manual instructions. No adapter in this
// milestone performs network calls or accepts credentials.

// Evidence ladder, weakest first. "unsupported" is a positive finding that an
// action cannot be done, not "unknown".
//  - unreviewed: seeded from general knowledge; not yet reconciled with the
//    MirrorKit research or provider docs.
//  - researched-lead: appears in the MirrorKit research; not confirmed.
//  - documented: confirmed in the provider's current official docs (cite URL).
//  - tested: exercised end-to-end by this project with a synthetic site.
export type Evidence = "unreviewed" | "researched-lead" | "documented" | "tested" | "unsupported";

export const EVIDENCE_RANK: Record<Exclude<Evidence, "unsupported">, number> = {
  unreviewed: 0,
  "researched-lead": 1,
  documented: 2,
  tested: 3,
};

export interface Claim<T> {
  value: T | null; // null = not known
  evidence: Evidence;
  note?: string;
}

export type ProviderKind = "static-host" | "git-pages" | "content-addressed" | "self-hosted-anonymity" | "self-hosted";

export type MethodId = "manual-web-upload" | "cli" | "git-push" | "self-host";

export interface PublishMethod {
  id: MethodId;
  evidence: Evidence;
  summary: string;
}

export interface ProviderAdapter {
  id: string;
  name: string;
  kind: ProviderKind;
  homepage: string | null;
  methods: PublishMethod[];
  // Deploying straight from this browser app to the provider. The research
  // does not qualify any such route, so every adapter must mark it
  // "unsupported" until a route is documented AND tested.
  browserDirectDeploy: Claim<boolean>;
  requiresAccount: Claim<boolean>;
  customDomain: Claim<boolean>;
  redirectsFile: Claim<boolean>; // honours a _redirects file
  headersFile: Claim<boolean>; // honours a _headers file
  runsServerCode: Claim<boolean>;
  maxFileBytes: Claim<number>;
  maxFiles: Claim<number>;
  prerequisites: string[];
  manualSteps: string[];
  caveats: string[];
}

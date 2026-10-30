import { claim, noBrowserDeploy, unknown } from "../claims";
import type { ProviderAdapter } from "../types";

// Evidence: unreviewed — seeded from general knowledge, pending reconciliation
// with the MirrorKit research and the provider's current docs.
export const adapter: ProviderAdapter = {
  id: "ipfs",
  name: "IPFS (self-pinned)",
  kind: "content-addressed",
  homepage: "https://docs.ipfs.tech/",
  browserDirectDeploy: noBrowserDeploy,
  methods: [
    { id: "cli", evidence: "unreviewed", summary: "Add the app/ folder with an IPFS node you run and pin it." },
    { id: "self-host", evidence: "unreviewed", summary: "Desktop IPFS node with folder import." },
  ],
  requiresAccount: claim(false, "unreviewed", "a pinning service would require one; self-pinning does not"),
  customDomain: claim(true, "unreviewed", "via DNSLink, which needs DNS you control"),
  redirectsFile: claim(true, "unreviewed", "some gateways honour _redirects; not universal"),
  headersFile: claim(false, "unreviewed"),
  runsServerCode: claim(false, "unreviewed"),
  serverExecutablePaths: [],
  spaFallback: unknown("gateway-dependent"),
  defaultUrlNested: claim(true, "unreviewed", "path gateways serve under /ipfs/<cid>/; subdomain gateways and DNSLink serve at the root"),
  maxFileBytes: unknown(),
  maxFiles: unknown(),
  prerequisites: [
    "An IPFS node you run (desktop app or daemon) that stays online, or a pinning service you choose",
    "Understanding that published content is public and effectively permanent once others pin it",
  ],
  manualSteps: [
    "Unzip the export.",
    "Add the app/ folder recursively with your IPFS node and note the root CID.",
    "Pin the CID on at least one node that stays online.",
    "Open the CID through a gateway or your node and compare files against mirrorkit-control/MANIFEST.txt.",
  ],
  caveats: ["Content is only reachable while some online node has it pinned.", "IPFS is not an anonymity system; node addresses are visible to peers."],
};

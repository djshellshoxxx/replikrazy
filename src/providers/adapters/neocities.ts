import { claim, noBrowserDeploy, unknown } from "../claims";
import type { ProviderAdapter } from "../types";

// Evidence: unreviewed — seeded from general knowledge, pending reconciliation
// with the MirrorKit research and the provider's current docs.
export const adapter: ProviderAdapter = {
  id: "neocities",
  name: "Neocities",
  kind: "static-host",
  homepage: "https://neocities.org/",
  browserDirectDeploy: noBrowserDeploy,
  methods: [{ id: "manual-web-upload", evidence: "unreviewed", summary: "Upload files through the site dashboard." }],
  requiresAccount: claim(true, "unreviewed"),
  customDomain: claim(true, "unreviewed", "reported as a paid feature"),
  redirectsFile: claim(false, "unreviewed"),
  headersFile: claim(false, "unreviewed"),
  runsServerCode: claim(false, "unreviewed"),
  serverExecutablePaths: [],
  spaFallback: unknown(),
  defaultUrlNested: claim(false, "unreviewed"),
  maxFileBytes: unknown(),
  maxFiles: unknown(),
  prerequisites: ["A Neocities account", "File types allowed by the free tier (some types are restricted)"],
  manualSteps: [
    "Open your Neocities dashboard.",
    "Upload the contents of app/, recreating folders as needed.",
    "Open your site URL and compare files against mirrorkit-control/MANIFEST.txt.",
  ],
  caveats: ["Free accounts restrict some file types; restricted files will be refused by the host."],
};

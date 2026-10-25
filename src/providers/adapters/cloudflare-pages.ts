import { claim, noBrowserDeploy, unknown } from "../claims";
import type { ProviderAdapter } from "../types";

// Evidence: unreviewed — seeded from general knowledge, pending reconciliation
// with the MirrorKit research and the provider's current docs.
export const adapter: ProviderAdapter = {
  id: "cloudflare-pages",
  name: "Cloudflare Pages",
  kind: "static-host",
  homepage: "https://pages.cloudflare.com/",
  browserDirectDeploy: noBrowserDeploy,
  methods: [
    { id: "manual-web-upload", evidence: "unreviewed", summary: "Direct upload of the site/ folder in the dashboard." },
    { id: "cli", evidence: "unreviewed", summary: "Deploy with the official CLI from your own machine." },
    { id: "git-push", evidence: "unreviewed", summary: "Connect a git repository containing site/." },
  ],
  requiresAccount: claim(true, "unreviewed"),
  customDomain: claim(true, "unreviewed"),
  redirectsFile: claim(true, "unreviewed"),
  headersFile: claim(true, "unreviewed"),
  runsServerCode: claim(false, "unreviewed", "functions exist but are out of scope; static files only"),
  maxFileBytes: unknown("a per-file limit exists; value not verified here"),
  maxFiles: unknown("a file-count limit exists; value not verified here"),
  prerequisites: ["A Cloudflare account"],
  manualSteps: [
    "Unzip the export and locate the site/ folder.",
    "Create a Pages project using direct upload and upload site/.",
    "Open the assigned URL and compare files against MANIFEST.txt.",
  ],
  caveats: ["Never paste an API token into Replikrazy; it does not accept hosting credentials."],
};

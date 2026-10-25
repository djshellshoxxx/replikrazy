import { claim, noBrowserDeploy, unknown } from "../claims";
import type { ProviderAdapter } from "../types";

// Evidence: unreviewed — seeded from general knowledge, pending reconciliation
// with the MirrorKit research and the provider's current docs.
export const adapter: ProviderAdapter = {
  id: "netlify",
  name: "Netlify",
  kind: "static-host",
  homepage: "https://www.netlify.com/",
  browserDirectDeploy: noBrowserDeploy,
  methods: [
    { id: "manual-web-upload", evidence: "unreviewed", summary: "Drag the site/ folder onto the dashboard deploy area." },
    { id: "cli", evidence: "unreviewed", summary: "Deploy with the official CLI from your own machine." },
  ],
  requiresAccount: claim(true, "unreviewed"),
  customDomain: claim(true, "unreviewed"),
  redirectsFile: claim(true, "unreviewed"),
  headersFile: claim(true, "unreviewed"),
  runsServerCode: claim(false, "unreviewed", "functions exist but are out of scope; static files only"),
  maxFileBytes: unknown(),
  maxFiles: unknown(),
  prerequisites: ["A Netlify account"],
  manualSteps: [
    "Unzip the export and locate the site/ folder.",
    "In the Netlify dashboard, create a site by uploading the site/ folder.",
    "Open the assigned URL and compare files against MANIFEST.txt.",
  ],
  caveats: ["Never paste a Netlify token into Replikrazy; it does not accept hosting credentials."],
};

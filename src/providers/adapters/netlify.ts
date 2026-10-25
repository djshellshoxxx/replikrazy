import { claim, noBrowserDeploy, unknown } from "../claims";
import type { ProviderAdapter } from "../types";

// Evidence: researched-lead claims carry the official doc URL and the date the
// MirrorKit research (v13, 2026-10-25) read it. Nothing here was tested by
// this app; no account, upload or API call was made.
const OBSERVED = "2026-10-25";
const DEPLOYS = "https://docs.netlify.com/deploy/create-deploys/";

export const adapter: ProviderAdapter = {
  id: "netlify",
  name: "Netlify",
  kind: "static-host",
  homepage: "https://www.netlify.com/",
  researchId: "netlify",
  browserDirectDeploy: noBrowserDeploy,
  methods: [
    { id: "manual-web-upload", evidence: "researched-lead", summary: "Drop the built folder (not a ZIP; extract first) onto the team's Projects page or a project's Deploys page." },
    { id: "cli", evidence: "unreviewed", summary: "Deploy with the official CLI from your own machine." },
  ],
  requiresAccount: claim(true, "researched-lead", "Netlify Drop also offers account-less deploys, but their retention is not established; use an account you own", DEPLOYS, OBSERVED),
  customDomain: claim(true, "unreviewed"),
  redirectsFile: claim(true, "unreviewed"),
  headersFile: claim(true, "unreviewed"),
  runsServerCode: claim(false, "unreviewed", "functions exist but are out of scope; static files only"),
  // No evidence that a manual folder drop executes netlify.toml or functions;
  // the scanner still warns about them.
  serverExecutablePaths: [],
  spaFallback: claim(true, "unreviewed", "via a _redirects rewrite rule"),
  defaultUrlNested: claim(false, "unreviewed"),
  maxFileBytes: unknown(),
  maxFiles: unknown("the API ZIP route documents 25,000 entries; the manual drop limit is not verified"),
  prerequisites: ["A Netlify account you control (sign in on netlify.com, never in Replikrazy)"],
  manualSteps: [
    "Unzip the export; Netlify's manual upload takes a folder, not a ZIP.",
    "Sign in to the team that should own the site.",
    "New site: drop the app/ folder onto the Projects page. Existing site: drop it at the bottom of the Deploys page.",
    "Open the assigned URL and compare files against mirrorkit-control/MANIFEST.txt.",
  ],
  caveats: [
    "Newer accounts use monthly credits; at the research date (2026-10-25) a production deploy cost 15 of 300 free credits and traffic also consumes credits. Check your account's current plan.",
    "Snippet injection and post-processing can change served HTML without a redeploy; the served page may differ from the uploaded bytes.",
    "Never paste a Netlify token into Replikrazy; it does not accept hosting credentials.",
  ],
};

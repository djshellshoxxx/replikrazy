import { claim, noBrowserDeploy, unknown } from "../claims";
import type { ProviderAdapter } from "../types";

// Evidence: researched-lead claims carry the official doc URL and the date the
// MirrorKit research (v13, 2026-10-25) read it. Nothing here was tested by
// this app; no account, upload or API call was made.
const OBSERVED = "2026-10-25";
const LIMITS = "https://developers.cloudflare.com/pages/platform/limits/";
const DIRECT_UPLOAD = "https://developers.cloudflare.com/pages/get-started/direct-upload/";

export const adapter: ProviderAdapter = {
  id: "cloudflare-pages",
  name: "Cloudflare Pages",
  kind: "static-host",
  homepage: "https://pages.cloudflare.com/",
  researchId: "cloudflare_pages",
  browserDirectDeploy: noBrowserDeploy,
  methods: [
    { id: "manual-web-upload", evidence: "researched-lead", summary: "Direct Upload: drag a folder or ZIP into a Direct Upload project in the dashboard." },
    { id: "cli", evidence: "unreviewed", summary: "Deploy with the official CLI from your own machine." },
    { id: "git-push", evidence: "unreviewed", summary: "Connect a git repository (a Direct Upload project cannot be converted to Git later)." },
  ],
  requiresAccount: claim(true, "researched-lead", undefined, DIRECT_UPLOAD, OBSERVED),
  customDomain: claim(true, "unreviewed"),
  redirectsFile: claim(true, "unreviewed"),
  headersFile: claim(true, "researched-lead", "_headers can override response headers", "https://developers.cloudflare.com/pages/configuration/headers/", OBSERVED),
  runsServerCode: claim(false, "unreviewed", "static files only in this workflow; see serverExecutablePaths"),
  serverExecutablePaths: ["_worker.js", "functions/", "_routes.json"],
  spaFallback: claim(true, "unreviewed", "reported to serve index.html for unknown paths when no top-level 404.html exists"),
  defaultUrlNested: claim(false, "unreviewed"),
  maxFileBytes: claim(25 * 1024 * 1024, "researched-lead", "25 MiB per file", LIMITS, OBSERVED),
  maxFiles: claim(1000, "researched-lead", "dashboard Direct Upload cap; the platform cap (20,000) applies to other routes", LIMITS, OBSERVED),
  prerequisites: ["A Cloudflare account you control (sign in on cloudflare.com, never in Replikrazy)"],
  manualSteps: [
    "Unzip the export and locate the app/ folder.",
    "In the Cloudflare dashboard open Workers & Pages, create an application, and choose the drag-and-drop (Direct Upload) option.",
    "Name the project and drop the contents of app/ (or a ZIP of them), then deploy.",
    "For later versions, open the project and create a new deployment (production or preview).",
    "Open the assigned URL and compare files against mirrorkit-control/MANIFEST.txt.",
  ],
  caveats: [
    "_worker.js, functions/ and _routes.json make Cloudflare run server code; bundles containing them are blocked here.",
    "Enabling Pages Web Analytics injects a script into served pages on the next deployment.",
    "A Direct Upload project cannot later be switched to Git integration.",
    "Never paste an API token into Replikrazy; it does not accept hosting credentials.",
  ],
};

import { claim, noBrowserDeploy, unknown } from "../claims";
import type { ProviderAdapter } from "../types";

// Evidence: unreviewed — seeded from general knowledge, pending reconciliation
// with the MirrorKit research and the provider's current docs.
export const adapter: ProviderAdapter = {
  id: "own-server",
  name: "Your own web server",
  kind: "self-hosted",
  homepage: null,
  browserDirectDeploy: noBrowserDeploy,
  methods: [{ id: "self-host", evidence: "unreviewed", summary: "Copy site/ to any static web server you operate." }],
  requiresAccount: claim(false, "unreviewed"),
  customDomain: claim(true, "unreviewed", "if you control DNS"),
  redirectsFile: claim(false, "unreviewed", "_redirects is a host convention; configure redirects in your server instead"),
  headersFile: claim(false, "unreviewed", "configure headers in your server instead"),
  runsServerCode: claim(false, "unreviewed", "static files only in this workflow"),
  maxFileBytes: unknown("limited only by your server"),
  maxFiles: unknown("limited only by your server"),
  prerequisites: ["A server or hosting account where you can upload files (SFTP, rsync, control panel)"],
  manualSteps: [
    "Unzip the export.",
    "Upload the contents of site/ to the web root with your own tools.",
    "Open the site and compare files against MANIFEST.txt.",
  ],
  caveats: [],
};

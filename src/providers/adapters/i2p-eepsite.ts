import { claim, noBrowserDeploy, unknown } from "../claims";
import type { ProviderAdapter } from "../types";

// Evidence: unreviewed — seeded from general knowledge, pending reconciliation
// with the MirrorKit research and the provider's current docs.
export const adapter: ProviderAdapter = {
  id: "i2p-eepsite",
  name: "I2P site (self-hosted)",
  kind: "self-hosted-anonymity",
  homepage: "https://geti2p.net/",
  browserDirectDeploy: noBrowserDeploy,
  methods: [{ id: "self-host", evidence: "unreviewed", summary: "Serve app/ from a local web server exposed through an I2P server tunnel." }],
  requiresAccount: claim(false, "unreviewed"),
  customDomain: claim(false, "unreviewed", "naming uses I2P address books / b32 addresses"),
  redirectsFile: claim(false, "unreviewed", "depends on your web server configuration"),
  headersFile: claim(false, "unreviewed", "depends on your web server configuration"),
  runsServerCode: claim(false, "unreviewed", "static files only in this workflow"),
  serverExecutablePaths: [],
  spaFallback: unknown("depends on your web server configuration"),
  defaultUrlNested: claim(false, "unreviewed"),
  maxFileBytes: unknown("limited only by your machine"),
  maxFiles: unknown("limited only by your machine"),
  prerequisites: [
    "A computer you control running an I2P router continuously (a browser tab cannot do this)",
    "A local web server bound to localhost only, serving the app/ folder",
  ],
  manualSteps: [
    "Copy the export app/ folder to the host machine.",
    "Serve it with a web server listening on 127.0.0.1 only.",
    "Create an HTTP server tunnel to that port in your I2P router per the I2P docs.",
    "Back up the tunnel keys securely offline.",
    "Open the site through an I2P-configured browser and compare files against mirrorkit-control/MANIFEST.txt.",
  ],
  caveats: ["Replikrazy cannot start, protect or monitor I2P. It provides files and a checklist only."],
};

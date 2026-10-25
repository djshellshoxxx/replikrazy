import { claim, noBrowserDeploy, unknown } from "../claims";
import type { ProviderAdapter } from "../types";

// Evidence: unreviewed — seeded from general knowledge, pending reconciliation
// with the MirrorKit research and the provider's current docs.
export const adapter: ProviderAdapter = {
  id: "tor-onion",
  name: "Tor onion service (self-hosted)",
  kind: "self-hosted-anonymity",
  homepage: "https://community.torproject.org/onion-services/",
  browserDirectDeploy: noBrowserDeploy,
  methods: [{ id: "self-host", evidence: "unreviewed", summary: "Serve site/ from a web server on a machine you control, published as an onion service by a Tor daemon." }],
  requiresAccount: claim(false, "unreviewed"),
  customDomain: claim(false, "unreviewed", "onion addresses are derived from the service key"),
  redirectsFile: claim(false, "unreviewed", "depends on your web server configuration"),
  headersFile: claim(false, "unreviewed", "depends on your web server configuration"),
  runsServerCode: claim(false, "unreviewed", "static files only in this workflow"),
  maxFileBytes: unknown("limited only by your machine"),
  maxFiles: unknown("limited only by your machine"),
  prerequisites: [
    "A computer you control that stays online (a browser tab cannot run a persistent onion service)",
    "Tor installed and running as a service on that computer",
    "A local web server bound to localhost only, serving the site/ folder",
    "Operational-security knowledge: what the server, the site files and its metadata reveal about you",
  ],
  manualSteps: [
    "Copy the export site/ folder to the host machine.",
    "Serve it with a web server listening on 127.0.0.1 only.",
    "Configure an onion service in torrc (HiddenServiceDir / HiddenServicePort pointing at that local port) per the Tor Project guide.",
    "Restart Tor, read the generated hostname, and back up the service key securely offline.",
    "Open the onion address in Tor Browser and compare files against MANIFEST.txt.",
  ],
  caveats: [
    "Replikrazy cannot start, protect or monitor Tor. It provides files and a checklist only.",
    "Imported site files may themselves leak identity (metadata, third-party resources); review them.",
  ],
};

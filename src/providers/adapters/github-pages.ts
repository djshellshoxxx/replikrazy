import { claim, noBrowserDeploy, unknown } from "../claims";
import type { ProviderAdapter } from "../types";

// Evidence: unreviewed — seeded from general knowledge, pending reconciliation
// with the MirrorKit research and the provider's current docs.
export const adapter: ProviderAdapter = {
  id: "github-pages",
  name: "GitHub Pages",
  kind: "git-pages",
  homepage: "https://pages.github.com/",
  browserDirectDeploy: noBrowserDeploy,
  methods: [
    { id: "git-push", evidence: "unreviewed", summary: "Commit the exported site/ folder to a repository and enable Pages for it." },
    { id: "manual-web-upload", evidence: "unreviewed", summary: "Upload files through the repository web UI (practical only for small sites)." },
  ],
  requiresAccount: claim(true, "unreviewed"),
  customDomain: claim(true, "unreviewed", "via a CNAME file / repository settings"),
  redirectsFile: claim(false, "unreviewed"),
  headersFile: claim(false, "unreviewed"),
  runsServerCode: claim(false, "unreviewed"),
  maxFileBytes: unknown(),
  maxFiles: unknown(),
  prerequisites: ["A GitHub account", "A repository you control (public unless your plan allows private Pages)"],
  manualSteps: [
    "Create or open the repository that will host the mirror.",
    "Copy the contents of site/ from the export into the publishing branch/folder.",
    "Commit and push from your own git client.",
    "Enable Pages in the repository settings and pick that branch/folder.",
    "Open the published URL and compare files against MANIFEST.txt.",
  ],
  caveats: ["Repository and Pages usage are subject to GitHub terms and limits; check them before publishing."],
};

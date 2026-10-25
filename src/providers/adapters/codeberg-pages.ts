import { claim, noBrowserDeploy, unknown } from "../claims";
import type { ProviderAdapter } from "../types";

// Evidence: unreviewed — seeded from general knowledge, pending reconciliation
// with the MirrorKit research and the provider's current docs.
export const adapter: ProviderAdapter = {
  id: "codeberg-pages",
  name: "Codeberg Pages",
  kind: "git-pages",
  homepage: "https://codeberg.page/",
  browserDirectDeploy: noBrowserDeploy,
  methods: [{ id: "git-push", evidence: "unreviewed", summary: "Push static files to a pages repository or branch." }],
  requiresAccount: claim(true, "unreviewed"),
  customDomain: claim(true, "unreviewed"),
  redirectsFile: unknown(),
  headersFile: unknown(),
  runsServerCode: claim(false, "unreviewed"),
  maxFileBytes: unknown(),
  maxFiles: unknown(),
  prerequisites: ["A Codeberg account", "Content compatible with Codeberg terms (free/libre projects)"],
  manualSteps: [
    "Create a repository named pages (or use a pages branch) as described in Codeberg docs.",
    "Copy the export site/ contents into it and push from your own git client.",
    "Open the published URL and compare files against MANIFEST.txt.",
  ],
  caveats: ["Codeberg is a non-profit service with content rules; check them first."],
};

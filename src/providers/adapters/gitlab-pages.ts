import { claim, noBrowserDeploy, unknown } from "../claims";
import type { ProviderAdapter } from "../types";

// Evidence: unreviewed — seeded from general knowledge, pending reconciliation
// with the MirrorKit research and the provider's current docs.
export const adapter: ProviderAdapter = {
  id: "gitlab-pages",
  name: "GitLab Pages",
  kind: "git-pages",
  homepage: "https://docs.gitlab.com/ee/user/project/pages/",
  browserDirectDeploy: noBrowserDeploy,
  methods: [{ id: "git-push", evidence: "unreviewed", summary: "Push the site with a CI job that publishes a public/ folder." }],
  requiresAccount: claim(true, "unreviewed"),
  customDomain: claim(true, "unreviewed"),
  redirectsFile: claim(true, "unreviewed", "a _redirects file is reported as supported; confirm current syntax"),
  headersFile: claim(false, "unreviewed"),
  runsServerCode: claim(false, "unreviewed"),
  serverExecutablePaths: [],
  spaFallback: claim(true, "unreviewed", "via a _redirects rewrite rule"),
  defaultUrlNested: claim(true, "unreviewed", "project sites publish under /<project>/ by default"),
  maxFileBytes: unknown(),
  maxFiles: unknown(),
  prerequisites: ["A GitLab account", "A project with CI/CD enabled"],
  manualSteps: [
    "Create a project and add the export app/ contents as public/.",
    "Add a CI job that publishes public/ as a Pages artifact (see GitLab docs).",
    "Push from your own git client and wait for the pipeline.",
    "Open the Pages URL and compare files against mirrorkit-control/MANIFEST.txt.",
  ],
  caveats: ["Publishing depends on CI minutes and project settings."],
};

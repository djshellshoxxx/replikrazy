// Synthetic contract-derived cases, not recovered T-ART-08 fixture bytes.
// Repeated placeholders cannot authenticate; no private keys are generated.
import { it, expect } from "vitest";
import { scanBundle } from "../src/core/scan";
import { buildScanReport } from "../src/contracts/scan-report";
import { analyze, factIssues } from "../src/core/analyze";
const cases = [
  ["private-key", "-----BEGIN PRIVATE KEY-----\nSYNTHETIC_NOT_A_KEY\n-----END PRIVATE KEY-----"],
  ["github-token", "ghp_" + "X".repeat(36)],
  ["slack-token", "xoxb-" + "X".repeat(24)],
  ["stripe-live-key", "sk_live_" + "X".repeat(24)],
] as const;
it.each(cases)("blocks known %s class without placing its synthetic value in reports", (kind, source) => {
  const scan = scanBundle([{path: "index.html", bytes: new TextEncoder().encode("public")}, {path:"fixture.txt", bytes:new TextEncoder().encode(source)}]);
  expect(scan.findings).toContainEqual(expect.objectContaining({code:"MK_SECRET_SUSPECTED",secretClass:kind,severity:"blocker",path:"fixture.txt"}));
  const report = buildScanReport(`sha256:${"a".repeat(64)}`, scan);
  expect(report.diagnosticCounts.blocker).toBeGreaterThan(0);
  expect(JSON.stringify(report)).not.toContain(source);
  expect(JSON.stringify(scan)).not.toContain(source);
});
it.each([".env.local", ".git/config", "backup/server.pem"])("retains and blocks known private path %s rather than silently exporting a subset", path => {
  const entries = ["index.html",path].map(path => ({path,size:1,sha256:"a".repeat(64)}));
  const facts = analyze(entries,"index.html");
  expect(facts.fileCount).toBe(2);
  expect(facts.sensitiveFiles).toContain(path);
  expect(factIssues(facts).some(i=>i.severity === "error")).toBe(true);
});

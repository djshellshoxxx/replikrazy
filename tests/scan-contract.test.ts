import { describe, expect, it } from "vitest";
import { analysisError, ERROR_CODES, isDiagnostic, isMKError } from "../src/contracts/diagnostic";
import { buildScanReport, isScanReport } from "../src/contracts/scan-report";
import { artifactId, buildManifest } from "../src/contracts/manifest";
import { canonicalBytes } from "../src/contracts/canonical";
import { buildInventory } from "../src/core/inventory";
import { scanBundle, SCAN_LIMITS } from "../src/core/scan";
import { buildExport } from "../src/core/exporter";
import { buildPlan } from "../src/core/plan";
import { analyze } from "../src/core/analyze";
import { readZip } from "../src/core/zip";
import { bytes } from "./zipcraft";
const id = `sha256:${"a".repeat(64)}` as const;
const scan = () => scanBundle([{ path: "index.html", bytes: bytes('<script src="https://cdn.example/a.js"></script>') }]);

describe("contract ScanReport", () => {
  it("exports only canonical fields bound to artifact identity, without changing payload or manifest", async () => {
    const files = [{ path: "index.html", bytes: bytes("<h1>same bytes</h1>") }];
    const inv = await buildInventory(files);
    const built = buildManifest("site", inv.entries, "index.html");
    if (!built.ok) throw new Error();
    const identity = await artifactId(built.manifest);
    const internal = scanBundle(files);
    const report = buildScanReport(identity, internal);
    expect(isScanReport(report)).toBe(true);
    expect(Object.keys(report).sort()).toEqual(["artifactId", "diagnostics", "diagnosticCounts", "diagnosticsTruncated", "dependencies", "fileMetadata", "hints", "scannerVersion"].sort());
    expect(Object.keys(report.hints).sort()).toEqual(["assetBase", "routing", "serviceWorker", "externalDependenciesComplete"].sort());
    const plan = buildPlan(identity, analyze(inv.entries), false, []);
    const output = readZip(buildExport(files, inv, built.manifest, plan, [], internal));
    expect(output.entries.find((e) => e.name === "mirrorkit-control/scan.json")!.bytes).toEqual(canonicalBytes(report));
    expect(output.entries.find((e) => e.name === "app/index.html")!.bytes).toEqual(files[0]!.bytes);
    expect(await artifactId(built.manifest)).toBe(identity);
    expect(report.fileMetadata).toEqual([]); // no extension-only MIME assertion
  });
  it("keeps complete counts, deterministic warning and blocker summary after detail overflow", () => {
    const files = Array.from({ length: 5000 }, (_, i) => ({ path: `f${i}.html`, bytes: bytes('<base href="/"><meta http-equiv="content-security-policy">') }));
    const secret = "gh" + "p_" + "a".repeat(36);
    files.push({ path: "z.js", bytes: bytes(secret) });
    const internal = scanBundle(files);
    expect(internal.diagnosticCounts).toEqual({ info: 5001, warning: 5000, blocker: 1, total: 10002 });
    const report = buildScanReport(id, internal);
    expect(report.diagnostics).toHaveLength(SCAN_LIMITS.maxFindings);
    expect(report.diagnosticCounts).toEqual({ info: 5001, warning: 5001, blocker: 2, total: 10004 });
    expect(report.diagnostics.slice(-2).map((d) => [d.id, d.severity])).toEqual([["scan.truncation-warning", "warning"], ["scan.truncation-blocker", "blocker"]]);
    expect(report.diagnostics.at(-1)!.params).toEqual({ detectedBlockers: 1 });
    expect(buildScanReport(id, internal)).toEqual(report);
    expect(JSON.stringify(report)).not.toContain(secret);
    expect(isScanReport(report)).toBe(true);
  });
  it("uses allowed diagnostic codes and retains only secret class/path, never values or raw prose", () => {
    const secret = "gh" + "p_" + "b".repeat(36);
    const internal = scanBundle([{ path: "secret.js", bytes: bytes(secret) }]);
    internal.findings[0]!.message = `private source: ${secret}`;
    const report = buildScanReport(id, internal);
    expect(report.diagnostics.every(isDiagnostic)).toBe(true);
    expect(report.diagnostics.every((d) => ERROR_CODES.includes(d.code))).toBe(true);
    expect(report.diagnostics[0]).toMatchObject({ code: "MK_SECRET_SUSPECTED", messageKey: "scan.secret-suspected", path: "secret.js", params: { kind: "github-token" } });
    expect(JSON.stringify(report)).not.toContain(secret);
    expect(JSON.stringify(report)).not.toContain("private source");
  });
  it("preserves multiple dependency roles, maps media conservatively and removes URL credentials", () => {
    const internal = scanBundle([{ path: "index.html", bytes: bytes('<script src="https://private-user:private-password@cdn.example/a.js"></script><link rel="stylesheet" href="https://cdn.example/a.css"><video src="https://cdn.example/a.mp4"></video>') }]);
    const report = buildScanReport(id, internal);
    expect(report.dependencies.map((d) => d.role).sort()).toEqual(["script", "style", "unknown"]);
    expect(report.dependencies.every((d) => d.urlPattern === "https://cdn.example" && d.required === "unknown")).toBe(true);
    expect(JSON.stringify(internal)).not.toContain("private-password");
    expect(JSON.stringify(report)).not.toContain("private-user");
  });
  it("rejects unknown fields, invalid enums/paths/counters, nulls and unsupported diagnostic codes", () => {
    const report = buildScanReport(id, scan());
    for (const value of [
      { ...report, schemaVersion: "2.0" }, { ...report, artifactId: "not-a-digest" },
      { ...report, diagnosticCounts: { ...report.diagnosticCounts, total: 0 } },
      { ...report, hints: { ...report.hints, externalDependenciesComplete: true } },
      { ...report, diagnostics: [{ ...report.diagnostics[0], code: "MK_EXTERNAL_DEPENDENCY" }] },
      { ...report, diagnostics: [{ ...report.diagnostics[0], path: null }] },
      { ...report, diagnostics: [{ ...report.diagnostics[0], path: "../bad" }] },
      { ...report, diagnostics: [{ ...report.diagnostics[0], params: { raw: "x".repeat(2001) } }] },
      { ...report, diagnostics: [{ ...report.diagnostics[0], params: { count: -1 } }] },
      { ...report, diagnostics: [{ ...report.diagnostics[0], params: { raw: "\ud800" } }] },
      { ...report, dependencies: [{ ...report.dependencies[0], role: "media" }] },
    ]) expect(isScanReport(value)).toBe(false);
  });
});

describe("local typed errors", () => {
  it("maps lifecycle failures to exact safe shared error records", () => {
    for (const reason of ["cancelled", "timeout", "unavailable", "changed", "failed"] as const) {
      const error = analysisError(reason);
      expect(isMKError(error)).toBe(true);
      expect(error.params).toEqual({});
      expect(error.retry).toBe("after-user-action");
    }
    expect(analysisError("cancelled").code).toBe("MK_CANCELLED");
    expect(isMKError({ ...analysisError("failed"), rawException: "private text" })).toBe(false);
    expect(isMKError({ ...analysisError("failed"), safeDetail: null })).toBe(false);
  });
});

it("bounds overlong dependency origins before the contract/export boundary", () => {
  const internal = scanBundle([{ path: "index.html", bytes: bytes(`<script src="https://${"a".repeat(2200)}.example/x.js"></script>`) }]);
  expect(internal.truncated).toBe(true);
  const report = buildScanReport(id, internal);
  expect(report.dependencies).toEqual([]);
  expect(report.diagnosticCounts.blocker).toBeGreaterThan(0);
});

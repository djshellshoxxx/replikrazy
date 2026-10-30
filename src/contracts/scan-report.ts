// MK-CTR-003 scan sidecar. Internal heuristic labels are not ErrorCode values.
// This boundary emits only shared fields and safe keys, never raw scan prose.
import { SCAN_LIMITS, type CompatibilityScan, type Finding } from "../core/scan";
import { validatePath } from "../core/paths";
import type { Digest } from "./manifest";
import { boundedText, exactKeys, isDiagnostic, isRecord, isUInt, type Diagnostic, type ErrorCode } from "./diagnostic";

export interface ExternalDependency {
  urlPattern: string;
  role: "script" | "style" | "font" | "image" | "api" | "worker" | "navigation" | "unknown";
  discovery: "literal" | "owner-declared" | "heuristic";
  required: "yes" | "no" | "unknown";
}
export interface ScanReport {
  artifactId: Digest;
  diagnostics: Diagnostic[];
  diagnosticCounts: { info: number; warning: number; blocker: number; total: number };
  diagnosticsTruncated: boolean;
  dependencies: ExternalDependency[];
  fileMetadata: { path: string; mediaType: string; executableHint: boolean }[];
  hints: Pick<CompatibilityScan["hints"], "assetBase" | "routing" | "serviceWorker" | "externalDependenciesComplete">;
  scannerVersion: string;
}
const MAPPING: Record<string, { code: ErrorCode; key: string; requirement: string }> = {
  MK_SOURCE_MAP: { code: "MK_PRIVATE_DATA", key: "source-map", requirement: "MK-ART-005" },
  MK_SECRET_SUSPECTED: { code: "MK_SECRET_SUSPECTED", key: "secret-suspected", requirement: "MK-ART-005" },
  MK_NESTED_ARCHIVE: { code: "MK_ENTRY_UNSUPPORTED", key: "nested-archive", requirement: "MK-ART-003" },
  MK_REF_ESCAPES_ROOT: { code: "MK_PATH_INVALID", key: "reference-escapes-root", requirement: "MK-ART-004" },
  MK_MISSING_ASSET: { code: "MK_VERIFY_MISMATCH", key: "missing-asset", requirement: "MK-ART-004" },
  MK_SCAN_INCOMPLETE: { code: "MK_VERIFY_UNREADABLE", key: "inspection-incomplete", requirement: "MK-ART-004" },
  ...Object.fromEntries(["WASM_MIME", "BASE_TAG", "META_CSP", "PROVIDER_RESERVED", "SERVICE_WORKER", "HISTORY_ROUTING", "ORIGIN_STORAGE", "REALTIME_BACKEND", "EXTERNAL_DEPENDENCY"].map((name) => [
    `MK_${name}`, { code: "MK_CAPABILITY_UNSUPPORTED" as const, key: name.toLowerCase().replaceAll("_", "-"), requirement: "MK-ART-004" },
  ])),
};

export function scanDiagnostic(f: Finding, i: number): Diagnostic {
  const rule = MAPPING[f.code];
  if (!rule) throw new Error("unmapped internal scan finding");
  // Provider directory markers are hints, not RelPath file values. Never
  // silently rewrite them to make them fit the shared path field.
  return {
    id: `scan.${i}`, requirementId: rule.requirement, severity: f.severity, certainty: f.certainty,
    code: rule.code, ...(f.path && boundedText(f.path, 240) && validatePath(f.path).ok ? { path: f.path } : {}),
    messageKey: `scan.${rule.key}`, params: f.code === "MK_SECRET_SUSPECTED" && ["private-key", "aws-access-key-id", "github-token", "slack-token", "stripe-live-key", "google-api-key"].includes(f.secretClass ?? "") ? { kind: f.secretClass! } : {},
    remediationKey: f.severity === "blocker" ? "scan.remove-private-material" : "scan.review-before-upload",
  };
}

export function contractDependencies(scan: CompatibilityScan): ExternalDependency[] {
  return scan.dependencies.flatMap((d) => [...new Set(d.roles.map((role) => role === "media" ? "unknown" : role))].sort().map((role) => ({
    urlPattern: d.origin, role, discovery: "literal" as const, required: "unknown" as const,
  })));
}

export function buildScanReport(artifactId: Digest, scan: CompatibilityScan): ScanReport {
  const counts = { ...scan.diagnosticCounts };
  const diagnostics = scan.findings.slice(0, scan.truncated ? SCAN_LIMITS.maxFindings - 2 : SCAN_LIMITS.maxFindings).map(scanDiagnostic);
  if (scan.truncated) {
    // Reserve deterministic warning + blocking summary details inside the cap.
    // Complete underlying counts include findings whose details were discarded.
    diagnostics.push(
      { id: "scan.truncation-warning", requirementId: "MK-CTR-003", severity: "warning", certainty: "definite", code: "MK_LIMIT_EXCEEDED", messageKey: "scan.details-truncated", params: { findings: counts.total }, remediationKey: "scan.reduce-bundle" },
      { id: "scan.truncation-blocker", requirementId: "MK-CTR-003", severity: "blocker", certainty: "definite", code: "MK_LIMIT_EXCEEDED", messageKey: "scan.planning-stopped", params: { detectedBlockers: counts.blocker }, remediationKey: "scan.reduce-bundle" },
    );
    counts.warning++; counts.blocker++; counts.total += 2;
  }
  const { assetBase, routing, serviceWorker, externalDependenciesComplete } = scan.hints;
  const report: ScanReport = {
    artifactId, diagnostics, diagnosticCounts: counts, diagnosticsTruncated: scan.truncated,
    dependencies: contractDependencies(scan),
    // No MIME/content validator is implemented. Empty metadata avoids certifying
    // types or executability from an extension alone.
    fileMetadata: [], hints: { assetBase, routing, serviceWorker, externalDependenciesComplete },
    scannerVersion: "replikrazy-heuristic-0.2",
  };
  if (!isScanReport(report)) throw new Error("invalid generated scan report");
  return report;
}

export function isScanReport(x: unknown): x is ScanReport {
  if (!isRecord(x) || !exactKeys(x, ["artifactId", "diagnostics", "diagnosticCounts", "diagnosticsTruncated", "dependencies", "fileMetadata", "hints", "scannerVersion"])) return false;
  if (typeof x.artifactId !== "string" || !/^sha256:[0-9a-f]{64}$/.test(x.artifactId) || !boundedText(x.scannerVersion, 200) || !x.scannerVersion.length) return false;
  if (!Array.isArray(x.diagnostics) || x.diagnostics.length > SCAN_LIMITS.maxFindings || !x.diagnostics.every(isDiagnostic)) return false;
  if (new Set(x.diagnostics.map((d) => d.id)).size !== x.diagnostics.length) return false;
  const c = x.diagnosticCounts;
  if (!isRecord(c) || !exactKeys(c, ["info", "warning", "blocker", "total"]) || !Object.values(c).every(isUInt)) return false;
  const counts = c as ScanReport["diagnosticCounts"];
  if (counts.info + counts.warning + counts.blocker !== counts.total || !isUInt(counts.total) || typeof x.diagnosticsTruncated !== "boolean") return false;
  for (const severity of ["info", "warning", "blocker"] as const) {
    const displayed = x.diagnostics.filter((d) => d.severity === severity).length;
    if (displayed > counts[severity] || (!x.diagnosticsTruncated && displayed !== counts[severity])) return false;
  }
  if (x.diagnosticsTruncated && !x.diagnostics.some((d) => d.severity === "warning")) return false;
  if (x.diagnosticsTruncated && counts.blocker > 0 && !x.diagnostics.some((d) => d.severity === "blocker")) return false;
  const h = x.hints;
  if (!isRecord(h) || !exactKeys(h, ["assetBase", "routing", "serviceWorker", "externalDependenciesComplete"]) || h.externalDependenciesComplete !== false
    || !["relative", "root", "mixed", "unknown"].includes(h.assetBase as string) || !["documents", "hash", "history", "unknown"].includes(h.routing as string) || !["present", "absent", "unknown"].includes(h.serviceWorker as string)) return false;
  if (!Array.isArray(x.dependencies) || x.dependencies.length > SCAN_LIMITS.maxDependencyReferences || !x.dependencies.every((d) => isRecord(d) && exactKeys(d, ["urlPattern", "role", "discovery", "required"])
    && boundedText(d.urlPattern, 2048) && ["script", "style", "font", "image", "api", "worker", "navigation", "unknown"].includes(d.role as string)
    && ["literal", "owner-declared", "heuristic"].includes(d.discovery as string) && ["yes", "no", "unknown"].includes(d.required as string))) return false;
  return Array.isArray(x.fileMetadata) && x.fileMetadata.length <= 10_000 && x.fileMetadata.every((f) => isRecord(f) && exactKeys(f, ["path", "mediaType", "executableHint"])
    && boundedText(f.path, 240) && validatePath(f.path).ok && typeof f.mediaType === "string" && /^[\x20-\x7e]{1,127}$/.test(f.mediaType) && typeof f.executableHint === "boolean");
}

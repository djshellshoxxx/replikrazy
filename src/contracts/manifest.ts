// ArtifactManifest and artifactId (research MK-CTR-001/003/008).
// The manifest has no timestamps, so the same files + appId + entrypoint
// always give the same artifactId, whatever the container (folder or ZIP),
// entry order, compression or ZIP timestamps were.

import { sha256Hex } from "../core/inventory";
import { compareUtf8, findCaseCollisions, findFileDirConflicts, validatePath } from "../core/paths";
import { canonicalBytes } from "./canonical";
import { DEFAULT_ZIP_LIMITS } from "../core/zip";

export interface ArtifactFile {
  path: string;
  size: number;
  sha256: string;
}

export interface ArtifactManifest {
  schemaVersion: "1.0";
  appId: string;
  files: ArtifactFile[];
  entrypoint: string;
}

export type Digest = `sha256:${string}`;

export const ID_RE = /^[a-z0-9][a-z0-9._-]{0,79}$/;
const SHA256_RE = /^[0-9a-f]{64}$/;

export type ManifestResult = { ok: true; manifest: ArtifactManifest } | { ok: false; errors: string[] };

export function buildManifest(appId: string, files: readonly ArtifactFile[], entrypoint: string): ManifestResult {
  const manifest: ArtifactManifest = {
    schemaVersion: "1.0",
    appId,
    files: [...files].map(({ path, size, sha256 }) => ({ path, size, sha256 })).sort((a, b) => compareUtf8(a.path, b.path)),
    entrypoint,
  };
  const errors = validateManifest(manifest);
  return errors.length ? { ok: false, errors } : { ok: true, manifest };
}

const plainRecord = (x: unknown): x is Record<string, unknown> =>
  x !== null && typeof x === "object" && !Array.isArray(x)
  && (Object.getPrototypeOf(x) === Object.prototype || Object.getPrototypeOf(x) === null);

// Validates a manifest from any source (including a re-imported export).
export function validateManifest(m: unknown): string[] {
  const errors: string[] = [];
  if (!plainRecord(m)) return ["manifest is not a plain object"];
  const r = m as Record<string, unknown>;
  if (!["schemaVersion", "appId", "files", "entrypoint"].every((k) => Object.hasOwn(r, k))) errors.push("manifest fields must be own properties");
  const extra = Object.keys(r).filter((k) => !["schemaVersion", "appId", "files", "entrypoint"].includes(k));
  if (extra.length) errors.push(`unknown fields: ${extra.join(", ")}`);
  if (r.schemaVersion !== "1.0") errors.push("unsupported schemaVersion");
  if (typeof r.appId !== "string" || !ID_RE.test(r.appId)) errors.push("appId must match [a-z0-9][a-z0-9._-]{0,79}");
  if (!Array.isArray(r.files) || r.files.length === 0) {
    errors.push("files must be a non-empty array");
    return errors;
  }
  if (r.files.length > DEFAULT_ZIP_LIMITS.maxEntries) return [...errors, "files exceed intake count limit"];
  const seen = new Set<string>();
  let prev: string | null = null;
  for (const f of r.files as unknown[]) {
    const x = f as Record<string, unknown>;
    if (!plainRecord(x) || Object.keys(x).length !== 3 || !["path", "size", "sha256"].every((k) => Object.hasOwn(x, k))) { errors.push("file record must have exactly path, size, sha256"); continue; }
    if (typeof x.path !== "string" || !validatePath(x.path).ok) { errors.push(`invalid path: ${String(x.path)}`); continue; }
    if (!Number.isSafeInteger(x.size) || (x.size as number) < 0) errors.push(`invalid size for ${x.path}`);
    if (typeof x.sha256 !== "string" || !SHA256_RE.test(x.sha256)) errors.push(`invalid sha256 for ${x.path}`);
    if (seen.has(x.path)) errors.push(`duplicate path: ${x.path}`);
    if (prev !== null && compareUtf8(prev, x.path) >= 0) errors.push("files are not sorted by UTF-8 byte order");
    seen.add(x.path);
    prev = x.path;
  }
  const paths = [...seen];
  if (findCaseCollisions(paths).length) errors.push("paths collide under intake case folding");
  if (findFileDirConflicts(paths).length) errors.push("path is both a file and a folder");
  if (typeof r.entrypoint !== "string" || !seen.has(r.entrypoint)) errors.push("entrypoint must name one file in the manifest");
  else if (!/\.x?html?$/i.test(r.entrypoint)) errors.push("entrypoint must be an HTML file");
  return errors;
}

export async function artifactId(m: ArtifactManifest): Promise<Digest> {
  // Type annotations do not validate imported/runtime values. Canonical hashes
  // identify admitted manifests only, never silently reinterpreted schemas.
  if (validateManifest(m).length) throw new Error("invalid artifact manifest");
  return `sha256:${await sha256Hex(canonicalBytes(m))}`;
}

// Default entrypoint: root index.html, else root index.htm; otherwise the
// owner must choose one explicitly (no guessing among several HTML files).
export function defaultEntrypoint(paths: readonly string[]): string | null {
  if (paths.includes("index.html")) return "index.html";
  if (paths.includes("index.htm")) return "index.htm";
  return null;
}

export const htmlCandidates = (paths: readonly string[]) => paths.filter((p) => /\.x?html?$/i.test(p));

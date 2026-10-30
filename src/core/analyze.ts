// Static-site facts derived from names and sizes only. Analysis never parses
// or executes imported HTML/JS; contents are treated as opaque bytes.

import { defaultEntrypoint } from "../contracts/manifest";
import type { InventoryEntry } from "./inventory";

export interface BundleFacts {
  fileCount: number;
  totalBytes: number;
  largestFileBytes: number;
  hasRootIndex: boolean;
  // Owner-selected entry page (defaults to root index.html); null = none chosen.
  entrypoint: string | null;
  has404Page: boolean;
  hasRedirectsFile: boolean;
  hasHeadersFile: boolean;
  hasCnameFile: boolean;
  serverSideFiles: string[];
  sensitiveFiles: string[];
  hiddenFiles: string[];
}

const SERVER_SIDE = /\.(php\d?|phtml|py|rb|pl|cgi|asp|aspx|jsp|cfm)$/i;
// Names that commonly hold credentials or private history. Publishing these to
// a public mirror is almost always a mistake.
const SENSITIVE = [
  /(^|\/)\.env(\..*)?$/i,
  /(^|\/)\.git(\/|$)/,
  /(^|\/)\.htpasswd$/i,
  /(^|\/)id_(rsa|dsa|ecdsa|ed25519)$/,
  /\.(pem|key|p12|pfx|kdbx)$/i,
  /(^|\/)\.npmrc$/,
];

export function analyze(entries: readonly InventoryEntry[], entrypoint?: string | null): BundleFacts {
  const paths = entries.map((e) => e.path);
  const entry = entrypoint === undefined ? defaultEntrypoint(paths) : entrypoint && paths.includes(entrypoint) ? entrypoint : null;
  return {
    fileCount: entries.length,
    totalBytes: entries.reduce((n, e) => n + e.size, 0),
    largestFileBytes: entries.reduce((n, e) => Math.max(n, e.size), 0),
    hasRootIndex: paths.includes("index.html") || paths.includes("index.htm"),
    entrypoint: entry,
    has404Page: paths.includes("404.html"),
    hasRedirectsFile: paths.includes("_redirects"),
    hasHeadersFile: paths.includes("_headers"),
    hasCnameFile: paths.includes("CNAME"),
    serverSideFiles: paths.filter((p) => SERVER_SIDE.test(p)),
    sensitiveFiles: paths.filter((p) => SENSITIVE.some((r) => r.test(p))),
    hiddenFiles: paths.filter((p) => p.split("/").some((s) => s.startsWith("."))),
  };
}

export interface FactIssue {
  severity: "error" | "warning";
  message: string;
}

export function factIssues(f: BundleFacts): FactIssue[] {
  const out: FactIssue[] = [];
  if (!f.entrypoint) out.push({ severity: "error", message: "no entry page: there is no root index.html, so choose the site's entry HTML file" });
  else if (!f.hasRootIndex)
    out.push({ severity: "warning", message: `hosts serve index.html at "/"; without one, visitors must open ${f.entrypoint} directly (rename upstream to change this)` });
  if (f.sensitiveFiles.length)
    out.push({ severity: "error", message: `possible secrets or private files: ${f.sensitiveFiles.join(", ")} — remove them before mirroring` });
  if (f.serverSideFiles.length)
    out.push({ severity: "warning", message: `server-side source files will not run on static hosts and may be served as readable text: ${f.serverSideFiles.join(", ")}` });
  if (f.hiddenFiles.length)
    out.push({ severity: "warning", message: `hidden files may be ignored or rejected by hosts: ${f.hiddenFiles.join(", ")}` });
  return out;
}

// Functional-compatibility scan (research MK-ART-004/005, MK-POL-002,
// T-ART-07/08/10). Bundle files are decoded as text and matched with bounded
// regexes ONLY: nothing is parsed into a DOM, imported, fetched or executed.
//
// The point is to tell the owner what a byte-identical copy will NOT carry
// over: missing assets, external services, routing that needs host rewrites,
// origin-bound storage, service workers, host-executed control files and
// suspected secrets. Static inspection is always incomplete (constructed URLs
// are invisible), so `externalDependenciesComplete` is always false.

import type { BundleFile } from "./intake";

export type Severity = "info" | "warning" | "blocker";
export type Certainty = "definite" | "heuristic" | "unknown";

export interface Finding {
  code: string;
  severity: Severity;
  certainty: Certainty;
  path?: string;
  message: string;
  secretClass?: string;
}

export type DepRole = "script" | "style" | "font" | "image" | "media" | "api" | "worker" | "navigation" | "unknown";

export interface ExternalDependency {
  origin: string; // scheme://host[:port], never fetched
  roles: DepRole[];
  files: string[];
  discovery: "literal";
}

export interface MissingRef {
  from: string;
  ref: string;
  resolved: string;
}

export interface CompatibilityHints {
  assetBase: "relative" | "root" | "mixed" | "unknown";
  routing: "documents" | "hash" | "history" | "unknown";
  serviceWorker: "present" | "absent" | "unknown";
  usesOriginStorage: boolean;
  usesRealtime: boolean;
  hasBaseTag: boolean;
  externalDependenciesComplete: false;
}

export interface CompatibilityScan {
  diagnosticCounts: { info: number; warning: number; blocker: number; total: number };
  hints: CompatibilityHints;
  dependencies: ExternalDependency[];
  missing: MissingRef[];
  findings: Finding[];
  reservedPaths: string[]; // provider-reserved executable/control paths present
  skipped: string[]; // text files too large to scan
  truncated: boolean;
}

export const SCAN_LIMITS = {
  maxTextBytes: 2 * 1024 * 1024,
  maxRefsPerFile: 5000,
  maxFindings: 10_000,
  maxDependencyReferences: 10_000,
} as const;

const TEXT_EXT = /\.(html?|xhtml|css|m?js|cjs|json|webmanifest|svg|txt|xml|map)$/i;
const HTML_EXT = /\.(html?|xhtml)$/i;
const CSS_EXT = /\.css$/i;
const JS_EXT = /\.(m?js|cjs)$/i;

// Paths a host may treat as instructions or server code rather than files.
// Which provider executes which is declared per adapter (serverExecutablePaths).
export const RESERVED_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /^_worker\.js(\/|$)/, label: "_worker.js" },
  { re: /^functions\//, label: "functions/" },
  { re: /^_routes\.json$/, label: "_routes.json" },
  { re: /^netlify\.toml$/, label: "netlify.toml" },
  { re: /^netlify\/(functions|edge-functions)\//, label: "netlify/functions/" },
  { re: /^vercel\.json$/, label: "vercel.json" },
];

// Content patterns that indicate live credentials. Only the class and path are
// ever reported; the matched value is never stored or displayed (T-ART-08).
const SECRET_PATTERNS: { re: RegExp; label: string; severity: Severity; kind: string }[] = [
  { kind: "private-key", re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED |PGP )?PRIVATE KEY( BLOCK)?-----/, label: "private key block", severity: "blocker" },
  { kind: "aws-access-key-id", re: /\bAKIA[0-9A-Z]{16}\b/, label: "AWS access key id", severity: "blocker" },
  { kind: "github-token", re: /\bgh[pousr]_[A-Za-z0-9]{36}\b/, label: "GitHub token", severity: "blocker" },
  { kind: "slack-token", re: /\bxox[abprs]-[A-Za-z0-9-]{10,}/, label: "Slack token", severity: "blocker" },
  { kind: "stripe-live-key", re: /\b[sr]k_live_[0-9A-Za-z]{20,}/, label: "Stripe live secret key", severity: "blocker" },
  // Google browser API keys are commonly public by design; review, not block.
  { kind: "google-api-key", re: /\bAIza[0-9A-Za-z_-]{35}\b/, label: "Google API key (often public; check restrictions)", severity: "warning" },
];

const decoder = new TextDecoder("utf-8", { fatal: false });

function dirOf(p: string): string {
  const i = p.lastIndexOf("/");
  return i < 0 ? "" : p.slice(0, i);
}

// Resolve a relative/root-relative URL path against the bundle. Returns null
// when it climbs above the root.
export function resolveRef(fromFile: string, ref: string): string | null {
  const base = ref.startsWith("/") ? [] : dirOf(fromFile).split("/").filter(Boolean);
  for (const seg of ref.replace(/^\/+/, "").split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") {
      if (!base.length) return null;
      base.pop();
    } else base.push(seg);
  }
  return base.join("/");
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

const IGNORED_SCHEME = /^(data|blob|javascript|mailto|tel|sms|about|geo|magnet|chrome|intent):/i;
const ABSOLUTE = /^(?:(https?|wss?|ftp):)?\/\/([^/?#\s"'`]+)/i;
// Template fragments mean the URL is constructed at runtime or at build time.
const DYNAMIC = /\$\{|\{\{|\}\}|<%|%>|^\s*\+|\+\s*$/;

interface Ref {
  url: string;
  role: DepRole;
}

function htmlRefs(text: string): Ref[] {
  const out: Ref[] = [];
  // Tag-aware enough to assign roles; still regex-only, no DOM.
  // "[^<>]" (not "[^>]") stops each attempt at the next tag, so many
  // unterminated "<a " opens cannot each scan to the end of the file. A
  // literal "<" inside a quoted attribute value hides that tag; acceptable
  // for a hinting scan.
  const tagRe = /<(script|link|img|source|video|audio|iframe|embed|object|a|form|area|track|input|image|use)\b([^<>]{0,16384})>/gi;
  for (const m of text.matchAll(tagRe)) {
    const tag = m[1]!.toLowerCase();
    const attrs = m[2]!;
    const rel = /\brel\s*=\s*["']?([^"'>\s]{1,256})/i.exec(attrs)?.[1]?.toLowerCase() ?? "";
    for (const a of attrs.matchAll(/\b(src|href|xlink:href|data|poster|action|srcset)\s*=\s*("([^"]{0,8192})"|'([^']{0,8192})'|([^\s>"']{1,2048}))/gi)) {
      const attr = a[1]!.toLowerCase();
      const value = a[3] ?? a[4] ?? a[5] ?? "";
      const role: DepRole =
        tag === "script" ? "script"
        : tag === "link" ? (rel.includes("stylesheet") ? "style" : rel.includes("preload") || rel.includes("icon") ? "unknown" : rel.includes("manifest") ? "unknown" : "navigation")
        : tag === "img" || tag === "image" || tag === "use" || (tag === "input" && attr === "src") ? "image"
        : tag === "video" || tag === "audio" || tag === "source" || tag === "track" ? "media"
        : tag === "form" ? "api"
        : tag === "iframe" || tag === "embed" || tag === "object" ? "unknown"
        : "navigation";
      if (attr === "srcset") {
        for (const part of value.split(",")) {
          const u = part.trim().split(/\s+/)[0];
          if (u) out.push({ url: u, role: "image" });
        }
      } else out.push({ url: value, role });
    }
  }
  for (const body of blocks(text, "style")) out.push(...cssRefs(body.text));
  for (const m of text.matchAll(/\bstyle\s*=\s*"([^"]{0,8192})"/gi)) out.push(...cssRefs(m[1]!));
  for (const body of blocks(text, "script")) if (!/\bsrc\s*=/i.test(body.open)) out.push(...jsRefs(body.text));
  return out;
}

// Linear scan for <tag ...>body</tag>. A lazy regex here is quadratic on
// many unclosed open tags (each one rescans to the end); with indexOf, an
// unclosed tag simply ends the search.
function* blocks(text: string, tag: string): Generator<{ open: string; text: string }> {
  const lower = text.toLowerCase();
  const openTok = `<${tag}`;
  const closeTok = `</${tag}`;
  let i = 0;
  for (;;) {
    const start = lower.indexOf(openTok, i);
    if (start < 0) return;
    const after = lower.charCodeAt(start + openTok.length);
    // Require a tag boundary: "<style>" or "<style " but not "<styles".
    if (!(after === 62 || after === 47 || after === 32 || after === 9 || after === 10 || after === 13 || after === 12)) { i = start + 1; continue; }
    const gt = lower.indexOf(">", start);
    if (gt < 0) return;
    const end = lower.indexOf(closeTok, gt + 1);
    if (end < 0) return;
    yield { open: text.slice(start, gt + 1), text: text.slice(gt + 1, end) };
    i = end + closeTok.length;
  }
}

function cssRefs(text: string): Ref[] {
  const out: Ref[] = [];
  // Bounded, and "(" excluded from unquoted URLs, so repeated "url(" without
  // a closing ")" cannot make each match attempt run to the end of the file.
  for (const m of text.matchAll(/url\(\s{0,64}(?:"([^"\n]{0,2048})"|'([^'\n]{0,2048})'|([^()"'\s]{1,2048}))\s{0,64}\)/gi)) {
    const u = m[1] ?? m[2] ?? m[3] ?? "";
    out.push({ url: u, role: /\.(woff2?|ttf|otf|eot)(\?|#|$)/i.test(u) ? "font" : "image" });
  }
  for (const m of text.matchAll(/@import\s{1,64}(?:url\(\s{0,64})?["']([^"'\n]{1,2048})["']/gi)) out.push({ url: m[1]!, role: "style" });
  return out;
}

function jsRefs(text: string): Ref[] {
  const out: Ref[] = [];
  const lit = `(?:"([^"\\n]{0,2048})"|'([^'\\n]{0,2048})'|\`([^\`$]{0,2048})\`)`;
  const val = (m: RegExpMatchArray) => m[1] ?? m[2] ?? m[3] ?? "";
  // The specifier clause must start with a non-space and is length-bounded,
  // so "import" + whitespace or many "import x" without "from" stay linear.
  for (const m of text.matchAll(new RegExp(`\\bimport\\s{0,64}(?:[\\w*{$][\\w*{}\\s,$]{0,510}?\\bfrom\\s{0,64})?${lit}`, "g"))) out.push({ url: val(m), role: "script" });
  for (const m of text.matchAll(new RegExp(`\\bimport\\s{0,64}\\(\\s{0,64}${lit}\\s{0,64}\\)`, "g"))) out.push({ url: val(m), role: "script" });
  for (const m of text.matchAll(new RegExp(`\\bnew\\s{1,64}(?:Shared)?Worker\\s{0,64}\\(\\s{0,64}${lit}`, "g"))) out.push({ url: val(m), role: "worker" });
  for (const m of text.matchAll(new RegExp(`\\bimportScripts\\s{0,64}\\(\\s{0,64}${lit}`, "g"))) out.push({ url: val(m), role: "script" });
  for (const m of text.matchAll(new RegExp(`\\b(?:fetch|EventSource|WebSocket|sendBeacon)\\s{0,64}\\(\\s{0,64}${lit}`, "g"))) out.push({ url: val(m), role: "api" });
  // Bare absolute URL literals elsewhere in code: external, role unknown
  // unless one of the patterns above already gave that exact URL a role.
  const known = new Set(out.map((r) => r.url));
  for (const m of text.matchAll(/["'`]((?:https?|wss?):\/\/[^"'`\s]{1,2048})["'`]/g)) if (!known.has(m[1]!)) out.push({ url: m[1]!, role: "unknown" });
  return out;
}

export function scanBundle(files: readonly BundleFile[]): CompatibilityScan {
  const present = new Set(files.map((f) => f.path));
  const dirs = new Set<string>();
  for (const p of present) {
    const segs = p.split("/");
    for (let i = 1; i < segs.length; i++) dirs.add(segs.slice(0, i).join("/"));
  }
  const findings: Finding[] = [];
  let truncated = false;
  const diagnosticCounts = { info: 0, warning: 0, blocker: 0, total: 0 };
  const add = (f: Finding) => {
    diagnosticCounts[f.severity]++;
    diagnosticCounts.total++;
    if (findings.length < SCAN_LIMITS.maxFindings) findings.push(f);
    else truncated = true;
  };
  const deps = new Map<string, ExternalDependency>();
  let dependencyReferences = 0;
  const missing: MissingRef[] = [];
  const skipped: string[] = [];
  let rootRefs = 0;
  let relRefs = 0;
  let history = false;
  let hash = false;
  let sw = false;
  let storage = false;
  let realtime = false;
  let baseTag = false;

  const reservedPaths = [...new Set(
    files.map((f) => RESERVED_PATTERNS.find((r) => r.re.test(f.path))?.label).filter((x): x is string => !!x),
  )];

  for (const f of files) {
    if (/\.map$/i.test(f.path))
      add({ code: "MK_SOURCE_MAP", severity: "warning", certainty: "definite", path: f.path, message: "source map can disclose original source code and comments" });
    if (/\.wasm$/i.test(f.path))
      add({ code: "MK_WASM_MIME", severity: "info", certainty: "heuristic", path: f.path, message: "WebAssembly needs the host to serve application/wasm for streaming compilation" });
    if (/\.(zip|tar|tgz|gz|7z|rar)$/i.test(f.path))
      add({ code: "MK_NESTED_ARCHIVE", severity: "info", certainty: "definite", path: f.path, message: "nested archive is kept as an opaque file and not unpacked" });

    if (f.bytes.length > SCAN_LIMITS.maxTextBytes) {
      if (TEXT_EXT.test(f.path)) skipped.push(f.path);
      continue;
    }
    const text = decoder.decode(f.bytes);

    for (const s of SECRET_PATTERNS) {
      if (s.re.test(text))
        add({ code: "MK_SECRET_SUSPECTED", secretClass: s.kind, severity: s.severity, certainty: "heuristic", path: f.path, message: `possible ${s.label} in file contents (value not shown)` });
    }
    if (!TEXT_EXT.test(f.path) || /\.map$/i.test(f.path)) continue;

    const isHtml = HTML_EXT.test(f.path);
    const isJs = JS_EXT.test(f.path) || isHtml;
    if (isHtml && /<base\b[^<>]{0,4096}\bhref\s*=/i.test(text)) {
      baseTag = true;
      add({ code: "MK_BASE_TAG", severity: "warning", certainty: "definite", path: f.path, message: "<base href> changes how every relative URL resolves; check it matches the mirror's URL" });
    }
    if (isHtml && /<meta\b[^<>]{0,4096}http-equiv\s*=\s*["']?content-security-policy/i.test(text))
      add({ code: "MK_META_CSP", severity: "info", certainty: "definite", path: f.path, message: "page sets its own CSP; origins it allows must still be reachable from the mirror" });
    if (isJs) {
      if (/\bnavigator\.serviceWorker\.register\s*\(/.test(text)) sw = true;
      if (/\bhistory\.(pushState|replaceState)\s*\(|createBrowserRouter|createWebHistory|BrowserRouter|mode:\s*["']history["']/.test(text)) history = true;
      if (/createHashRouter|createWebHashHistory|HashRouter|location\.hash|["'`]#\//.test(text)) hash = true;
      if (/\b(localStorage|sessionStorage|indexedDB|document\.cookie|caches\.open)\b/.test(text)) storage = true;
      if (/\bnew\s+(WebSocket|EventSource|RTCPeerConnection)\b/.test(text)) realtime = true;
    }

    const allRefs = isHtml ? htmlRefs(text) : CSS_EXT.test(f.path) ? cssRefs(text) : JS_EXT.test(f.path) ? jsRefs(text) : [];
    if (allRefs.length > SCAN_LIMITS.maxRefsPerFile) truncated = true;
    const refs = allRefs.slice(0, SCAN_LIMITS.maxRefsPerFile);
    for (const { url: raw, role } of refs) {
      const url = raw.trim();
      if (!url || url.startsWith("#") || url.startsWith("?") || IGNORED_SCHEME.test(url) || DYNAMIC.test(url)) continue;
      const abs = ABSOLUTE.exec(url);
      if (abs) {
        const scheme = (abs[1] ?? "https").toLowerCase();
        let origin: string;
        try { origin = new URL(`${scheme}://${abs[2]!}`).origin; } catch { continue; }
        if (origin.length > 2048) { truncated = true; continue; }
        const existing = deps.get(origin);
        if ((!existing?.files.includes(f.path) || !existing?.roles.includes(role)) && dependencyReferences >= SCAN_LIMITS.maxDependencyReferences) {
          truncated = true;
          continue;
        }
        const d = existing ?? { origin, roles: [], files: [], discovery: "literal" as const };
        if (!d.roles.includes(role) || !d.files.includes(f.path)) dependencyReferences++;
        if (!d.roles.includes(role)) d.roles.push(role);
        if (!d.files.includes(f.path)) d.files.push(f.path);
        deps.set(origin, d);
        if (scheme === "ws" || scheme === "wss") realtime = true;
        continue;
      }
      if (/^[a-z][a-z0-9+.-]*:/i.test(url)) continue; // other schemes: not a file reference
      // Bare specifiers ("react") in JS are resolved by a bundler/import map, not the host.
      if (JS_EXT.test(f.path) && role === "script" && !/^\.{0,2}\//.test(url)) continue;
      const pathPart = safeDecode(url.split(/[?#]/)[0]!);
      if (!pathPart) continue;
      if (url.startsWith("/")) rootRefs++;
      else relRefs++;
      const resolved = resolveRef(f.path, pathPart);
      if (resolved === null) {
        add({ code: "MK_REF_ESCAPES_ROOT", severity: "warning", certainty: "definite", path: f.path, message: `reference climbs above the site root: ${url}` });
        continue;
      }
      const ok =
        resolved === "" ? present.has("index.html")
        : pathPart.endsWith("/") ? present.has(`${resolved}/index.html`)
        : present.has(resolved) || (dirs.has(resolved) && present.has(`${resolved}/index.html`)) || present.has(`${resolved}.html`);
      if (!ok) {
        if (missing.length < SCAN_LIMITS.maxFindings) missing.push({ from: f.path, ref: url, resolved: resolved || "/" });
        else truncated = true;
      }
    }
  }

  for (const r of reservedPaths)
    add({ code: "MK_PROVIDER_RESERVED", severity: "warning", certainty: "definite", path: r, message: `"${r}" is a control/server path on some hosts; destinations that would execute it are blocked` });
  if (sw)
    add({ code: "MK_SERVICE_WORKER", severity: "warning", certainty: "heuristic", message: "registers a service worker: its scope and caches are tied to each mirror's origin and path" });
  if (history)
    add({ code: "MK_HISTORY_ROUTING", severity: "warning", certainty: "heuristic", message: "uses history-API routing: deep links and reloads need a host fallback to index.html, otherwise they 404" });
  if (storage)
    add({ code: "MK_ORIGIN_STORAGE", severity: "warning", certainty: "heuristic", message: "uses browser storage (localStorage/IndexedDB/cookies/cache): each mirror origin starts empty and data does not move between mirrors" });
  if (realtime)
    add({ code: "MK_REALTIME_BACKEND", severity: "warning", certainty: "heuristic", message: "opens WebSocket/EventSource/WebRTC connections: the backend is not mirrored and must stay reachable" });
  if (deps.size)
    add({ code: "MK_EXTERNAL_DEPENDENCY", severity: "warning", certainty: "definite", message: `${deps.size} external origin(s) referenced: the mirror still loads them and breaks if they are blocked or gone` });
  if (missing.length)
    add({ code: "MK_MISSING_ASSET", severity: "warning", certainty: "definite", message: `${missing.length} literal reference(s) point to files not in the bundle` });
  add({ code: "MK_SCAN_INCOMPLETE", severity: "info", certainty: "unknown", message: "static inspection cannot see URLs built at runtime; this list is not complete" });

  const assetBase = rootRefs && relRefs ? "mixed" : rootRefs ? "root" : relRefs ? "relative" : "unknown";
  return {
    diagnosticCounts,
    hints: {
      assetBase,
      routing: history ? "history" : hash ? "hash" : files.some((f) => HTML_EXT.test(f.path)) ? "documents" : "unknown",
      serviceWorker: sw ? "present" : skipped.length ? "unknown" : "absent",
      usesOriginStorage: storage,
      usesRealtime: realtime,
      hasBaseTag: baseTag,
      externalDependenciesComplete: false,
    },
    dependencies: [...deps.values()].sort((a, b) => (a.origin < b.origin ? -1 : 1)),
    missing,
    findings,
    reservedPaths,
    skipped,
    truncated,
  };
}

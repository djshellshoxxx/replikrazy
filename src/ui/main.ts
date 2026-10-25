// UI wiring. Invariant: imported file names/contents only ever reach the DOM
// through textContent (never innerHTML), and file contents are never rendered.

import { USE_CATEGORIES, validateIntendedUse, type IntendedUse, type UseCategory } from "../contracts/intended-use";
import { buildPublishPlan } from "../contracts/publish-plan";
import { artifactId, buildManifest, defaultEntrypoint, htmlCandidates, ID_RE, type ArtifactManifest } from "../contracts/manifest";
import { analyze, factIssues } from "../core/analyze";
import { buildExport, buildPayloadZip } from "../core/exporter";
import type { BundleFile, IntakeIssue, IntakeOptions, IntakeResult } from "../core/intake";
import { compareInventories, isIdentical } from "../core/compare";
import { runAnalysis, type AnalysisInput, type AnalysisResult, type Progress } from "../core/pipeline";
import type { Inventory } from "../core/inventory";
import { allowedTransitions, buildPlan, transition, type DryRunPlan } from "../core/plan";
import type { ScanReport } from "../core/scan";
import { DEFAULT_ZIP_LIMITS } from "../core/zip";
import { filterCatalogue, getProvider } from "../providers/catalogue";
import type { MethodId, ProviderAdapter } from "../providers/types";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, cls?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (cls) e.className = cls;
  return e;
}

interface State {
  files: BundleFile[];
  inv: Inventory | null;
  hasErrors: boolean;
  selected: Set<string>;
  plan: DryRunPlan | null;
  scan: ScanReport | null;
  // Current selection, so intake can re-run with new options (root choice)
  // without the user picking files again.
  input: AnalysisInput | null;
  stripRoot: boolean;
  intakeIssues: IntakeIssue[];
  // Owner-declared identity inputs (research MK-CTR-003); changing either
  // gives a new artifactId and invalidates any plan built for the old one.
  appId: string;
  entrypoint: string | null;
  manifest: ArtifactManifest | null;
  artifactId: string | null;
  use: IntendedUse;
  // Owner confirms a public-data review (MK-ART-005); export stays off until then.
  publicDataReviewed: boolean;
}
const state: State = {
  files: [], inv: null, hasErrors: false, selected: new Set(), plan: null, scan: null, input: null, stripRoot: false,
  intakeIssues: [], appId: "site", entrypoint: null, manifest: null, artifactId: null,
  use: { category: "public-demo", containsPrivateData: false, ownerHasRights: false, description: "" },
  publicDataReviewed: false,
};

// Per-viewer convenience only: remembers statuses for a given artifactId.
const storeKey = (digest: string) => `replikrazy.plan.${digest}`;
function savePlan() {
  if (!state.plan) return;
  try {
    const s = Object.fromEntries(state.plan.destinations.map((d) => [d.providerId, d.status]));
    localStorage.setItem(storeKey(state.plan.artifactId), JSON.stringify(s));
  } catch { /* storage unavailable: statuses simply aren't remembered */ }
}
function restoreStatuses(plan: DryRunPlan): DryRunPlan {
  let saved: Record<string, string> = {};
  try { saved = JSON.parse(localStorage.getItem(storeKey(plan.artifactId)) ?? "{}"); } catch { return plan; }
  let p = plan;
  for (const d of plan.destinations) {
    const want = saved[d.providerId];
    // Replay only along valid paths; anything else is ignored.
    for (const step of ["ready-for-manual-export", "uploaded-by-user", "verified-by-user"] as const) {
      const cur = p.destinations.find((x) => x.providerId === d.providerId)!;
      if (!want || cur.status === want) break;
      if (want === "skipped" && allowedTransitions(cur).includes("skipped")) { p = transition(p, d.providerId, "skipped"); break; }
      if (!allowedTransitions(cur).includes(step)) break;
      p = transition(p, d.providerId, step);
    }
  }
  return p;
}

const fmtBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KiB` : `${(n / 1048576).toFixed(1)} MiB`);

class Cancelled extends Error {}
let cancelActive: (() => void) | null = null;
let generation = 0;

// Runs the pipeline in a module worker so large inputs keep the page
// responsive and can be cancelled (T-ART-06). Falls back to the page thread
// where workers are unavailable.
function analyzeOffThread(input: AnalysisInput, opts: IntakeOptions, onProgress: Progress): Promise<AnalysisResult> {
  if (typeof Worker === "undefined") return runAnalysis(input, opts, onProgress);
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL("./analysis-worker.ts", import.meta.url), { type: "module" });
    const finish = () => { w.terminate(); cancelActive = null; };
    cancelActive = () => { finish(); reject(new Cancelled()); };
    w.onmessage = (ev: MessageEvent) => {
      const m = ev.data as { type: string; stage?: Parameters<Progress>[0]; done?: number; total?: number; result?: AnalysisResult };
      if (m.type === "progress") onProgress(m.stage!, m.done!, m.total!);
      else if (m.type === "done") { finish(); resolve(m.result!); }
      else { finish(); reject(new Error("analysis failed")); }
    };
    w.onerror = () => { finish(); reject(new Error("analysis failed")); };
    w.postMessage({ input, opts });
  });
}

async function loadBundle(input: AnalysisInput, stripRoot = false) {
  const status = $("intake-status");
  const cancelBtn = $("cancel-btn") as HTMLButtonElement;
  cancelActive?.();
  const gen = ++generation;
  status.textContent = "Reading…";
  cancelBtn.hidden = false;
  state.input = input;
  state.stripRoot = stripRoot;
  try {
    const { intake: r, inv, scan } = await analyzeOffThread(input, { stripRoot }, (stage, done, total) => {
      if (gen === generation) status.textContent = `${stage[0]!.toUpperCase()}${stage.slice(1)}… ${done} / ${total}`;
    });
    if (gen !== generation) return; // a newer selection replaced this one
    state.files = r.files;
    state.inv = inv;
    state.scan = scan;
    state.intakeIssues = r.issues;
    state.entrypoint = defaultEntrypoint(inv.entries.map((e) => e.path));
    state.selected.clear();
    state.plan = null;
    status.textContent = r.strippedRoot ? `Loaded with "${r.strippedRoot}/" as the site root.` : "Loaded.";
    renderRootChoice(r);
    renderCompat(state.scan);
    renderProviders();
    await refreshIdentity();
  } catch (e) {
    if (gen !== generation) return;
    // Do not echo exception text: it could contain imported names/contents.
    status.textContent = e instanceof Cancelled ? "Cancelled. Nothing was kept; select the input again to retry." : "Could not read this input.";
  } finally {
    if (gen === generation) cancelBtn.hidden = true;
  }
}

// Recomputes facts, manifest and artifactId from the current appId/entrypoint.
async function refreshIdentity() {
  if (!state.inv || !state.scan) return;
  const inv = state.inv;
  const facts = analyze(inv.entries, state.entrypoint);
  const issues: { severity: string; path?: string; message: string }[] = [...state.intakeIssues, ...factIssues(facts)];
  state.manifest = null;
  state.artifactId = null;
  if (facts.entrypoint) {
    const m = buildManifest(state.appId, inv.entries, facts.entrypoint);
    if (m.ok) {
      state.manifest = m.manifest;
      state.artifactId = await artifactId(m.manifest);
    } else issues.push(...m.errors.map((message) => ({ severity: "error", message: `manifest: ${message}` })));
  }
  // Suspected live credentials block export just like intake errors.
  state.hasErrors = !state.artifactId || issues.some((i) => i.severity === "error") || state.scan.findings.some((f) => f.severity === "blocker");
  renderIdentity(inv);
  renderInventory(inv, issues);
  rebuildPlan();
}

function renderIdentity(inv: Inventory) {
  const appIdInput = $("app-id") as HTMLInputElement;
  appIdInput.value = state.appId;
  const sel = $("entrypoint") as HTMLSelectElement;
  const candidates = htmlCandidates(inv.entries.map((e) => e.path));
  sel.replaceChildren(el("option", "— choose the entry page —"), ...candidates.map((p) => el("option", p)));
  (sel.options[0] as HTMLOptionElement).value = "";
  for (let i = 1; i < sel.options.length; i++) (sel.options[i] as HTMLOptionElement).value = candidates[i - 1]!;
  sel.value = state.entrypoint ?? "";
  $("artifact-id").textContent = state.artifactId ? `Artifact id: ${state.artifactId}` : "Artifact id: not available until the identity is valid.";
}

// Root selection is an explicit, visible choice (research T-ART-02).
function renderRootChoice(r: IntakeResult) {
  const box = $("root-choice");
  box.replaceChildren();
  if (!r.candidateRoot) return;
  const label = el("label");
  const cb = el("input");
  cb.type = "checkbox";
  cb.checked = !!r.strippedRoot;
  cb.addEventListener("change", () => { if (state.input) void loadBundle(state.input, cb.checked); });
  label.append(cb, document.createTextNode(` Use the folder "${r.candidateRoot}/" as the site root (every file is inside it)`));
  box.append(label);
}

function renderCompat(scan: ScanReport) {
  $("compat").hidden = false;
  const h = scan.hints;
  $("compat-hints").textContent =
    `Asset paths: ${h.assetBase}. Routing: ${h.routing}. Service worker: ${h.serviceWorker}. ` +
    `Browser storage: ${h.usesOriginStorage ? "used" : "not detected"}. Realtime connections: ${h.usesRealtime ? "used" : "not detected"}. ` +
    "External dependency list complete: no (static inspection only).";
  $("compat-findings").replaceChildren(
    ...scan.findings.map((f) => el("li", `${f.severity.toUpperCase()} [${f.certainty}]: ${f.message}${f.path ? ` (${f.path})` : ""}`, f.severity === "blocker" ? "error" : f.severity === "warning" ? "warning" : "")),
  );
  $("compat-deps").replaceChildren(...scan.dependencies.map((d) => el("li", `${d.origin} — ${d.roles.join(", ")} — used by ${d.files.slice(0, 5).join(", ")}${d.files.length > 5 ? ", …" : ""}`)));
  if (!scan.dependencies.length) $("compat-deps").replaceChildren(el("li", "None found by static inspection."));
  $("compat-missing").replaceChildren(...scan.missing.slice(0, 500).map((m) => el("li", `${m.from}: ${m.ref} → ${m.resolved}`)));
  if (!scan.missing.length) $("compat-missing").replaceChildren(el("li", "None found."));
}

function renderInventory(inv: Inventory, issues: { severity: string; path?: string; message: string }[]) {
  $("inventory").hidden = false;
  $("inv-summary").textContent = `${inv.entries.length} files, ${fmtBytes(inv.totalBytes)}. File-list checksum ${inv.bundleDigest}`;
  const ul = $("issues");
  ul.replaceChildren(...issues.map((i) => el("li", `${i.severity.toUpperCase()}: ${i.message}${i.path ? ` (${i.path})` : ""}`, i.severity)));
  if (!issues.length) ul.replaceChildren(el("li", "No issues found.", "okay"));
  $("inv-rows").replaceChildren(
    ...inv.entries.map((e) => {
      const tr = el("tr");
      tr.append(el("td", e.path), el("td", String(e.size)), el("td", e.sha256, "hash"));
      return tr;
    }),
  );
}

function currentFilter() {
  const method = ($("f-method") as HTMLSelectElement).value as MethodId | "";
  return {
    text: ($("f-text") as HTMLInputElement).value,
    noAccountOnly: ($("f-noacct") as HTMLInputElement).checked,
    needsCustomDomain: ($("f-domain") as HTMLInputElement).checked,
    methods: method ? [method] : undefined,
  };
}

function providerCard(p: ProviderAdapter): HTMLElement {
  const card = el("div", undefined, "card");
  const h = el("h3", p.name);
  h.append(el("span", p.kind, "badge"), el("span", "browser deploy: unsupported", "badge"));
  const label = el("label");
  const cb = el("input");
  cb.type = "checkbox";
  cb.checked = state.selected.has(p.id);
  cb.addEventListener("change", () => {
    if (cb.checked) state.selected.add(p.id); else state.selected.delete(p.id);
    rebuildPlan();
  });
  label.append(cb, document.createTextNode(" Include in dry run"));
  const methods = el("ul");
  methods.append(...p.methods.map((m) => el("li", `${m.id} [${m.evidence}]: ${m.summary}`)));
  const lim = (c: ProviderAdapter["maxFiles"]) => `${c.value ?? "unknown"} [${c.evidence}${c.observed ? `, read ${c.observed}` : ""}]`;
  card.append(
    h,
    methods,
    el("p", `Account: ${p.requiresAccount.value === null ? "unknown" : p.requiresAccount.value ? "required" : "not required"} [${p.requiresAccount.evidence}]`),
    el("p", `Max files: ${lim(p.maxFiles)}. Max file bytes: ${lim(p.maxFileBytes)}.`),
    label,
  );
  return card;
}

function renderProviders() {
  $("providers").hidden = false;
  const list = filterCatalogue(currentFilter());
  $("provider-list").replaceChildren(...(list.length ? list.map(providerCard) : [el("p", "No providers match these filters.")]));
}

function rebuildPlan() {
  if (!state.inv) return;
  const providers = [...state.selected].map((id) => getProvider(id)!).filter(Boolean);
  state.plan = providers.length
    ? restoreStatuses(buildPlan(state.artifactId ?? "none", analyze(state.inv.entries, state.entrypoint), state.hasErrors, providers, state.scan ?? undefined, state.use))
    : null;
  renderPlan();
}

function renderPlan() {
  const sec = $("plan");
  sec.hidden = !state.plan;
  if (!state.plan) return;
  const plan = state.plan;
  $("plan-list").replaceChildren(
    ...plan.destinations.map((d) => {
      const p = getProvider(d.providerId)!;
      const card = el("div", undefined, "card");
      card.append(el("h3", `${p.name} — ${d.status}`));
      const notes = el("ul");
      for (const b of d.assessment.blockers) notes.append(el("li", `blocker: ${b}`, "error"));
      for (const w of d.assessment.warnings) notes.append(el("li", `warning: ${w}`, "warning"));
      for (const u of d.assessment.unknowns) notes.append(el("li", `check provider docs: ${u}`, "warning"));
      card.append(notes);
      const steps = el("details");
      steps.append(el("summary", "Prerequisites and manual steps"));
      const pre = el("ul");
      pre.append(...p.prerequisites.map((s) => el("li", s)));
      const ol = el("ol");
      ol.append(...p.manualSteps.map((s) => el("li", s)));
      steps.append(el("p", "Prerequisites:"), pre, el("p", "Steps (you perform these outside Replikrazy):"), ol);
      if (p.caveats.length) steps.append(el("p", `Caveats: ${p.caveats.join(" ")}`));
      card.append(steps);
      for (const to of allowedTransitions(d)) {
        const b = el("button", `Mark ${to}`);
        b.type = "button";
        b.addEventListener("click", () => {
          state.plan = transition(state.plan!, d.providerId, to);
          savePlan();
          renderPlan();
        });
        card.append(b, document.createTextNode(" "));
      }
      return card;
    }),
  );
  const useErrors = validateIntendedUse(state.use);
  const gate = state.hasErrors ? "Fix the errors above first."
    : useErrors.length ? useErrors.join(" ")
    : !state.publicDataReviewed ? "Confirm the public-data review in step 5 first."
    : "";
  const anyOpen = plan.destinations.some((d) => d.status !== "blocked" && d.status !== "skipped");
  $("export-gate").textContent = gate || (anyOpen ? "" : "Every selected destination is blocked or skipped; see the blockers above.");
  const exportable = !gate && anyOpen;
  ($("export-btn") as HTMLButtonElement).disabled = !exportable;
  ($("payload-btn") as HTMLButtonElement).disabled = !!gate;
}

async function download() {
  if (!state.plan || !state.inv) return;
  const providers = state.plan.destinations.map((d) => getProvider(d.providerId)!);
  if (!state.manifest || !state.artifactId) return;
  const id = state.artifactId as `sha256:${string}`;
  const pp = await buildPublishPlan(state.manifest, id, state.use, state.plan, providers, state.scan ?? undefined, Date.now());
  saveZip(buildExport(state.files, state.inv, state.manifest, state.plan, providers, state.scan ?? undefined, pp), `replikrazy-handoff-${state.artifactId.slice(7, 19)}.zip`);
}

function downloadPayload() {
  if (!state.inv || state.hasErrors) return;
  if (!state.artifactId || !state.publicDataReviewed) return;
  saveZip(buildPayloadZip(state.files), `replikrazy-app-${state.artifactId.slice(7, 19)}.zip`);
}

function saveZip(zip: Uint8Array, name: string) {
  const url = URL.createObjectURL(new Blob([zip.slice()], { type: "application/zip" }));
  const a = el("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

$("zip-input").addEventListener("change", (ev) => {
  const f = (ev.target as HTMLInputElement).files?.[0];
  if (!f) return;
  // Refuse oversized archives from metadata, before reading them into memory.
  if (f.size > DEFAULT_ZIP_LIMITS.maxArchiveBytes) {
    $("intake-status").textContent = `Archive is larger than the ${DEFAULT_ZIP_LIMITS.maxArchiveBytes / 1048576} MiB limit.`;
    return;
  }
  void loadBundle({ kind: "zip", file: f });
});
$("dir-input").addEventListener("change", (ev) => {
  const list = (ev.target as HTMLInputElement).files;
  if (list?.length) void loadBundle({ kind: "folder", entries: [...list].map((f) => ({ path: f.webkitRelativePath, blob: f })) });
});
for (const id of ["f-text", "f-noacct", "f-domain", "f-method"]) $(id).addEventListener("input", renderProviders);
$("export-btn").addEventListener("click", () => void download());
$("cancel-btn").addEventListener("click", () => cancelActive?.());

// Compare a copy (e.g. files saved back from a mirror) with the loaded
// artifact. Offline: the user supplies the files; nothing is fetched.
async function compareCopy(input: AnalysisInput) {
  const out = $("compare-result");
  if (!state.inv) { out.textContent = "Load the original site first."; return; }
  out.textContent = "Reading the copy…";
  try {
    const progress: Progress = (stage, done, total) => { out.textContent = `Copy: ${stage} ${done} / ${total}`; };
    // A copy may or may not be wrapped in one folder; keep whichever reading
    // matches more of the original.
    const plain = await analyzeOffThread(input, { stripRoot: false }, progress);
    let best = compareInventories(state.inv.entries, plain.inv.entries);
    if (plain.intake.candidateRoot) {
      const stripped = await analyzeOffThread(input, { stripRoot: true }, progress);
      const c = compareInventories(state.inv.entries, stripped.inv.entries);
      if (c.matching.length > best.matching.length) best = c;
    }
    const list = (title: string, items: string[]) => {
      const d = el("details");
      d.append(el("summary", `${title}: ${items.length}`));
      const ul = el("ul");
      ul.append(...items.slice(0, 1000).map((t) => el("li", t)));
      d.append(ul);
      return d;
    };
    out.replaceChildren(
      el("p", isIdentical(best)
        ? "Every file matches byte for byte. This shows the copy is intact; it does not show the mirror works — open it and test it."
        : "The copy differs. Hosts can legitimately change served files (analytics, minification, injected snippets); check each difference.",
        isIdentical(best) ? "okay" : "warning"),
      list("Matching", best.matching),
      list("Changed", best.changed.map((c) => `${c.path} (expected ${c.expectedSize} bytes, got ${c.actualSize})`)),
      list("Missing from the copy", best.missing),
      list("Extra in the copy", best.extra),
    );
  } catch (e) {
    out.textContent = e instanceof Cancelled ? "Cancelled." : "Could not read the copy.";
  }
}
$("cmp-zip").addEventListener("change", (ev) => {
  const f = (ev.target as HTMLInputElement).files?.[0];
  if (f) void compareCopy({ kind: "zip", file: f });
});
$("cmp-dir").addEventListener("change", (ev) => {
  const list = (ev.target as HTMLInputElement).files;
  if (list?.length) void compareCopy({ kind: "folder", entries: [...list].map((f) => ({ path: f.webkitRelativePath, blob: f })) });
});
function readUse() {
  const country = ($("use-country") as HTMLInputElement).value.trim().toUpperCase();
  state.use = {
    category: ($("use-category") as HTMLSelectElement).value as UseCategory,
    containsPrivateData: false,
    ownerHasRights: ($("use-rights") as HTMLInputElement).checked,
    description: ($("use-description") as HTMLInputElement).value,
    ...(country ? { country } : {}),
  };
  state.publicDataReviewed = ($("use-public") as HTMLInputElement).checked;
  rebuildPlan();
}
{
  const sel = $("use-category") as HTMLSelectElement;
  sel.replaceChildren(...USE_CATEGORIES.map((c) => { const o = el("option", c); o.value = c; return o; }));
  for (const id of ["use-category", "use-rights", "use-public", "use-country", "use-description"]) $(id).addEventListener("change", readUse);
}
$("app-id").addEventListener("change", (ev) => {
  const v = (ev.target as HTMLInputElement).value.trim();
  state.appId = v;
  $("app-id-hint").textContent = ID_RE.test(v) ? "" : "Use 1–80 characters: lowercase letters, digits, dot, dash, underscore; start with a letter or digit.";
  void refreshIdentity();
});
$("entrypoint").addEventListener("change", (ev) => {
  state.entrypoint = (ev.target as HTMLSelectElement).value || null;
  void refreshIdentity();
});
$("payload-btn").addEventListener("click", downloadPayload);

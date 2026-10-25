// UI wiring. Invariant: imported file names/contents only ever reach the DOM
// through textContent (never innerHTML), and file contents are never rendered.

import { analyze, factIssues } from "../core/analyze";
import { buildExport, buildPayloadZip } from "../core/exporter";
import { intakeFolder, intakeZip, type BundleFile, type IntakeOptions, type IntakeResult } from "../core/intake";
import { buildInventory, type Inventory } from "../core/inventory";
import { allowedTransitions, buildPlan, transition, type DryRunPlan } from "../core/plan";
import { scanBundle, type ScanReport } from "../core/scan";
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
  // Re-runs intake with new options (root choice) without re-picking files.
  reload: ((opts: IntakeOptions) => Promise<IntakeResult>) | null;
  stripRoot: boolean;
}
const state: State = { files: [], inv: null, hasErrors: false, selected: new Set(), plan: null, scan: null, reload: null, stripRoot: false };

// Per-viewer convenience only: remembers statuses for a given bundle digest.
const storeKey = (digest: string) => `replikrazy.plan.${digest}`;
function savePlan() {
  if (!state.plan) return;
  try {
    const s = Object.fromEntries(state.plan.destinations.map((d) => [d.providerId, d.status]));
    localStorage.setItem(storeKey(state.plan.bundleDigest), JSON.stringify(s));
  } catch { /* storage unavailable: statuses simply aren't remembered */ }
}
function restoreStatuses(plan: DryRunPlan): DryRunPlan {
  let saved: Record<string, string> = {};
  try { saved = JSON.parse(localStorage.getItem(storeKey(plan.bundleDigest)) ?? "{}"); } catch { return plan; }
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

async function loadBundle(load: (opts: IntakeOptions) => Promise<IntakeResult>, stripRoot = false) {
  const status = $("intake-status");
  status.textContent = "Reading…";
  state.reload = load;
  state.stripRoot = stripRoot;
  try {
    const r = await load({ stripRoot });
    const inv = await buildInventory(r.files);
    const facts = analyze(inv.entries);
    const scan = scanBundle(r.files);
    const issues = [...r.issues, ...factIssues(facts)];
    state.files = r.files;
    state.inv = inv;
    state.scan = scan;
    // Suspected live credentials block export just like intake errors.
    state.hasErrors = issues.some((i) => i.severity === "error") || scan.findings.some((f) => f.severity === "blocker");
    state.selected.clear();
    state.plan = null;
    status.textContent = r.strippedRoot ? `Loaded with "${r.strippedRoot}/" as the site root.` : "Loaded.";
    renderRootChoice(r);
    renderInventory(inv, issues);
    renderCompat(scan);
    renderProviders();
    renderPlan();
  } catch {
    // Do not echo exception text: it could contain imported names/contents.
    status.textContent = "Could not read this input.";
  }
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
  cb.addEventListener("change", () => { if (state.reload) void loadBundle(state.reload, cb.checked); });
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
  $("inv-summary").textContent = `${inv.entries.length} files, ${fmtBytes(inv.totalBytes)}. Bundle digest ${inv.bundleDigest}`;
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
    ? restoreStatuses(buildPlan(state.inv.bundleDigest, analyze(state.inv.entries), state.hasErrors, providers, state.scan ?? undefined))
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
  const exportable = !state.hasErrors && plan.destinations.some((d) => d.status !== "blocked" && d.status !== "skipped");
  ($("export-btn") as HTMLButtonElement).disabled = !exportable;
  ($("payload-btn") as HTMLButtonElement).disabled = state.hasErrors;
}

function download() {
  if (!state.plan || !state.inv) return;
  const providers = state.plan.destinations.map((d) => getProvider(d.providerId)!);
  saveZip(buildExport(state.files, state.inv, state.plan, providers, state.scan ?? undefined), `replikrazy-handoff-${state.inv.bundleDigest.slice(0, 12)}.zip`);
}

function downloadPayload() {
  if (!state.inv || state.hasErrors) return;
  saveZip(buildPayloadZip(state.files), `replikrazy-app-${state.inv.bundleDigest.slice(0, 12)}.zip`);
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
  if (f.size > DEFAULT_ZIP_LIMITS.maxArchiveBytes) { $("intake-status").textContent = "Archive is larger than the 256 MiB limit."; return; }
  void loadBundle(async (opts) => intakeZip(new Uint8Array(await f.arrayBuffer()), opts));
});
$("dir-input").addEventListener("change", (ev) => {
  const list = (ev.target as HTMLInputElement).files;
  if (list?.length) void loadBundle((opts) => intakeFolder([...list], opts));
});
for (const id of ["f-text", "f-noacct", "f-domain", "f-method"]) $(id).addEventListener("input", renderProviders);
$("export-btn").addEventListener("click", download);
$("payload-btn").addEventListener("click", downloadPayload);

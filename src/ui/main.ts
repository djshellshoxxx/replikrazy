// UI wiring. Invariant: imported file names/contents only ever reach the DOM
// through textContent (never innerHTML), and file contents are never rendered.

import { analyze, factIssues } from "../core/analyze";
import { buildExport } from "../core/exporter";
import { intakeFolder, intakeZip, type BundleFile, type IntakeIssue } from "../core/intake";
import { buildInventory, type Inventory } from "../core/inventory";
import { allowedTransitions, buildPlan, transition, type DryRunPlan } from "../core/plan";
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
}
const state: State = { files: [], inv: null, hasErrors: false, selected: new Set(), plan: null };

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

async function loadBundle(load: () => Promise<{ files: BundleFile[]; issues: IntakeIssue[]; strippedRoot: string | null }>) {
  const status = $("intake-status");
  status.textContent = "Reading…";
  try {
    const r = await load();
    const inv = await buildInventory(r.files);
    const facts = analyze(inv.entries);
    const issues = [...r.issues, ...factIssues(facts)];
    state.files = r.files;
    state.inv = inv;
    state.hasErrors = issues.some((i) => i.severity === "error");
    state.selected.clear();
    state.plan = null;
    status.textContent = r.strippedRoot ? `Loaded. Wrapper folder "${r.strippedRoot}/" was removed from paths.` : "Loaded.";
    renderInventory(inv, issues);
    renderProviders();
    renderPlan();
  } catch {
    // Do not echo exception text: it could contain imported names/contents.
    status.textContent = "Could not read this input.";
  }
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
  card.append(h, methods, el("p", `Account: ${p.requiresAccount.value === null ? "unknown" : p.requiresAccount.value ? "required" : "not required"} [${p.requiresAccount.evidence}]`), label);
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
    ? restoreStatuses(buildPlan(state.inv.bundleDigest, analyze(state.inv.entries), state.hasErrors, providers))
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
}

function download() {
  if (!state.plan || !state.inv) return;
  const providers = state.plan.destinations.map((d) => getProvider(d.providerId)!);
  const zip = buildExport(state.files, state.inv, state.plan, providers);
  const url = URL.createObjectURL(new Blob([zip.slice()], { type: "application/zip" }));
  const a = el("a");
  a.href = url;
  a.download = `replikrazy-export-${state.inv.bundleDigest.slice(0, 12)}.zip`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

$("zip-input").addEventListener("change", (ev) => {
  const f = (ev.target as HTMLInputElement).files?.[0];
  if (!f) return;
  // Refuse oversized archives from metadata, before reading them into memory.
  if (f.size > DEFAULT_ZIP_LIMITS.maxArchiveBytes) { $("intake-status").textContent = "Archive is larger than the 256 MiB limit."; return; }
  void loadBundle(async () => intakeZip(new Uint8Array(await f.arrayBuffer())));
});
$("dir-input").addEventListener("change", (ev) => {
  const list = (ev.target as HTMLInputElement).files;
  if (list?.length) void loadBundle(() => intakeFolder([...list]));
});
for (const id of ["f-text", "f-noacct", "f-domain", "f-method"]) $(id).addEventListener("input", renderProviders);
$("export-btn").addEventListener("click", download);

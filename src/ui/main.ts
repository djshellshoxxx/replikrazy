import { exportArtifactRecovery } from "../contracts/recovery-export";
import { mountRecovery } from "./recovery";
// UI wiring. Invariant: imported file names/contents only ever reach the DOM
// through textContent (never innerHTML), and file contents are never rendered.

import { USE_CATEGORIES, exportUseBlockers, type IntendedUse, type UseCategory } from "../contracts/intended-use";
import { buildPublishPlan } from "../contracts/publish-plan";
import { artifactId, buildManifest, defaultEntrypoint, htmlCandidates, ID_RE, type ArtifactManifest } from "../contracts/manifest";
import { analyze, factIssues } from "../core/analyze";
import { buildExport, buildPayloadZip } from "../core/exporter";
import type { BundleFile, IntakeIssue, IntakeResult } from "../core/intake";
import { compareInventories, isIdentical, preferRootComparison } from "../core/compare";
import { validatePath } from "../core/paths";
import { type AnalysisInput, type Progress } from "../core/pipeline";
import type { Inventory } from "../core/inventory";
import { allowedTransitions, buildPlan, restorePlanStatuses, transition, type DryRunPlan } from "../core/plan";
import type { CompatibilityScan } from "../core/scan";
import { isMKError } from "../contracts/diagnostic";
import { legacyStatusKey, readStatusRecord, statusKey, writeStatusRecord } from "../core/status-record";
import { AnalysisTask } from "./analysis-task";
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
  scan: CompatibilityScan | null;
  // Current selection, so intake can re-run with new options (root choice)
  // without the user picking files again.
  input: AnalysisInput | null;
  sourceDigest: string | null;
  capturedAt: string | null;
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
  files: [], inv: null, hasErrors: false, selected: new Set(), plan: null, scan: null, input: null, sourceDigest: null, capturedAt: null, stripRoot: false,
  intakeIssues: [], appId: "site", entrypoint: null, manifest: null, artifactId: null,
  use: { category: "public-demo", containsPrivateData: false, ownerHasRights: false, description: "" },
  publicDataReviewed: false,
};

// Per-viewer convenience only; legacy bytes stay in their original key.
function savePlan() {
  if (!state.plan) return;
  try {
    const statuses = Object.fromEntries(state.plan.destinations.map((d) => [d.providerId, d.status]));
    writeStatusRecord(localStorage, state.plan.artifactId, statuses);
  } catch { /* optional storage unavailable */ }
  renderStoredStatus();
}
function restoreStatuses(plan: DryRunPlan): DryRunPlan {
  try {
    const current = localStorage.getItem(statusKey(plan.artifactId));
    const record = current !== null ? readStatusRecord(current, plan.artifactId)
      : readStatusRecord(localStorage.getItem(legacyStatusKey(plan.artifactId)), plan.artifactId, true);
    return record.statuses ? restorePlanStatuses(plan, record.statuses) : plan;
  } catch { return plan; }
}
function retainedStatus(): { key: string; raw: string } | null {
  if (!state.plan) return null;
  const id = state.plan.artifactId;
  try {
    for (const [key, legacy] of [[statusKey(id), false], [legacyStatusKey(id), true]] as const) {
      const raw = localStorage.getItem(key);
      if (raw !== null && readStatusRecord(raw, id, legacy).kind === "retained") return { key, raw };
    }
  } catch { /* optional storage unavailable */ }
  return null;
}
function renderStoredStatus() {
  const retained = retainedStatus();
  $("stored-status-notice").textContent = retained ? "Saved status data could not be applied. It remains unchanged in this browser; you can save a local copy." : "";
  $("stored-status-export").hidden = !retained;
}

const fmtBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KiB` : `${(n / 1048576).toFixed(1)} MiB`);

const workerFactory = () => new Worker(new URL("./analysis-worker.ts", import.meta.url), { type: "module" });
const intakeTask = new AnalysisTask(workerFactory);
const compareTask = new AnalysisTask(workerFactory);
let generation = 0;
let compareGeneration = 0;
let identityGeneration = 0;

function failureMessage(e: unknown): string {
  if (isMKError(e)) {
    if (e.code === "MK_ZIP_CORRUPT") return "Could not read this ZIP. Select a valid, uncorrupted archive.";
    if (e.code === "MK_INPUT_EMPTY") return "The input contains no usable files. Select a finished static site.";
    if (e.messageKey === "input.limit-exceeded") return "Input exceeds a safety limit. Select a smaller site.";
    if (e.code === "MK_INPUT_CHANGED") return "Input changed while being read. Select it again.";
    if (e.messageKey === "analysis.cancelled") return "Cancelled. Nothing was kept; select the input again to retry.";
    if (e.messageKey === "analysis.time-limit") return "Analysis exceeded the 60 second limit. Nothing was kept; try a smaller input.";
    if (e.messageKey === "analysis.worker-unavailable") return "Analysis requires Web Worker support. Nothing was kept.";
  }
  return "Could not read this input.";
}

function clearArtifact() {
  ++identityGeneration;
  ++compareGeneration;
  compareTask.cancel();
  state.files = [];
  state.intakeIssues = [];
  state.sourceDigest = null;
  state.capturedAt = null;
  state.inv = null;
  state.scan = null;
  state.manifest = null;
  state.artifactId = null;
  state.plan = null;
  state.hasErrors = true;
  state.selected.clear();
  state.publicDataReviewed = false;
  ($("use-public") as HTMLInputElement).checked = false;
  for (const id of ["inventory", "compat", "plan"]) $(id).hidden = true;
  $("root-choice").replaceChildren();
  $("compare-result").replaceChildren();
  hideCancel("compare-cancel-btn", "cmp-zip");
  $("artifact-id").textContent = "Artifact id: not available until the identity is valid.";
  ($("export-btn") as HTMLButtonElement).disabled = true;
  ($("payload-btn") as HTMLButtonElement).disabled = true;
}

// Hiding a focused cancel control must not drop keyboard focus onto the body.
// Completion never steals focus from an unrelated control.
function hideCancel(id: string, picker: string) {
  const button = $(id);
  const focused = document.activeElement === button;
  button.hidden = true;
  if (focused) $(picker).focus();
}

async function loadBundle(input: AnalysisInput, stripRoot = false, expectedSourceDigest?: string, entrypoint?: string | null) {
  const status = $("intake-status");
  const cancelBtn = $("cancel-btn") as HTMLButtonElement;
  intakeTask.cancel();
  clearArtifact();
  const gen = ++generation;
  status.textContent = "Reading…";
  cancelBtn.hidden = false;
  state.input = input;
  state.stripRoot = stripRoot;
  try {
    const analysis = await intakeTask.run(input, { stripRoot, expectedSourceDigest, requireEntrypoint: true, entrypoint }, (stage, done, total) => {
      if (gen === generation) status.textContent = `${stage[0]!.toUpperCase()}${stage.slice(1)}… ${done} / ${total}`;
    });
    if (gen !== generation) return; // a newer selection replaced this one
    if (!analysis.ok) throw analysis.error;
    if ("kind" in analysis.value) {
      const p = analysis.value;
      state.intakeIssues = p.issues;
      state.sourceDigest = expectedSourceDigest ?? null;
      state.entrypoint = entrypoint ?? defaultEntrypoint(p.entries.map(e => e.path));
      status.textContent = (p.issues.some(i => i.severity === "error") ? "Input has errors. " : "") + "Input preflight: review errors, choose a root or entry HTML page. No files have been hashed or scanned.";
      renderRootChoice({ ...p, files: [] });
      renderEntryChoices(p.entries.map(e => e.path));
      $("inventory").hidden = false;
      $("inv-summary").textContent = `${p.entries.length} files listed; not hashed.`;
      $("inv-rows").replaceChildren(...p.entries.map(e => { const tr = el("tr"); tr.append(el("td", e.path), el("td", String(e.size)), el("td", "Not hashed")); return tr; }));
      $("issues").replaceChildren(...p.issues.map(i => el("li", `${i.severity.toUpperCase()}: ${i.message}${i.path ? ` (${i.path})` : ""}`, i.severity)));
      return;
    }
    const { intake: r, inv, scan, sourceDigest } = analysis.value;
    state.files = r.files;
    state.capturedAt = new Date().toISOString();
    state.sourceDigest = r.issues.some((i) => i.severity === "error") ? null : sourceDigest;
    state.inv = inv;
    state.scan = scan;
    state.intakeIssues = r.issues;
    state.entrypoint = entrypoint ?? defaultEntrypoint(inv.entries.map((e) => e.path));
    state.selected.clear();
    state.plan = null;
    status.textContent = r.issues.some((i) => i.severity === "error") ? "Input has errors. Export is blocked; review them below." : r.strippedRoot ? `Loaded with "${r.strippedRoot}/" as the site root.` : "Loaded.";
    renderRootChoice(r);
    renderCompat(state.scan);
    renderProviders();
    await refreshIdentity();
  } catch (e) {
    if (gen !== generation) return;
    // Do not echo exception text: it could contain imported names/contents.
    state.input = null;
    status.textContent = failureMessage(e);
  } finally {
    if (gen === generation) hideCancel("cancel-btn", input.kind === "folder" ? "dir-input" : "zip-input");
  }
}

// Recomputes facts, manifest and artifactId from the current appId/entrypoint.
async function refreshIdentity() {
  if (!state.inv || !state.scan) return;
  const revision = ++identityGeneration;
  const inv = state.inv;
  const facts = analyze(inv.entries, state.entrypoint);
  const issues: { severity: string; path?: string; message: string }[] = [...state.intakeIssues, ...factIssues(facts)];
  state.manifest = null;
  state.artifactId = null;
  state.hasErrors = true;
  rebuildPlan();
  if (facts.entrypoint) {
    const m = buildManifest(state.appId, inv.entries, facts.entrypoint);
    if (m.ok) {
      const id = await artifactId(m.manifest);
      if (revision !== identityGeneration) return;
      state.manifest = m.manifest;
      state.artifactId = id;
    } else issues.push(...m.errors.map((message) => ({ severity: "error", message: `manifest: ${message}` })));
  }
  // Suspected live credentials block export just like intake errors.
  state.hasErrors = !state.artifactId || issues.some((i) => i.severity === "error") || state.scan.truncated || state.scan.findings.some((f) => f.severity === "blocker");
  renderIdentity(inv);
  renderInventory(inv, issues);
  rebuildPlan();
}

function renderIdentity(inv: Inventory) {
  const appIdInput = $("app-id") as HTMLInputElement;
  appIdInput.value = state.appId;
  renderEntryChoices(inv.entries.map(e => e.path));
  $("artifact-id").textContent = state.artifactId ? `Artifact id: ${state.artifactId}` : "Artifact id: not available until the identity is valid.";
}

function renderEntryChoices(paths: string[]) {
  const sel = $("entrypoint") as HTMLSelectElement;
  const candidates = htmlCandidates(paths);
  sel.replaceChildren(el("option", "— choose the entry page —"), ...candidates.map((p) => el("option", p)));
  (sel.options[0] as HTMLOptionElement).value = "";
  for (let i = 1; i < sel.options.length; i++) (sel.options[i] as HTMLOptionElement).value = candidates[i - 1]!;
  sel.value = state.entrypoint ?? "";
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
  cb.addEventListener("change", () => { if (state.input) void loadBundle(state.input, cb.checked, state.sourceDigest ?? undefined); });
  label.append(cb, document.createTextNode(` Use the folder "${r.candidateRoot}/" as the site root (every file is inside it)`));
  box.append(label);
}

function renderCompat(scan: CompatibilityScan) {
  $("compat").hidden = false;
  const h = scan.hints;
  $("compat-hints").textContent =
    `Asset paths: ${h.assetBase}. Routing: ${h.routing}. Service worker: ${h.serviceWorker}. ` +
    `Browser storage: ${h.usesOriginStorage ? "used" : "not detected"}. Realtime connections: ${h.usesRealtime ? "used" : "not detected"}. ` +
    "External dependency list complete: no (static inspection only). " +
    `Detected findings: ${scan.diagnosticCounts.blocker} blockers, ${scan.diagnosticCounts.warning} warnings, ${scan.diagnosticCounts.info} informational. Counts include undisplayed details.`;
  $("compat-findings").replaceChildren(
    ...(scan.truncated ? [el("li", "BLOCKER: scan output exceeded its safety limits. Reduce the bundle before export.", "error")] : []),
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
      const path = el("td", e.path);
      path.dir = "auto";
      tr.append(path, el("td", String(e.size)), el("td", e.sha256, "hash"));
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
  renderStoredStatus();
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
  const useErrors = exportUseBlockers(state.use);
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
  if (!state.plan || !state.inv || state.hasErrors || !state.publicDataReviewed || exportUseBlockers(state.use).length) return;
  if (!state.plan.destinations.some((d) => d.status !== "blocked" && d.status !== "skipped")) return;
  const plan = state.plan, inv = state.inv, use = state.use;
  const revision = identityGeneration;
  const providers = state.plan.destinations.map((d) => getProvider(d.providerId)!);
  if (!state.manifest || !state.artifactId) return;
  const id = state.artifactId as `sha256:${string}`;
  const pp = await buildPublishPlan(state.manifest, id, state.use, state.plan, providers, state.scan ?? undefined, Date.now());
  if (revision !== identityGeneration || state.plan !== plan || state.inv !== inv || state.use !== use || !state.publicDataReviewed || state.hasErrors) return;
  saveZip(buildExport(state.files, state.inv, state.manifest, state.plan, providers, state.scan ?? undefined, pp), `replikrazy-handoff-${state.artifactId.slice(7, 19)}.zip`);
}

function downloadPayload() {
  if (!state.inv || state.hasErrors) return;
  if (!state.artifactId || !state.publicDataReviewed || exportUseBlockers(state.use).length) return;
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

$("stored-status-export").addEventListener("click", () => {
  const retained = retainedStatus();
  if (!retained) return;
  // JSON escaping preserves even malformed UTF-16 source strings losslessly.
  // This is a read-only source backup, not an importable/verified record.
  const url = URL.createObjectURL(new Blob([JSON.stringify({ kind: "replikrazy-saved-source", storageKey: retained.key, source: retained.raw })], { type: "application/json" }));
  const a = el("a"); a.href = url; a.download = "replikrazy-saved-status-source.json"; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
});

function clearSelection() {
  ++generation; intakeTask.cancel(); clearArtifact();
  state.input = null; state.stripRoot = false; state.entrypoint = null;
  renderEntryChoices([]);
  hideCancel("cancel-btn", "zip-input");
  $("intake-status").textContent = "No input selected. Previous files and plans were cleared.";
}
function clearComparison() {
  ++compareGeneration; compareTask.cancel();
  hideCancel("compare-cancel-btn", "cmp-zip");
  $("compare-result").textContent = "No copy selected.";
}
$("zip-input").addEventListener("change", (ev) => {
  const f = (ev.target as HTMLInputElement).files?.[0];
  if (!f) { clearSelection(); return; }
  void loadBundle({ kind: "zip", file: f });
});
$("dir-input").addEventListener("change", (ev) => {
  const list = (ev.target as HTMLInputElement).files;
  if (list?.length) void loadBundle({ kind: "folder", entries: [...list].map((f) => ({ path: f.webkitRelativePath, blob: f })) });
  else clearSelection();
});
for (const id of ["f-text", "f-noacct", "f-domain", "f-method"]) $(id).addEventListener("input", renderProviders);
$("export-btn").addEventListener("click", () => void download());
$("cancel-btn").addEventListener("click", () => intakeTask.cancel());
// Research catalogue: loaded only when first opened.
$("research").addEventListener("toggle", async (ev) => {
  const d = ev.target as HTMLDetailsElement;
  if (!d.open || d.dataset.loaded) return;
  d.dataset.loaded = "1";
  try {
    const [{ mountResearch }, snap] = await Promise.all([import("./research"), import("../research/catalogue-snapshot.json")]);
    mountResearch($("research-body"), snap.default as Parameters<typeof mountResearch>[1]);
  } catch {
    $("research-body").textContent = "Could not load the research catalogue.";
    delete d.dataset.loaded;
  }
});

// Compare a copy (e.g. files saved back from a mirror) with the loaded
// artifact. Offline: the user supplies the files; nothing is fetched.
async function compareCopy(input: AnalysisInput) {
  const out = $("compare-result");
  if (state.intakeIssues.some((i) => i.severity === "error")) { out.textContent = "The original input has errors. Load a valid original before comparing a copy."; return; }
  if (!state.inv) { out.textContent = "Load the original site first."; return; }
  const reference = state.inv;
  const gen = ++compareGeneration;
  compareTask.cancel();
  out.textContent = "Reading the copy…";
  $("compare-cancel-btn").hidden = false;
  try {
    const progress: Progress = (stage, done, total) => { if (gen === compareGeneration) out.textContent = `Copy: ${stage} ${done} / ${total}`; };
    // Admit the payload after safe wrapper removal, just as original intake
    // does. Derive both path interpretations from this one byte snapshot:
    // a wrapper can push otherwise valid payload paths over the length limit.
    const result = await compareTask.run(input, { stripRoot: true }, progress);
    if (gen !== compareGeneration) return;
    if (!result.ok) throw result.error;
    const copy = result.value;
    if (copy.intake.issues.some((i) => i.severity === "error")) throw new Error("invalid copy");
    let best = compareInventories(reference.entries, copy.inv.entries);
    let removedRoot = copy.intake.strippedRoot;
    if (removedRoot) {
      const originalPaths = copy.inv.entries.map((e) => ({ ...e, path: `${removedRoot}/${e.path}` }));
      if (originalPaths.every((e) => validatePath(e.path).ok)) {
        const plain = compareInventories(reference.entries, originalPaths);
        if (!preferRootComparison(plain, best)) { best = plain; removedRoot = null; }
      }
    }
    const list = (title: string, items: string[]) => {
      const d = el("details");
      d.append(el("summary", `${title}: ${items.length}`));
      const ul = el("ul");
      const pageSize = 1000;
      let page = 0;
      const range = el("p");
      range.setAttribute("role", "status");
      const previous = el("button", "Previous page");
      const next = el("button", "Next page");
      previous.type = next.type = "button";
      const render = () => {
        const start = page * pageSize;
        ul.replaceChildren(...items.slice(start, start + pageSize).map((t) => {
          const item = el("li", t); item.dir = "auto"; return item;
        }));
        range.textContent = `Showing ${start + 1}–${Math.min(start + pageSize, items.length)} of ${items.length}`;
        previous.disabled = page === 0;
        next.disabled = start + pageSize >= items.length;
      };
      previous.addEventListener("click", () => {
        if (page === 0) return;
        const focused = document.activeElement === previous;
        page--; render();
        if (focused && previous.disabled) next.focus();
      });
      next.addEventListener("click", () => {
        if ((page + 1) * pageSize >= items.length) return;
        const focused = document.activeElement === next;
        page++; render();
        if (focused && next.disabled) previous.focus();
      });
      render();
      if (items.length > pageSize) d.append(range, previous, next);
      d.append(ul);
      return d;
    };
    const rootNote = el("p", removedRoot
      ? `Comparison root: removed wrapper ${removedRoot}. Original files are unchanged.`
      : "Comparison root: original copy paths (no wrapper removed).");
    rootNote.dir = "auto";
    out.replaceChildren(
      rootNote,
      el("p", isIdentical(best)
        ? "Every file matches byte for byte. This shows the copy is intact; it does not show the mirror works — open it and test it."
        : "The copy differs. Hosts can legitimately change served files (analytics, minification, injected snippets); check each difference.",
        isIdentical(best) ? "okay" : "warning"),
      list("Matching", best.matching),
      list("Changed", best.changed.map((c) => `${c.path} (expected ${c.expectedSize} bytes, got ${c.actualSize}). SHA-256 expected: ${c.expectedSha256}; actual: ${c.actualSha256}`)),
      list("Missing from the copy", best.missing),
      list("Extra in the copy", best.extra),
    );
  } catch (e) {
    if (gen === compareGeneration) out.textContent = failureMessage(e);
  } finally {
    if (gen === compareGeneration) hideCancel("compare-cancel-btn", input.kind === "folder" ? "cmp-dir" : "cmp-zip");
  }
}
$("compare-cancel-btn").addEventListener("click", () => compareTask.cancel());
$("cmp-zip").addEventListener("change", (ev) => {
  const f = (ev.target as HTMLInputElement).files?.[0];
  if (f) void compareCopy({ kind: "zip", file: f });
  else clearComparison();
});
$("cmp-dir").addEventListener("change", (ev) => {
  const list = (ev.target as HTMLInputElement).files;
  if (list?.length) void compareCopy({ kind: "folder", entries: [...list].map((f) => ({ path: f.webkitRelativePath, blob: f })) });
  else clearComparison();
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
  if (!state.inv && state.input) void loadBundle(state.input, state.stripRoot, state.sourceDigest ?? undefined, state.entrypoint);
  else void refreshIdentity();
});
$("payload-btn").addEventListener("click", downloadPayload);

mountRecovery(() => {
  if (!state.inv || !state.scan || state.hasErrors || !state.artifactId) return null;
  const snapshot = { files: state.files, inv: state.inv, scan: state.scan, input: state.input,
    sourceDigest: state.sourceDigest, stripRoot: state.stripRoot, capturedAt: state.capturedAt };
  const selectedGeneration = generation, selectedIdentity = identityGeneration;
  return {
    input: { kind: "folder", entries: snapshot.files.map(f => ({ path: f.path, blob: new Blob([f.bytes.slice()]) })) },
    async apply(manifest, current) {
      // Rebind the worker's response to this exact active inventory, then check
      // both UI generations immediately before the sole state mutation.
      const m = buildManifest(manifest.appId, snapshot.inv.entries, manifest.entrypoint);
      if (!m.ok || await artifactId(m.manifest) !== await artifactId(manifest)) return false;
      if (!current() || generation !== selectedGeneration || identityGeneration !== selectedIdentity) return false;
      intakeTask.cancel(); ++generation; clearArtifact();
      Object.assign(state, snapshot, { appId: manifest.appId, entrypoint: manifest.entrypoint });
      $("intake-status").textContent = "Restored identity from matching local bytes. Review public data before export.";
      renderCompat(snapshot.scan); renderProviders();
      const committedGeneration = generation;
      const refreshed = refreshIdentity();
      const committedIdentity = identityGeneration;
      await refreshed;
      return current() && generation === committedGeneration && identityGeneration === committedIdentity;
    },
  };
}, async (current) => {
  if (!state.manifest || !state.artifactId || !state.inv || !state.input || !state.capturedAt || state.hasErrors) return false;
  const revision = identityGeneration, selectionGeneration = generation;
  const result = await exportArtifactRecovery({ artifactId: state.artifactId, manifest: state.manifest,
    totalBytes: state.inv.totalBytes, fileCount: state.inv.entries.length, sourceKind: state.input.kind, capturedAt: state.capturedAt }, new Date().toISOString());
  if (!result.ok || !current() || identityGeneration !== revision || generation !== selectionGeneration) return false;
  const url = URL.createObjectURL(new Blob([result.value], { type: "application/json" }));
  const a = el("a"); a.href = url; a.download = "replikrazy-artifact-recovery.json"; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
});

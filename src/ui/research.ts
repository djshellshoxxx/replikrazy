// Read-only browser for the published research catalogue snapshot. Loaded on
// demand (dynamic import) so the main bundle stays small. Entries are dated
// research leads: nothing here selects, qualifies or enables a destination.
// Text goes to the DOM via textContent only; links are https-only.

import type { ResearchLead, ResearchSnapshot } from "../research/mapper";
import { CATALOGUE } from "../providers/catalogue";

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, cls?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (cls) e.className = cls;
  return e;
}

function link(url: string, text: string): HTMLElement {
  if (!/^https:\/\//i.test(url)) return el("span", text);
  const a = el("a", text);
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  return a;
}

const row = (label: string, value: string | null) => (value ? el("p", `${label}: ${value}`) : null);

function card(r: ResearchLead): HTMLElement {
  const c = el("div", undefined, "card");
  const h = el("h3", r.name);
  h.append(el("span", r.recordClass.replace(/_/g, " "), "badge"), el("span", r.adapterTier, "badge"));
  c.append(h);
  const adapter = CATALOGUE.find((a) => a.researchId === r.id);
  for (const p of [
    row("Research id", r.id),
    row("Replikrazy destination card", adapter ? adapter.name : null),
    row("Evidence status", r.evidenceStatus),
    row("Operator", r.operator && r.operatorCountry ? `${r.operator} (${r.operatorCountry})` : r.operator),
    row("Market", r.market),
    row("Documentation languages", r.docsLanguages ? r.docsLanguages.join(", ") : r.docsLanguagesNote),
    row("Free model (as researched)", r.freeModel),
    row("Limits (as researched)", r.freeLimits),
    row("Suitability", r.suitability),
    row("Payment/key-handling apps", r.paymentKeyUiNote),
    row("Served-file integrity", r.servedAssetIntegrity),
    row("Browser deployment API (CORS)", r.deploymentApiCorsStatus),
    row("Checked", r.checkedUtc),
  ]) if (p) c.append(p);
  if (r.sourcePins.length) {
    const d = el("details");
    d.append(el("summary", `Sources (${r.sourcePins.length})`));
    const ul = el("ul");
    for (const p of r.sourcePins) {
      const li = el("li");
      li.append(link(p.url, `${p.pinId}: ${p.url}`), document.createTextNode(p.checkedUtc ? ` (checked ${p.checkedUtc})` : ""));
      ul.append(li);
    }
    d.append(ul);
    c.append(d);
  }
  return c;
}

export function mountResearch(root: HTMLElement, snap: ResearchSnapshot) {
  const text = el("input");
  text.type = "search";
  text.placeholder = "Name, country, market, language";
  const cls = el("select");
  const tiers = el("select");
  const opts = (sel: HTMLSelectElement, label: string, values: string[]) => {
    const all = el("option", `Any ${label}`);
    all.value = "";
    sel.append(all, ...values.map((v) => { const o = el("option", v); o.value = v; return o; }));
  };
  opts(cls, "kind", [...new Set(snap.records.map((r) => r.recordClass))].sort());
  opts(tiers, "route tier", [...new Set(snap.records.map((r) => r.adapterTier))].sort());
  const lText = el("label", "Search ");
  lText.append(text);
  const lCls = el("label", "Kind ");
  lCls.append(cls);
  const lTier = el("label", "Route tier ");
  lTier.append(tiers);
  const count = el("p", "", "hint");
  count.setAttribute("role", "status");
  const list = el("div");
  const render = () => {
    const q = text.value.trim().toLowerCase();
    const shown = snap.records.filter((r) =>
      (!cls.value || r.recordClass === cls.value) &&
      (!tiers.value || r.adapterTier === tiers.value) &&
      (!q || [r.name, r.id, r.operator, r.operatorCountry, r.market, r.docsLanguagesNote, ...(r.docsLanguages ?? [])].some((v) => v?.toLowerCase().includes(q))),
    );
    count.textContent = `${shown.length} of ${snap.recordCount} research leads`;
    list.replaceChildren(...shown.map(card));
  };
  for (const c of [text, cls, tiers]) c.addEventListener("input", render);
  const filters = el("div", undefined, "filters");
  filters.append(lText, lCls, lTier);
  root.replaceChildren(
    el("p", `MirrorKit research v13 (checked ${snap.researchCheckedUtc ?? "unknown"}), source sha256 ${snap.sourceSha256}. These are dated research leads, not qualified or recommended providers. Free plans, limits and terms change; check the provider's current pages before relying on any of this.`, "hint"),
    filters,
    count,
    list,
  );
  render();
}

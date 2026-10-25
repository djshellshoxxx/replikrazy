import { describe, expect, it } from "vitest";
import { analyze } from "../src/core/analyze";
import { buildInventory } from "../src/core/inventory";
import { resolveRef, scanBundle } from "../src/core/scan";
import { getProvider } from "../src/providers/catalogue";
import { assess } from "../src/providers/select";
import { bytes } from "./zipcraft";

const site = (files: Record<string, string>) => Object.entries(files).map(([path, s]) => ({ path, bytes: bytes(s) }));
const codes = (r: ReturnType<typeof scanBundle>) => r.findings.map((f) => f.code);

describe("resolveRef", () => {
  it("resolves relative, root-relative and parent refs", () => {
    expect(resolveRef("a/b/page.html", "img/x.png")).toBe("a/b/img/x.png");
    expect(resolveRef("a/b/page.html", "../x.css")).toBe("a/x.css");
    expect(resolveRef("a/page.html", "/x.css")).toBe("x.css");
    expect(resolveRef("page.html", "../../x")).toBeNull();
  });
});

describe("scanBundle", () => {
  it("plain relative static site: documents routing, no deps, nothing missing", () => {
    const r = scanBundle(site({
      "index.html": '<link rel="stylesheet" href="css/a.css"><img src="img/logo.png"><a href="about/">About</a><script src="js/app.js"></script>',
      "css/a.css": "body{background:url('../img/bg.jpg')} @font-face{src:url(../fonts/f.woff2)}",
      "img/logo.png": "", "img/bg.jpg": "", "fonts/f.woff2": "",
      "about/index.html": '<a href="../index.html">home</a>',
      "js/app.js": 'import { x } from "./mod.js"; const w = new Worker("./w.js");',
      "js/mod.js": "export const x = 1", "js/w.js": "",
    }));
    expect(r.hints).toMatchObject({ assetBase: "relative", routing: "documents", serviceWorker: "absent", usesOriginStorage: false, externalDependenciesComplete: false });
    expect(r.dependencies).toEqual([]);
    expect(r.missing).toEqual([]);
    expect(codes(r)).toEqual(["MK_SCAN_INCOMPLETE"]);
  });

  it("reports missing literal assets with their resolved path", () => {
    const r = scanBundle(site({ "index.html": '<img src="img/missing.png"><link rel="stylesheet" href="/css/gone.css?v=2">', "x.html": "" }));
    expect(r.missing).toEqual([
      { from: "index.html", ref: "img/missing.png", resolved: "img/missing.png" },
      { from: "index.html", ref: "/css/gone.css?v=2", resolved: "css/gone.css" },
    ]);
    expect(r.hints.assetBase).toBe("mixed");
  });

  it("collects external origins by role without fetching them", () => {
    const r = scanBundle(site({
      "index.html": '<script src="https://cdn.example.com/lib.js"></script><link rel="stylesheet" href="//fonts.example.net/css"><form action="https://api.example.org/send"></form>',
      "app.js": 'fetch("https://api.example.org/v1/items"); const ws = new WebSocket("wss://rt.example.org/socket");',
    }));
    expect(r.dependencies.map((d) => [d.origin, d.roles.sort().join("+")])).toEqual([
      ["https://api.example.org", "api"],
      ["https://cdn.example.com", "script"],
      ["https://fonts.example.net", "style"],
      ["wss://rt.example.org", "api"],
    ]);
    expect(r.hints.usesRealtime).toBe(true);
    expect(codes(r)).toEqual(expect.arrayContaining(["MK_EXTERNAL_DEPENDENCY", "MK_REALTIME_BACKEND"]));
  });

  it("detects history routing, service worker, storage, base tag, root-relative assets", () => {
    const r = scanBundle(site({
      "index.html": '<base href="/app/"><script type="module" src="/assets/main.js"></script>',
      "assets/main.js": 'history.pushState({}, "", "/x"); navigator.serviceWorker.register("/sw.js"); localStorage.setItem("k","v");',
      "sw.js": "",
    }));
    expect(r.hints).toMatchObject({ routing: "history", serviceWorker: "present", usesOriginStorage: true, hasBaseTag: true, assetBase: "root" });
    expect(codes(r)).toEqual(expect.arrayContaining(["MK_HISTORY_ROUTING", "MK_SERVICE_WORKER", "MK_ORIGIN_STORAGE", "MK_BASE_TAG"]));
  });

  it("ignores data:, javascript:, fragments, template and bare-specifier refs", () => {
    const r = scanBundle(site({
      "index.html": '<a href="#top"></a><a href="javascript:void 0"></a><img src="data:image/png;base64,AA"><img src="${cdn}/x.png"><img src="{{ url }}">',
      "m.js": 'import React from "react"; import("./chunk-" + id + ".js");',
    }));
    expect(r.missing).toEqual([]);
    expect(r.dependencies).toEqual([]);
  });

  it("flags secrets by class and path only, never the value", () => {
    const key = "AKIA" + "ABCDEFGHIJKLMNOP";
    const r = scanBundle(site({ "index.html": "", "config.js": `const k = "${key}";`, "k.txt": "-----BEGIN OPENSSH " + "PRIVATE KEY-----\nabc" }));
    const secrets = r.findings.filter((f) => f.code === "MK_SECRET_SUSPECTED");
    expect(secrets.map((f) => f.path).sort()).toEqual(["config.js", "k.txt"]);
    expect(JSON.stringify(r)).not.toContain(key);
    expect(JSON.stringify(r)).not.toContain("abc");
  });

  it("lists provider-reserved paths and source maps", () => {
    const r = scanBundle(site({ "index.html": "", "_worker.js": "export default {}", "functions/api/x.js": "", "functions/api/y.js": "", "app.js.map": "{}" }));
    expect(r.reservedPaths).toEqual(["_worker.js", "functions/"]);
    expect(codes(r)).toEqual(expect.arrayContaining(["MK_PROVIDER_RESERVED", "MK_SOURCE_MAP"]));
  });

  it("treats hostile HTML/JS as text: scanning has no side effects", () => {
    (globalThis as { pwned?: boolean }).pwned = false;
    scanBundle(site({ "index.html": "<script>globalThis.pwned = true</script><img src=x onerror=\"globalThis.pwned=true\">", "a.js": "globalThis.pwned = true" }));
    expect((globalThis as { pwned?: boolean }).pwned).toBe(false);
  });

  it("skips oversized text files and marks service-worker detection unknown", () => {
    const r = scanBundle([{ path: "index.html", bytes: bytes("") }, { path: "big.js", bytes: new Uint8Array(3 * 1024 * 1024) }]);
    expect(r.skipped).toEqual(["big.js"]);
    expect(r.hints.serviceWorker).toBe("unknown");
  });
});

describe("assessment with scan", () => {
  const run = async (files: Record<string, string>, providerId: string) => {
    const b = site(files);
    const inv = await buildInventory(b);
    return assess(getProvider(providerId)!, analyze(inv.entries), scanBundle(b));
  };
  it("blocks Cloudflare when a bundle carries _worker.js, but not a host that would not run it", async () => {
    const files = { "index.html": "", "_worker.js": "export default {}" };
    expect((await run(files, "cloudflare-pages")).blockers.join()).toMatch(/_worker\.js/);
    expect((await run(files, "neocities")).blockers).toEqual([]);
  });
  it("warns that history routing 404s on GitHub Pages and root-relative URLs break at /repo/", async () => {
    const a = await run({ "index.html": '<script src="/main.js"></script>', "main.js": 'history.pushState({}, "", "/a")' }, "github-pages");
    expect(a.warnings.join("\n")).toMatch(/deep links\/reloads will 404/);
    expect(a.warnings.join("\n")).toMatch(/root-relative URLs/);
  });
  it("blocks every destination on suspected live credentials in content", async () => {
    const a = await run({ "index.html": "", "x.js": "gh" + "p_" + "a".repeat(36) }, "netlify");
    expect(a.verdict).toBe("incompatible");
  });
});

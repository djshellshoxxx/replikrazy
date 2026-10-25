import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { CanonicalError, canonicalJson } from "../src/contracts/canonical";
import { artifactId, buildManifest, defaultEntrypoint, validateManifest } from "../src/contracts/manifest";
import { intakeFolder, intakeZip, type PickedFile } from "../src/core/intake";
import { buildInventory } from "../src/core/inventory";
import { bytes } from "./zipcraft";

describe("canonicalJson (RFC 8785 subset)", () => {
  it("sorts keys by UTF-16 code units and emits no whitespace", () => {
    expect(canonicalJson({ b: 1, a: [true, null, "x"], A: {} })).toBe('{"A":{},"a":[true,null,"x"],"b":1}');
    // U+FF5E vs U+1F600 (surrogates 0xD83D…): UTF-16 order puts the emoji first,
    // although code-point/UTF-8 order would not. JCS requires UTF-16 order.
    expect(canonicalJson({ "\uff5e": 1, "\u{1F600}": 2 })).toBe('{"\u{1F600}":2,"\uff5e":1}');
  });
  it("escapes strings like ECMAScript JSON.stringify", () => {
    expect(canonicalJson("a\"b\\c\n\u0001é")).toBe('"a\\"b\\\\c\\n\\u0001é"');
  });
  it("normalises -0 and rejects non-integers, NaN, undefined, lone surrogates and class instances", () => {
    expect(canonicalJson(-0)).toBe("0");
    for (const bad of [1.5, NaN, Infinity, 2 ** 53, undefined, "\ud800", new Date(0), new Map()]) {
      expect(() => canonicalJson(bad)).toThrow(CanonicalError);
    }
  });
});

describe("ArtifactManifest", () => {
  const files = [
    { path: "index.html", size: 2, sha256: "a".repeat(64) },
    { path: "css/a.css", size: 1, sha256: "b".repeat(64) },
  ];
  it("sorts files by UTF-8 order and validates", () => {
    const m = buildManifest("my-site", files, "index.html");
    expect(m.ok && m.manifest.files.map((f) => f.path)).toEqual(["css/a.css", "index.html"]);
  });
  it("artifactId depends on appId and entrypoint, not input order", async () => {
    const id = async (app: string, entry: string, list = files) => {
      const m = buildManifest(app, list, entry);
      if (!m.ok) throw new Error(m.errors.join());
      return artifactId(m.manifest);
    };
    const base = await id("my-site", "index.html");
    expect(base).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(await id("my-site", "index.html", [...files].reverse())).toBe(base);
    expect(await id("other", "index.html")).not.toBe(base);
  });
  it("rejects bad identity inputs", () => {
    const errs = (app: string, entry: string) => { const m = buildManifest(app, files, entry); return m.ok ? [] : m.errors; };
    expect(errs("My Site", "index.html").join()).toMatch(/appId/);
    expect(errs("ok", "missing.html").join()).toMatch(/entrypoint/);
    expect(errs("ok", "css/a.css").join()).toMatch(/HTML/);
  });
  it("validateManifest rejects tampered records", () => {
    const m = buildManifest("site", files, "index.html");
    if (!m.ok) throw new Error();
    expect(validateManifest(m.manifest)).toEqual([]);
    expect(validateManifest({ ...m.manifest, extra: 1 }).join()).toMatch(/unknown fields/);
    expect(validateManifest({ ...m.manifest, schemaVersion: "2.0" }).join()).toMatch(/schemaVersion/);
    expect(validateManifest({ ...m.manifest, files: [...m.manifest.files].reverse() }).join()).toMatch(/sorted/);
    expect(validateManifest({ ...m.manifest, files: [m.manifest.files[0], m.manifest.files[0]] }).join()).toMatch(/duplicate/);
    expect(validateManifest({ ...m.manifest, files: [{ path: "../x", size: 1, sha256: "a".repeat(64) }] }).join()).toMatch(/invalid path/);
    expect(validateManifest({ ...m.manifest, files: [{ path: "index.html", size: 1.5, sha256: "A".repeat(64) }] }).join()).toMatch(/invalid size.*invalid sha256|invalid sha256/s);
  });
  it("defaultEntrypoint prefers root index.html and never guesses", () => {
    expect(defaultEntrypoint(["a/index.html", "index.htm"])).toBe("index.htm");
    expect(defaultEntrypoint(["a.html", "b.html"])).toBeNull();
  });
});

describe("T-ART-01: folder and ZIP give the same artifact", () => {
  const SITE: Record<string, Uint8Array> = {
    "index.html": bytes("<h1>hi</h1>"),
    "café/ünï.txt": bytes("unicode name"),
    "empty.bin": new Uint8Array(),
    "img/x.bin": new Uint8Array([0, 255, 13, 10, 0]),
  };
  const idOf = async (files: { path: string; bytes: Uint8Array }[]) => {
    const inv = await buildInventory(files);
    const m = buildManifest("site", inv.entries, "index.html");
    if (!m.ok) throw new Error(m.errors.join());
    return artifactId(m.manifest);
  };
  it("same id across ZIP compression, entry order, timestamps and folder intake", async () => {
    const entries = Object.entries(SITE);
    const stored = zipSync(Object.fromEntries(entries.map(([k, v]) => [k, [v, { level: 0 }]])));
    const deflated = zipSync(Object.fromEntries([...entries].reverse().map(([k, v]) => [k, [v, { level: 9, mtime: new Date("2020-02-02") }]])));
    const picked: PickedFile[] = entries.map(([k, v]) => ({ webkitRelativePath: `pick/${k}`, size: v.length, arrayBuffer: async () => v.slice().buffer }));
    const a = intakeZip(stored);
    const b = intakeZip(deflated);
    const c = await intakeFolder(picked, { stripRoot: true });
    for (const r of [a, b, c]) expect(r.issues).toEqual([]);
    const ids = await Promise.all([a, b, c].map((r) => idOf(r.files)));
    expect(new Set(ids).size).toBe(1);
    // Bytes, including zero-byte and binary files, are preserved exactly.
    expect(c.files.find((f) => f.path === "img/x.bin")!.bytes).toEqual(SITE["img/x.bin"]);
    expect(c.files.find((f) => f.path === "empty.bin")!.bytes.length).toBe(0);
  });
});

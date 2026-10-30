import { describe, expect, it } from "vitest";
import { compareInventories, isIdentical, preferRootComparison } from "../src/core/compare";
import { buildInventory } from "../src/core/inventory";
import { bytes } from "./zipcraft";

describe("compareInventories", () => {
  it("classifies matching, changed, missing and extra files", async () => {
    const want = await buildInventory([
      { path: "index.html", bytes: bytes("<h1>x</h1>") },
      { path: "a.css", bytes: bytes("a{}") },
      { path: "gone.js", bytes: bytes("1") },
    ]);
    const got = await buildInventory([
      { path: "index.html", bytes: bytes("<h1>x</h1><script src=/analytics.js></script>") },
      { path: "a.css", bytes: bytes("a{}") },
      { path: "extra.txt", bytes: bytes("?") },
    ]);
    const c = compareInventories(want.entries, got.entries);
    expect(c.matching).toEqual(["a.css"]);
    expect(c.changed).toEqual([{ path: "index.html", expectedSize: 10, actualSize: 45, expectedSha256: want.entries.find((e) => e.path === "index.html")!.sha256, actualSha256: got.entries.find((e) => e.path === "index.html")!.sha256 }]);
    expect(c.missing).toEqual(["gone.js"]);
    expect(c.extra).toEqual(["extra.txt"]);
    expect(isIdentical(c)).toBe(false);
  });
  it("identical copies compare identical", async () => {
    const inv = await buildInventory([{ path: "index.html", bytes: bytes("x") }]);
    expect(isIdentical(compareInventories(inv.entries, inv.entries))).toBe(true);
  });
});


it("retains exact hash evidence when changed files have the same size", async () => {
  const expected = await buildInventory([{ path: "index.html", bytes: bytes("a") }]);
  const actual = await buildInventory([{ path: "index.html", bytes: bytes("b") }]);
  const comparison = compareInventories(expected.entries, actual.entries);
  expect(comparison.changed).toEqual([{
    path: "index.html", expectedSize: 1, actualSize: 1,
    expectedSha256: "ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb",
    actualSha256: "3e23e8160039594a33894f6564e1b1348bbd7a0088d42c4acb73eeaed59c009d",
  }]);
  expect(isIdentical(comparison)).toBe(false);
});


describe("comparison root selection", () => {
  const entry = (path: string, sha256: string) => ({ path, size: 1, sha256 });
  it("recognizes all-changed wrapped copies by shared paths", () => {
    const want = [entry("index.html", "a")];
    const plain = compareInventories(want, [entry("copy/index.html", "b")]);
    const stripped = compareInventories(want, [entry("index.html", "b")]);
    expect(preferRootComparison(plain, stripped)).toBe(true);
    expect(stripped.changed).toHaveLength(1);
    expect(isIdentical(stripped)).toBe(false);
  });
  it("prefers more shared paths before byte matches", () => {
    const want = [entry("copy/index.html", "a"), entry("index.html", "a"), entry("style.css", "a")];
    const plain = compareInventories(want, [entry("copy/index.html", "a"), entry("copy/style.css", "b")]);
    const stripped = compareInventories(want, [entry("index.html", "b"), entry("style.css", "b")]);
    expect(preferRootComparison(plain, stripped)).toBe(true);
  });
  it("uses byte matches to break overlap ties but keeps plain on equal evidence", () => {
    const want = [entry("index.html", "a")];
    const changed = compareInventories(want, [entry("index.html", "b")]);
    const identical = compareInventories(want, want);
    expect(preferRootComparison(changed, identical)).toBe(true);
    expect(preferRootComparison(identical, changed)).toBe(false);
    expect(preferRootComparison(changed, changed)).toBe(false);
    const unrelated = compareInventories(want, [entry("other.html", "a")]);
    expect(preferRootComparison(unrelated, unrelated)).toBe(false);
  });
});

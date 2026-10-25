import { describe, expect, it } from "vitest";
import { compareInventories, isIdentical } from "../src/core/compare";
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
    expect(c.changed).toEqual([{ path: "index.html", expectedSize: 10, actualSize: 45 }]);
    expect(c.missing).toEqual(["gone.js"]);
    expect(c.extra).toEqual(["extra.txt"]);
    expect(isIdentical(c)).toBe(false);
  });
  it("identical copies compare identical", async () => {
    const inv = await buildInventory([{ path: "index.html", bytes: bytes("x") }]);
    expect(isIdentical(compareInventories(inv.entries, inv.entries))).toBe(true);
  });
});

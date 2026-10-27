import { describe, expect, it } from "vitest";
import { compareUtf8, findCaseCollisions, findFileDirConflicts, validatePath } from "../src/core/paths";

describe("validatePath", () => {
  it.each(["index.html", "css/site.css", "a/b/c/d.png", "ünïcode.html", "\u{1F600}.html", "_redirects", ".well-known/security.txt"])(
    "accepts %s", (p) => expect(validatePath(p).ok).toBe(true));
  it.each([
    ["\ud800.html", "path contains an unpaired surrogate"],
    ["x\udc00.html", "path contains an unpaired surrogate"],
    ["\ud800\ud800.html", "path contains an unpaired surrogate"],
    ["", "empty path"], ["/etc/passwd", "absolute path"], ["../x", "dot segment"], ["a/../../x", "dot segment"],
    ["a/./b", "dot segment"], ["a\\b", "backslash in path"], ["C:/x", "drive-letter path"], ["a//b", "empty path segment"],
    ["a/", "empty path segment"], ["nul.txt", "reserved device name"], ["a/COM1", "reserved device name"],
    ["x\u0000y", "control character"], ["ab:c", "forbidden character"], ["x\ny", "control character"],
    ["trail.", "trailing space or dot"], ["e\u0301.html", "path is not NFC-normalised"],
    ["x".repeat(121), "path segment too long"], ["é".repeat(61), "path segment too long"], [Array(5).fill("y".repeat(60)).join("/"), "path too long"],
    ["a#b", "forbidden character"], ["a%20b", "forbidden character"], ["a?b", "forbidden character"],
    ["evil\u202egnp.js", "bidirectional control character"], ["x\u2066y", "bidirectional control character"], ["//server/share", "absolute path"], [Array(33).fill("d").join("/"), "path too deep"],
  ])("rejects %j (%s)", (p, reason) => expect(validatePath(p)).toEqual({ ok: false, reason }));
});

describe("collisions", () => {
  it("finds case collisions", () => expect(findCaseCollisions(["A.html", "a.html", "b"])).toEqual([["A.html", "a.html"]]));
  it("finds file/dir conflicts", () => expect(findFileDirConflicts(["a", "a/b", "c/d"])).toEqual(["a"]));
  it("finds file/dir conflicts across case", () => expect(findFileDirConflicts(["A", "a/b"])).toEqual(["A"]));
  it("folds multi-character cases", () => {
    expect(findCaseCollisions(["straße.html", "STRASSE.html"])).toHaveLength(1);
    expect(findCaseCollisions(["ﬁle.txt", "FILE.txt"])).toHaveLength(1);
  });
  it("sorts by UTF-8 byte (code point) order, not UTF-16 units", () => {
    const astral = "\u{1F600}.txt"; // UTF-16 surrogates sort before U+FF5E in JS default order
    const bmpHigh = "\uFF5E.txt";
    expect([astral, bmpHigh].sort()).toEqual([astral, bmpHigh]);
    expect([astral, bmpHigh].sort(compareUtf8)).toEqual([bmpHigh, astral]);
  });
});

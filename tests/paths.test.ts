import { describe, expect, it } from "vitest";
import { findCaseCollisions, findFileDirConflicts, validatePath } from "../src/core/paths";

describe("validatePath", () => {
  it.each(["index.html", "css/site.css", "a/b/c/d.png", "ünïcode.html", "_redirects", ".well-known/security.txt"])(
    "accepts %s", (p) => expect(validatePath(p).ok).toBe(true));
  it.each([
    ["", "empty path"], ["/etc/passwd", "absolute path"], ["../x", "dot segment"], ["a/../../x", "dot segment"],
    ["a/./b", "dot segment"], ["a\\b", "backslash in path"], ["C:/x", "drive-letter path"], ["a//b", "empty path segment"],
    ["a/", "empty path segment"], ["nul.txt", "reserved device name"], ["a/COM1", "reserved device name"],
    ["x\u0000y", "forbidden character"], ["ab:c", "forbidden character"], ["x\ny", "forbidden character"],
    ["trail.", "trailing space or dot"], ["e\u0301.html", "path is not NFC-normalised"],
    ["x".repeat(256), "path segment too long"], [Array(33).fill("d").join("/"), "path too deep"],
  ])("rejects %j (%s)", (p, reason) => expect(validatePath(p)).toEqual({ ok: false, reason }));
});

describe("collisions", () => {
  it("finds case collisions", () => expect(findCaseCollisions(["A.html", "a.html", "b"])).toEqual([["A.html", "a.html"]]));
  it("finds file/dir conflicts", () => expect(findFileDirConflicts(["a", "a/b", "c/d"])).toEqual(["a"]));
});

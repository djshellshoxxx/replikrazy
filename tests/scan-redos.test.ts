// Regression guard: the scanner runs regexes over untrusted text up to the
// 2 MiB per-file cap. Each of these inputs was (or could be) quadratic; all
// must finish well inside the budget. The budget is generous for slow CI.
import { describe, expect, it } from "vitest";
import { SCAN_LIMITS, scanBundle } from "../src/core/scan";

const N = SCAN_LIMITS.maxTextBytes - 100;
const BUDGET_MS = 3000;
const cases: [string, string, string][] = [
  ["many unclosed <style>", "a.html", "<style>".repeat(N / 7)],
  ["many unclosed <script>", "a.html", "<script>".repeat(N / 8)],
  ["many unterminated tags", "a.html", "<a ".repeat(N / 3)],
  ["many unterminated <base", "a.html", "<base ".repeat(N / 6)],
  ["many unterminated <meta", "a.html", "<meta ".repeat(N / 6)],
  ["many style attrs", "a.html", 'style="'.repeat(N / 7)],
  ["repeated url( in CSS", "a.css", "url(".repeat(N / 4)],
  ["import without from", "a.js", "import a ".repeat(N / 9)],
  ["import{ repeated", "a.js", "import{".repeat(N / 7)],
  ["import + whitespace", "a.js", "import" + " ".repeat(N)],
  ["fetch( repeated", "a.js", "fetch(".repeat(N / 6)],
  ["long https literal", "a.js", '"https://' + "a".repeat(N)],
  ["many quotes", "a.js", '"'.repeat(N)],
];

describe("scanner stays linear on hostile text", () => {
  for (const [name, path, text] of cases) {
    it(name, () => {
      const t = performance.now();
      scanBundle([{ path, bytes: new TextEncoder().encode(text) }]);
      expect(performance.now() - t).toBeLessThan(BUDGET_MS);
    });
  }
});

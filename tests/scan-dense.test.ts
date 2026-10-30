import { expect, it } from "vitest";
import { SCAN_LIMITS, scanBundle } from "../src/core/scan";
// Broker probes: allocation hardening candidate, not a claimed original defect.
for (const [path, atom] of [["a.css", "url(a)"], ["a.html", "<a href=x>"]]) {
  it(`bounds dense valid references in ${path}`, () => {
    const bytes = new TextEncoder().encode(atom!.repeat(Math.floor((SCAN_LIMITS.maxTextBytes - 100) / atom!.length)));
    const start = performance.now();
    const result = scanBundle([{ path: path!, bytes }]);
    const elapsed = performance.now() - start;
    console.info(JSON.stringify({ probe: path, elapsedMs: elapsed, bytes: bytes.length, truncated: result.truncated }));
    expect(elapsed).toBeLessThan(3000);
    expect(result.truncated).toBe(true);
    expect(result.missing.length).toBeLessThanOrEqual(SCAN_LIMITS.maxRefsPerFile);
  });
}

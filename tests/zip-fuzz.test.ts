// Seeded mutation fuzz of the ZIP reader (BUILD_PLAN future selector
// "test:fuzz --seed 20261024"). Every mutated archive must either parse or
// fail with ZipError: no other exception type, and no entry beyond limits.
import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { DEFAULT_ZIP_LIMITS, readZip, ZipError } from "../src/core/zip";
import { bytes } from "./zipcraft";

// mulberry32: small deterministic PRNG.
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEED = 20261024;
const ITERATIONS = 3000;
const LIMITS = { ...DEFAULT_ZIP_LIMITS, maxFileBytes: 64 * 1024, maxTotalBytes: 256 * 1024 };

describe("readZip mutation fuzz", () => {
  const seeds = [
    zipSync({ "index.html": bytes("<h1>hello</h1>".repeat(20)), "a/b.css": bytes("body{}"), "x.bin": new Uint8Array(300).map((_, i) => i) }),
    zipSync({ "index.html": [bytes("z".repeat(5000)), { level: 9 }], "d/": new Uint8Array() }),
    zipSync({ "only.txt": [bytes("stored"), { level: 0 }] }),
  ];
  it(`survives ${ITERATIONS} mutations (seed ${SEED})`, () => {
    const r = rng(SEED);
    const counts = { ok: 0, zipError: 0 };
    for (let i = 0; i < ITERATIONS; i++) {
      const base = seeds[i % seeds.length]!;
      const z = base.slice();
      const kind = Math.floor(r() * 4);
      if (kind === 0) {
        // Flip 1–8 random bytes.
        for (let k = 1 + Math.floor(r() * 8); k > 0; k--) z[Math.floor(r() * z.length)] = Math.floor(r() * 256);
      } else if (kind === 1) {
        // Overwrite a 2- or 4-byte field with an extreme value.
        const at = Math.floor(r() * (z.length - 4));
        const v = [0, 0xff, 0x7f, 0x80][Math.floor(r() * 4)]!;
        z.fill(v, at, at + (r() < 0.5 ? 2 : 4));
      }
      const input = kind === 2 ? z.subarray(0, Math.floor(r() * z.length)) // truncate
        : kind === 3 ? new Uint8Array([...z.subarray(0, Math.floor(r() * z.length)), ...z]) // prepend garbage copy
        : z;
      try {
        const res = readZip(input, LIMITS);
        for (const e of res.entries) expect(e.bytes.length).toBeLessThanOrEqual(LIMITS.maxFileBytes);
        counts.ok++;
      } catch (e) {
        if (!(e instanceof ZipError)) throw new Error(`iteration ${i}: non-ZipError ${String(e)}`);
        counts.zipError++;
      }
    }
    // Both outcomes must actually occur, or the fuzz is not exercising anything.
    expect(counts.ok).toBeGreaterThan(0);
    expect(counts.zipError).toBeGreaterThan(0);
  });
});

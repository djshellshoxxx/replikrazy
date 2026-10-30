// RFC 8785 JSON Canonicalization Scheme (JCS) for the value subset our
// contracts use (research MK-CTR-008): null, booleans, safe integers, strings,
// arrays and plain objects. Anything else (fractions, NaN, undefined, lone
// surrogates, non-plain objects) is rejected rather than coerced, so a digest
// can never silently depend on an engine's float formatting.
//
// JCS sorts object keys by UTF-16 code units (not UTF-8), and serialises
// strings exactly as ECMAScript JSON.stringify does, which we reuse.

export class CanonicalError extends Error {}

const LONE_SURROGATE = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/;

function str(s: string): string {
  if (LONE_SURROGATE.test(s)) throw new CanonicalError("lone surrogate in string");
  return JSON.stringify(s);
}

export function canonicalJson(v: unknown): string {
  if (v === null) return "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") {
    if (!Number.isSafeInteger(v)) throw new CanonicalError("only safe integers are allowed");
    return Object.is(v, -0) ? "0" : String(v);
  }
  if (typeof v === "string") return str(v);
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) if (!Object.hasOwn(v, i)) throw new CanonicalError("sparse array");
    return `[${v.map(canonicalJson).join(",")}]`;
  }
  if (typeof v === "object" && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null)) {
    const entries = Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== undefined);
    // Default sort compares UTF-16 code units, which is what JCS requires.
    entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, x]) => `${str(k)}:${canonicalJson(x)}`).join(",")}}`;
  }
  throw new CanonicalError(`unsupported value type: ${typeof v}`);
}

// UTF-8, no BOM, no trailing newline: the exact bytes that get hashed.
export const canonicalBytes = (v: unknown): Uint8Array => new TextEncoder().encode(canonicalJson(v));

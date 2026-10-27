// Recovery/status source parsing only. No evaluation, reviver or hydration.
// Engineering work limits; rejected source remains available to the caller.
export const RECORD_MAX_BYTES = 10 * 1024 * 1024;
export class RecordJsonError extends Error {
  constructor(readonly code: "MK_RECORD_CORRUPT" | "MK_LIMIT_EXCEEDED") { super(code); }
}
export function parseRecordJson(source: string): unknown {
  const fail = (): never => { throw new RecordJsonError("MK_RECORD_CORRUPT"); };
  const limit = (): never => { throw new RecordJsonError("MK_LIMIT_EXCEEDED"); };
  if (source.length > RECORD_MAX_BYTES || new TextEncoder().encode(source).length > RECORD_MAX_BYTES) limit();
  let at = 0, nodes = 0;
  const ws = () => { while (at < source.length && /[\x20\t\r\n]/.test(source[at]!)) at++; };
  function string(): string {
    const start = at++;
    while (at < source.length) {
      const c = source[at++];
      if (c === '"') {
        let value: string;
        try { value = JSON.parse(source.slice(start, at)) as string; } catch { return fail(); }
        for (const char of value) {
          const point = char.codePointAt(0)!;
          if (point >= 0xd800 && point <= 0xdfff) fail();
        }
        return value;
      }
      if (c === "\\") at++; // JSON.parse validates the exact escape sequence.
    }
    return fail();
  }
  const number = /-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/y;
  function value(depth: number): unknown {
    if (depth > 64 || ++nodes > 200_000) limit();
    ws(); const c = source[at];
    if (c === '"') return string();
    if (c === "{" || c === "[") {
      const object = c === "{";
      const out: Record<string, unknown> | unknown[] = object ? Object.create(null) : [];
      at++; ws();
      const end = object ? "}" : "]";
      if (source[at] === end) { at++; return out; }
      for (;;) {
        ws();
        if (object) {
          if (source[at] !== '"') fail();
          const key = string();
          if (Object.hasOwn(out, key)) fail(); // Compare decoded keys, not spellings.
          ws(); if (source[at++] !== ":") fail();
          (out as Record<string, unknown>)[key] = value(depth + 1);
        } else (out as unknown[]).push(value(depth + 1));
        ws();
        if (source[at] === end) { at++; return out; }
        if (source[at++] !== ",") fail();
      }
    }
    for (const [literal, result] of [["true", true], ["false", false], ["null", null]] as const) {
      if (source.startsWith(literal, at)) { at += literal.length; return result; }
    }
    number.lastIndex = at;
    const match = number.exec(source);
    if (!match) return fail();
    at = number.lastIndex;
    const result = Number(match[0]);
    if (!Number.isFinite(result)) fail();
    return result;
  }
  const result = value(0); ws();
  if (at !== source.length) fail();
  return result;
}

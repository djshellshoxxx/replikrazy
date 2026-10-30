import { boundedText, exactKeys, isRecord } from "./diagnostic";
export const record = (x: unknown, required: string[], optional: string[] = []): x is Record<string, unknown> => isRecord(x) && exactKeys(x, required, optional);
export const text = (x: unknown, max = 2000): x is string => typeof x === "string" && x.length <= 2 * max && boundedText(x, max);
export const digest = (x: unknown): x is string => typeof x === "string" && /^sha256:[0-9a-f]{64}$/.test(x);
export const uuid = (x: unknown): x is string => typeof x === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(x);
export const oneOf = (x: unknown, values: readonly string[]): x is string => typeof x === "string" && values.includes(x);
export const array = (x: unknown, max: number, check: (value: unknown) => boolean): x is unknown[] => Array.isArray(x) && x.length <= max && x.every(check);
export const publicUrl = (x: unknown): x is string => {
  if (!text(x, 2048) || x.includes("#")) return false;
  try { const u = new URL(x); return !u.username && !u.password && (u.protocol === "https:" || (u.protocol === "http:" && /\.(onion|i2p)$/.test(u.hostname))); } catch { return false; }
};

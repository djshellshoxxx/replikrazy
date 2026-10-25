// Hand-built ZIP writer for hostile fixtures. Every field can be overridden so
// tests can produce archives real tools refuse to create.
import { deflateSync } from "fflate";
import { crc32 } from "../src/core/crc32";

export interface CraftEntry {
  name: string | Uint8Array;
  data?: Uint8Array;
  deflate?: boolean;
  flags?: number;
  method?: number;
  madeBy?: number; // host OS byte
  unixMode?: number; // e.g. 0o120777 symlink
  crc?: number;
  csize?: number;
  usize?: number;
  localOffset?: number; // override central-dir pointer
}

export function craftZip(entries: CraftEntry[], opts: { zip64Locator?: boolean } = {}): Uint8Array {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const cen: Uint8Array[] = [];
  let off = 0;
  for (const e of entries) {
    const name = typeof e.name === "string" ? enc.encode(e.name) : e.name;
    const data = e.data ?? new Uint8Array();
    const comp = e.deflate ? deflateSync(data) : data;
    const method = e.method ?? (e.deflate ? 8 : 0);
    const flags = e.flags ?? 0x800;
    const crc = e.crc ?? crc32(data);
    const csize = e.csize ?? comp.length;
    const usize = e.usize ?? data.length;
    const loc = new Uint8Array(30 + name.length);
    const lv = new DataView(loc.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, flags, true);
    lv.setUint16(8, method, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, csize, true);
    lv.setUint32(22, usize, true);
    lv.setUint16(26, name.length, true);
    loc.set(name, 30);
    const c = new Uint8Array(46 + name.length);
    const cv = new DataView(c.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, ((e.madeBy ?? 3) << 8) | 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, flags, true);
    cv.setUint16(10, method, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, csize, true);
    cv.setUint32(24, usize, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(38, ((e.unixMode ?? 0o100644) << 16) >>> 0, true);
    cv.setUint32(42, e.localOffset ?? off, true);
    c.set(name, 46);
    cen.push(c);
    chunks.push(loc, comp);
    off += loc.length + comp.length;
  }
  const cenSize = cen.reduce((n, c) => n + c.length, 0);
  const tail: Uint8Array[] = [];
  if (opts.zip64Locator) {
    const l = new Uint8Array(20);
    new DataView(l.buffer).setUint32(0, 0x07064b50, true);
    tail.push(l);
  }
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cenSize, true);
  ev.setUint32(16, off, true);
  const all = [...chunks, ...cen, ...tail, eocd];
  const out = new Uint8Array(all.reduce((n, a) => n + a.length, 0));
  let p = 0;
  for (const a of all) { out.set(a, p); p += a.length; }
  return out;
}

export const bytes = (s: string) => new TextEncoder().encode(s);

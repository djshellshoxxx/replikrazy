// Bounded, validating ZIP reader. We parse the central directory ourselves
// (instead of fflate's unzipSync) so that every entry is checked for size,
// ratio, type, encryption and overlap BEFORE any byte is inflated. fflate is
// used only for raw DEFLATE decoding into a buffer we pre-size from the
// declared size, so a lying header cannot make us allocate more than the
// limits allow; CRC + length checks then catch any mismatch.

import { inflateSync } from "fflate";
import { crc32 } from "./crc32";

export interface ZipLimits {
  maxArchiveBytes: number;
  maxEntries: number;
  maxFileBytes: number;
  maxTotalBytes: number;
  maxRatio: number; // uncompressed / compressed, per entry
}

export const DEFAULT_ZIP_LIMITS: ZipLimits = {
  maxArchiveBytes: 256 * 1024 * 1024,
  maxEntries: 10_000,
  maxFileBytes: 64 * 1024 * 1024,
  maxTotalBytes: 512 * 1024 * 1024,
  maxRatio: 200,
};

export interface RawEntry {
  name: string;
  bytes: Uint8Array;
}

export interface ZipReadResult {
  entries: RawEntry[];
  // Entries refused individually (symlink, encrypted, bad CRC, ...). The
  // archive as a whole is still readable, but callers must surface these.
  rejected: { name: string; reason: string }[];
}

export class ZipError extends Error {}

const SIG_EOCD = 0x06054b50;
const SIG_CEN = 0x02014b50;
const SIG_LOC = 0x04034b50;
const SIG_ZIP64_LOCATOR = 0x07064b50;

export function readZip(buf: Uint8Array, limits: ZipLimits = DEFAULT_ZIP_LIMITS): ZipReadResult {
  if (buf.length > limits.maxArchiveBytes) throw new ZipError("archive exceeds size limit");
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const u16 = (o: number) => dv.getUint16(o, true);
  const u32 = (o: number) => dv.getUint32(o, true);
  const inBounds = (o: number, n: number) => o >= 0 && n >= 0 && o + n <= buf.length;

  // EOCD is 22 bytes plus an optional comment of up to 65535 bytes.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i--) {
    if (u32(i) === SIG_EOCD && i + 22 + u16(i + 20) === buf.length) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new ZipError("not a ZIP archive (no end-of-central-directory record)");
  if (eocd >= 20 && u32(eocd - 20) === SIG_ZIP64_LOCATOR) throw new ZipError("ZIP64 archives are not supported");
  if (u16(eocd + 4) !== 0 || u16(eocd + 6) !== 0) throw new ZipError("multi-disk archives are not supported");

  const count = u16(eocd + 10);
  const cenSize = u32(eocd + 12);
  const cenOff = u32(eocd + 16);
  if (count !== u16(eocd + 8)) throw new ZipError("inconsistent entry count");
  if (count > limits.maxEntries) throw new ZipError("too many entries");
  if (!inBounds(cenOff, cenSize) || cenOff + cenSize > eocd) throw new ZipError("central directory out of bounds");

  const utf8 = new TextDecoder("utf-8", { fatal: true });
  const entries: RawEntry[] = [];
  const rejected: { name: string; reason: string }[] = [];
  const ranges: { start: number; end: number; name: string }[] = [];
  const seen = new Set<string>();
  let total = 0;
  let p = cenOff;

  for (let i = 0; i < count; i++) {
    if (!inBounds(p, 46) || u32(p) !== SIG_CEN) throw new ZipError("corrupt central directory");
    const madeBy = u16(p + 4) >> 8;
    const flags = u16(p + 8);
    const method = u16(p + 10);
    const crc = u32(p + 16);
    const csize = u32(p + 20);
    const usize = u32(p + 24);
    const nlen = u16(p + 28);
    const xlen = u16(p + 30);
    const clen = u16(p + 32);
    const attrs = u32(p + 38);
    const locOff = u32(p + 42);
    if (!inBounds(p + 46, nlen + xlen + clen)) throw new ZipError("corrupt central directory");
    const nameBytes = buf.subarray(p + 46, p + 46 + nlen);
    p += 46 + nlen + xlen + clen;

    let name: string;
    try {
      // Bit 11 = UTF-8 names. Without it the name is CP437; we only accept the
      // ASCII subset so the decoded name is unambiguous.
      name = utf8.decode(nameBytes);
    } catch {
      rejected.push({ name: "(undecodable name)", reason: "entry name is not valid UTF-8" });
      continue;
    }
    if (!(flags & 0x800) && /[^\x00-\x7f]/.test(name)) {
      rejected.push({ name, reason: "non-ASCII name without UTF-8 flag" });
      continue;
    }
    if (seen.has(name)) {
      rejected.push({ name, reason: "duplicate entry name" });
      continue;
    }
    seen.add(name);

    const unixMode = madeBy === 3 ? (attrs >>> 16) & 0xf000 : 0;
    const isDir = name.endsWith("/") || unixMode === 0x4000;
    if (isDir) continue; // directories are implied by file paths
    if (unixMode === 0xa000) { rejected.push({ name, reason: "symbolic link" }); continue; }
    if (unixMode !== 0 && unixMode !== 0x8000) { rejected.push({ name, reason: "not a regular file" }); continue; }
    if (flags & 0x1) { rejected.push({ name, reason: "encrypted entry" }); continue; }
    if (method !== 0 && method !== 8) { rejected.push({ name, reason: `unsupported compression method ${method}` }); continue; }
    if (csize === 0xffffffff || usize === 0xffffffff || locOff === 0xffffffff) {
      rejected.push({ name, reason: "ZIP64 entry" });
      continue;
    }
    if (usize > limits.maxFileBytes) { rejected.push({ name, reason: "file exceeds size limit" }); continue; }
    if (method === 0 && csize !== usize) { rejected.push({ name, reason: "stored entry size mismatch" }); continue; }
    if (usize > 0 && (csize === 0 || usize / csize > limits.maxRatio)) {
      rejected.push({ name, reason: "compression ratio exceeds limit" });
      continue;
    }
    if (total + usize > limits.maxTotalBytes) throw new ZipError("total uncompressed size exceeds limit");

    if (!inBounds(locOff, 30) || u32(locOff) !== SIG_LOC) { rejected.push({ name, reason: "bad local header" }); continue; }
    const dataStart = locOff + 30 + u16(locOff + 26) + u16(locOff + 28);
    if (!inBounds(dataStart, csize) || dataStart + csize > cenOff) {
      rejected.push({ name, reason: "entry data out of bounds" });
      continue;
    }
    ranges.push({ start: locOff, end: dataStart + csize, name });

    const comp = buf.subarray(dataStart, dataStart + csize);
    let bytes: Uint8Array;
    try {
      bytes = method === 0 ? comp.slice() : inflateSync(comp, { out: new Uint8Array(usize) });
    } catch {
      rejected.push({ name, reason: "corrupt compressed data" });
      continue;
    }
    if (bytes.length !== usize || crc32(bytes) !== crc) {
      rejected.push({ name, reason: "size or CRC mismatch" });
      continue;
    }
    total += usize;
    entries.push({ name, bytes });
  }

  // Overlapping local records are a known zip-bomb construction (many central
  // entries pointing at shared data). Refuse the archive outright.
  ranges.sort((a, b) => a.start - b.start);
  for (let i = 1; i < ranges.length; i++) {
    if (ranges[i]!.start < ranges[i - 1]!.end) throw new ZipError("overlapping entries");
  }
  return { entries, rejected };
}

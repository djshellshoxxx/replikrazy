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
  maxEntries: number; // file entries (directories counted separately)
  maxDirEntries: number;
  maxFileBytes: number;
  maxTotalBytes: number;
  maxMetadataBytes: number; // central directory size
  maxRatio: number; // uncompressed / compressed, per entry...
  ratioFloorBytes: number; // ...applied only above this expanded size
}

// Research spec MK-ART-003 default envelope (engineering targets, not
// measured capacity). Callers may pass stricter destination limits.
export const DEFAULT_ZIP_LIMITS: ZipLimits = {
  maxArchiveBytes: 128 * 1024 * 1024,
  maxEntries: 10_000,
  maxDirEntries: 100_000,
  maxFileBytes: 32 * 1024 * 1024,
  maxTotalBytes: 256 * 1024 * 1024,
  maxMetadataBytes: 8 * 1024 * 1024,
  maxRatio: 1000,
  ratioFloorBytes: 1024 * 1024,
};

// Diagnostic codes follow the research contract (01_CONTRACTS ErrorCode).
export type ZipCode = "MK_ZIP_CORRUPT" | "MK_ZIP_BOMB" | "MK_ZIP_ENCRYPTED" | "MK_LIMIT_EXCEEDED" | "MK_ENTRY_UNSUPPORTED" | "MK_PATH_INVALID";

export interface RawEntry {
  name: string;
  bytes: Uint8Array;
}

export interface ZipReadResult {
  entries: RawEntry[];
  // Entries refused individually (symlink, encrypted, bad CRC, ...). The
  // archive as a whole is still readable, but callers must surface these.
  rejected: { name: string; reason: string; code: ZipCode }[];
}

// Whole-archive failure. Corruption, inconsistency and limit breaches reject
// the archive (not just one entry): a damaged container cannot be trusted to
// describe the other entries correctly either.
export class ZipError extends Error {
  constructor(message: string, readonly code: ZipCode = "MK_ZIP_CORRUPT") {
    super(message);
  }
}

// Info-ZIP Unicode Path extra field: a second, possibly different, name.
const EXTRA_UNICODE_PATH = 0x7075;

function hasExtra(buf: Uint8Array, start: number, len: number, id: number): boolean {
  const dv = new DataView(buf.buffer, buf.byteOffset + start, len);
  for (let p = 0; p + 4 <= len; ) {
    if (dv.getUint16(p, true) === id) return true;
    p += 4 + dv.getUint16(p + 2, true);
  }
  return false;
}

const SIG_EOCD = 0x06054b50;
const SIG_CEN = 0x02014b50;
const SIG_LOC = 0x04034b50;
const SIG_ZIP64_LOCATOR = 0x07064b50;

export function readZip(buf: Uint8Array, limits: ZipLimits = DEFAULT_ZIP_LIMITS): ZipReadResult {
  if (buf.length > limits.maxArchiveBytes) throw new ZipError("archive exceeds size limit", "MK_LIMIT_EXCEEDED");
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
  // ZIP64 is allowed by the spec only once fixtures prove it; not yet.
  if (eocd >= 20 && u32(eocd - 20) === SIG_ZIP64_LOCATOR) throw new ZipError("ZIP64 archives are not supported", "MK_ENTRY_UNSUPPORTED");
  if (u16(eocd + 4) !== 0 || u16(eocd + 6) !== 0) throw new ZipError("split/multi-disk archives are not supported", "MK_ENTRY_UNSUPPORTED");

  const count = u16(eocd + 10);
  const cenSize = u32(eocd + 12);
  const cenOff = u32(eocd + 16);
  if (count !== u16(eocd + 8)) throw new ZipError("inconsistent entry count");
  if (count > limits.maxEntries + limits.maxDirEntries) throw new ZipError("too many entries", "MK_LIMIT_EXCEEDED");
  if (cenSize > limits.maxMetadataBytes) throw new ZipError("ZIP metadata exceeds limit", "MK_LIMIT_EXCEEDED");
  if (!inBounds(cenOff, cenSize) || cenOff + cenSize > eocd) throw new ZipError("central directory out of bounds");

  const utf8 = new TextDecoder("utf-8", { fatal: true });
  const entries: RawEntry[] = [];
  const rejected: ZipReadResult["rejected"] = [];
  const reject = (name: string, reason: string, code: ZipCode) => rejected.push({ name, reason, code });
  let files = 0;
  let dirs = 0;
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
    const unicodeOverride = hasExtra(buf, p + 46 + nlen, xlen, EXTRA_UNICODE_PATH);
    p += 46 + nlen + xlen + clen;
    if (p > cenOff + cenSize) throw new ZipError("corrupt central directory");

    let name: string;
    try {
      // Bit 11 = UTF-8 names. Without it the name is CP437; we only accept the
      // ASCII subset so the decoded name is unambiguous.
      name = utf8.decode(nameBytes);
    } catch {
      reject("(undecodable name)", "entry name is not valid UTF-8", "MK_PATH_INVALID");
      continue;
    }
    if (!(flags & 0x800) && /[^\x00-\x7f]/.test(name)) {
      reject(name, "non-ASCII name without UTF-8 flag", "MK_PATH_INVALID");
      continue;
    }
    if (unicodeOverride) { reject(name, "ambiguous Unicode path extra field", "MK_PATH_INVALID"); continue; }
    if (seen.has(name)) {
      reject(name, "duplicate entry name", "MK_PATH_INVALID");
      continue;
    }
    seen.add(name);

    const unixMode = madeBy === 3 ? (attrs >>> 16) & 0xf000 : 0;
    const isDir = name.endsWith("/") || unixMode === 0x4000;
    if (isDir) {
      if (usize !== 0) throw new ZipError("directory entry with data");
      if (++dirs > limits.maxDirEntries) throw new ZipError("too many directory entries", "MK_LIMIT_EXCEEDED");
      continue; // directories are implied by file paths
    }
    if (++files > limits.maxEntries) throw new ZipError("too many entries", "MK_LIMIT_EXCEEDED");
    if (unixMode === 0xa000) { reject(name, "symbolic link", "MK_ENTRY_UNSUPPORTED"); continue; }
    if (unixMode !== 0 && unixMode !== 0x8000) { reject(name, "not a regular file", "MK_ENTRY_UNSUPPORTED"); continue; }
    // Bit 0 = encrypted, bit 6 = strong encryption.
    if (flags & 0x41) { reject(name, "encrypted entry", "MK_ZIP_ENCRYPTED"); continue; }
    if (method !== 0 && method !== 8) { reject(name, `unsupported compression method ${method}`, "MK_ENTRY_UNSUPPORTED"); continue; }
    if (csize === 0xffffffff || usize === 0xffffffff || locOff === 0xffffffff) {
      reject(name, "ZIP64 entry", "MK_ENTRY_UNSUPPORTED");
      continue;
    }
    if (usize > limits.maxFileBytes) { reject(name, "file exceeds size limit", "MK_LIMIT_EXCEEDED"); continue; }
    if (method === 0 && csize !== usize) throw new ZipError(`stored entry size mismatch: ${name}`);
    if (usize > limits.ratioFloorBytes && (csize === 0 || usize / csize > limits.maxRatio)) {
      throw new ZipError(`compression ratio exceeds limit: ${name}`, "MK_ZIP_BOMB");
    }
    if (total + usize > limits.maxTotalBytes) throw new ZipError("total uncompressed size exceeds limit", "MK_LIMIT_EXCEEDED");

    if (!inBounds(locOff, 30) || u32(locOff) !== SIG_LOC) throw new ZipError(`bad local header: ${name}`);
    const lnlen = u16(locOff + 26);
    const lxlen = u16(locOff + 28);
    const dataStart = locOff + 30 + lnlen + lxlen;
    if (!inBounds(dataStart, csize) || dataStart + csize > cenOff) throw new ZipError(`entry data out of bounds: ${name}`);
    // The local header repeats the name; a different one means two tools
    // would extract this entry under different paths.
    const localName = buf.subarray(locOff + 30, locOff + 30 + lnlen);
    if (lnlen !== nlen || localName.some((b, i) => b !== nameBytes[i])) throw new ZipError(`local/central name mismatch: ${name}`);
    if (hasExtra(buf, locOff + 30 + lnlen, lxlen, EXTRA_UNICODE_PATH)) {
      reject(name, "ambiguous Unicode path extra field", "MK_PATH_INVALID");
      continue;
    }
    ranges.push({ start: locOff, end: dataStart + csize, name });

    const comp = buf.subarray(dataStart, dataStart + csize);
    let bytes: Uint8Array;
    try {
      // Output buffer is pre-sized to the declared size; fflate cannot grow
      // it, so actual output is bounded during inflation, not checked after.
      bytes = method === 0 ? comp.slice() : inflateSync(comp, { out: new Uint8Array(usize) });
    } catch {
      throw new ZipError(`corrupt compressed data: ${name}`);
    }
    // CRC32 detects corruption only; it is not an authenticity check.
    if (bytes.length !== usize || crc32(bytes) !== crc) throw new ZipError(`size or CRC mismatch: ${name}`);
    total += usize;
    entries.push({ name, bytes });
  }

  // Overlapping local records are a known zip-bomb construction (many central
  // entries pointing at shared data). Refuse the archive outright.
  ranges.sort((a, b) => a.start - b.start);
  for (let i = 1; i < ranges.length; i++) {
    if (ranges[i]!.start < ranges[i - 1]!.end) throw new ZipError("overlapping entries", "MK_ZIP_BOMB");
  }
  return { entries, rejected };
}

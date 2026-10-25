import { buildPayloadZip } from "../src/core/exporter";
import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { DEFAULT_ZIP_LIMITS, readZip, ZipError } from "../src/core/zip";

const code = (f: () => unknown) => { try { f(); } catch (e) { return (e as ZipError).code; } return "no error"; };
import { bytes, craftZip, unicodePathExtra } from "./zipcraft";

const reasons = (z: Uint8Array) => readZip(z).rejected.map((r) => r.reason);

describe("readZip", () => {
  it("reads stored and deflated entries byte-for-byte", () => {
    const bin = new Uint8Array(1000).map((_, i) => (i * 37) & 0xff);
    const z = zipSync({ "index.html": bytes("<h1>hi</h1>"), "img/a.bin": [bin, { level: 9 }], "empty.txt": new Uint8Array() });
    const r = readZip(z);
    expect(r.rejected).toEqual([]);
    const m = Object.fromEntries(r.entries.map((e) => [e.name, e.bytes]));
    expect(m["img/a.bin"]).toEqual(bin);
    expect(new TextDecoder().decode(m["index.html"])).toBe("<h1>hi</h1>");
    expect(m["empty.txt"]!.length).toBe(0);
  });
  it("skips directory entries", () => {
    const r = readZip(craftZip([{ name: "dir/", unixMode: 0o40755 }, { name: "dir/x", data: bytes("x") }]));
    expect(r.entries.map((e) => e.name)).toEqual(["dir/x"]);
  });
  it("rejects symlinks", () => expect(reasons(craftZip([{ name: "l", data: bytes("/etc/passwd"), unixMode: 0o120777 }]))).toEqual(["symbolic link"]));
  it("rejects device/fifo entries", () => expect(reasons(craftZip([{ name: "f", unixMode: 0o010644 }]))).toEqual(["not a regular file"]));
  it("rejects encrypted entries", () => expect(reasons(craftZip([{ name: "e", data: bytes("x"), flags: 0x801 }]))).toEqual(["encrypted entry"]));
  it("rejects unknown methods", () => expect(reasons(craftZip([{ name: "m", data: bytes("x"), method: 12 }]))).toEqual(["unsupported compression method 12"]));
  it("fails the archive on bad CRC", () => expect(() => readZip(craftZip([{ name: "c", data: bytes("abc"), crc: 1 }]))).toThrow("size or CRC mismatch"));
  it("rejects duplicate names", () => expect(reasons(craftZip([{ name: "a", data: bytes("1") }, { name: "a", data: bytes("2") }]))).toEqual(["duplicate entry name"]));
  it("rejects non-UTF-8 names", () => expect(reasons(craftZip([{ name: new Uint8Array([0xff, 0xfe]) }]))).toEqual(["entry name is not valid UTF-8"]));
  it("rejects non-ASCII names without UTF-8 flag", () => expect(reasons(craftZip([{ name: "é", flags: 0 }]))).toEqual(["non-ASCII name without UTF-8 flag"]));
  it("fails the archive on stored size mismatch", () => expect(() => readZip(craftZip([{ name: "s", data: bytes("abc"), usize: 99 }]))).toThrow("stored entry size mismatch"));
  it("rejects strong-encryption flag", () => expect(reasons(craftZip([{ name: "e", data: bytes("x"), flags: 0x840 }]))).toEqual(["encrypted entry"]));
  it("rejects a Unicode-path extra field override", () => expect(reasons(craftZip([{ name: "u", data: bytes("x"), extra: unicodePathExtra("other") }]))).toEqual(["ambiguous Unicode path extra field"]));
  it("fails on local/central name mismatch", () => expect(() => readZip(craftZip([{ name: "good.html", localName: "evil.html", data: bytes("x") }]))).toThrow("local/central name mismatch"));
  it("fails when metadata exceeds the cap", () => {
    const z = craftZip([{ name: "a" }, { name: "b" }]);
    expect(code(() => readZip(z, { ...DEFAULT_ZIP_LIMITS, maxMetadataBytes: 10 }))).toBe("MK_LIMIT_EXCEEDED");
  });
  it("counts directory entries separately", () => {
    const z = craftZip([{ name: "d1/", unixMode: 0o40755 }, { name: "d2/", unixMode: 0o40755 }, { name: "f", data: bytes("1") }]);
    expect(code(() => readZip(z, { ...DEFAULT_ZIP_LIMITS, maxDirEntries: 1 }))).toBe("MK_LIMIT_EXCEEDED");
    expect(readZip(z, { ...DEFAULT_ZIP_LIMITS, maxEntries: 1 }).entries).toHaveLength(1);
  });

  it("fails on high-ratio entries above 1 MiB (bomb) before inflating", () => {
    const z = craftZip([{ name: "bomb", data: new Uint8Array(4 * 1024 * 1024), deflate: true }]);
    expect(code(() => readZip(z))).toBe("MK_ZIP_BOMB");
  });
  it("allows high ratios for small files (below the 1 MiB floor)", () => {
    expect(readZip(craftZip([{ name: "zeros", data: new Uint8Array(500_000), deflate: true }])).entries).toHaveLength(1);
  });
  it("caps output when the header under-declares size", () => {
    // Real data is 10 000 bytes; header claims 100. Output buffer is 100 bytes,
    // so inflation cannot grow past it and the CRC check rejects the entry.
    const data = new Uint8Array(10_000).map((_, i) => i & 0xff);
    expect(code(() => readZip(craftZip([{ name: "lie", data, deflate: true, usize: 100 }])))).toBe("MK_ZIP_CORRUPT");
  });
  it("rejects files over the per-file limit", () => {
    const z = craftZip([{ name: "big", data: new Uint8Array(2048) }]);
    expect(readZip(z, { ...DEFAULT_ZIP_LIMITS, maxFileBytes: 1024 }).rejected[0]!.reason).toBe("file exceeds size limit");
  });
  it("fails on total size over limit", () => {
    const z = craftZip([{ name: "a", data: new Uint8Array(600) }, { name: "b", data: new Uint8Array(600) }]);
    expect(() => readZip(z, { ...DEFAULT_ZIP_LIMITS, maxTotalBytes: 1000 })).toThrow(ZipError);
  });
  it("fails on too many entries", () => {
    const z = craftZip([{ name: "a" }, { name: "b" }, { name: "c" }]);
    expect(() => readZip(z, { ...DEFAULT_ZIP_LIMITS, maxEntries: 2 })).toThrow("too many entries");
  });
  it("fails on overlapping entries", () => {
    const z = craftZip([{ name: "a", data: bytes("xx") }, { name: "a2", data: bytes("xx"), localOffset: 0, localName: "a" }]);
    // Same local record claimed twice: name check fires first or overlap does; both reject the archive.
    expect(() => readZip(z)).toThrow(ZipError);
    const same = craftZip([{ name: "a", data: bytes("xx") }, { name: "b", data: bytes("xx") }]);
    expect(readZip(same).entries).toHaveLength(2);
  });
  it("fails on ZIP64", () => expect(() => readZip(craftZip([{ name: "a" }], { zip64Locator: true }))).toThrow("ZIP64"));
  it("fails on garbage", () => expect(() => readZip(bytes("not a zip at all, definitely not"))).toThrow("not a ZIP"));
  it("fails on oversized archive", () => expect(() => readZip(new Uint8Array(10), { ...DEFAULT_ZIP_LIMITS, maxArchiveBytes: 5 })).toThrow("archive exceeds"));
  it("survives a truncated archive", () => {
    const z = zipSync({ "a.txt": bytes("hello world") });
    expect(() => readZip(z.subarray(0, z.length - 5))).toThrow(ZipError);
  });
});

// New fixtures from the directory/header boundary review; preserve the exact
// malformed inputs rather than teaching the parser to accept their subset.
describe("directory and header boundaries", () => {
  it("validates directory paths even when they carry no file bytes", () => {
    for (const name of ["../bad/", "/absolute/", "a//", "bad%name/"]) {
      expect(readZip(craftZip([{ name, unixMode: 0o40755 }])).rejected[0]?.code).toBe("MK_PATH_INVALID");
    }
  });
  it("cannot disguise a symlink or encrypted entry with a trailing slash", () => {
    expect(readZip(craftZip([{ name: "link/", unixMode: 0o120777 }])).rejected[0]?.code).toBe("MK_ENTRY_UNSUPPORTED");
    expect(readZip(craftZip([{ name: "dir/", unixMode: 0o40755, flags: 0x801 }])).rejected[0]?.code).toBe("MK_ZIP_ENCRYPTED");
  });
  it("checks local directory names and rejects conflicting flags/method/size fields", () => {
    expect(() => readZip(craftZip([{ name: "dir/", localName: "bad/", unixMode: 0o40755 }]))).toThrow("local/central name mismatch");
    for (const offset of [6, 8, 14, 18, 22]) {
      const z = craftZip([{ name: "a", data: bytes("hello") }]);
      z[offset] = z[offset]! ^ 1;
      expect(() => readZip(z)).toThrow("local/central metadata mismatch");
    }
  });
  it("accepts valid stored and deflated empty directories without inventory entries", () => {
    expect(readZip(craftZip([{ name: "a/", unixMode: 0o40755 }, { name: "b/", unixMode: 0o40755, deflate: true }]))).toEqual({ entries: [], rejected: [] });
  });
  it("rejects understated deflate output even when the forged CRC matches the retained prefix", () => {
    const data = bytes("x".repeat(10_000));
    // Known CRC32 of 100 ASCII x bytes, independently fixed as fixture oracle.
    expect(() => readZip(craftZip([{ name: "a", data, deflate: true, usize: 100, crc: 0x5e0e5d8f }]))).toThrow("size or CRC mismatch");
  });
  it("rejects undeclared central records rather than returning a partial archive", () => {
    const z = craftZip([{ name: "a" }, { name: "b" }]);
    const view = new DataView(z.buffer);
    view.setUint16(z.length - 22 + 8, 1, true);
    view.setUint16(z.length - 22 + 10, 1, true);
    expect(() => readZip(z)).toThrow("central directory count/size mismatch");
  });
});

it("rejects nonzero per-entry disk references", () => {
  const z = craftZip([{ name: "index.html", data: bytes("hello") }]);
  const view = new DataView(z.buffer);
  const central = view.getUint32(z.length - 22 + 16, true);
  view.setUint16(central + 34, 1, true);
  expect(() => readZip(z)).toThrow("split/multi-disk");
});


it("checks streaming data descriptor CRC and sizes against the central record", () => {
  for (const relative of [4, 8, 12]) {
    const z = buildPayloadZip([{ path: "index.html", bytes: bytes("hello") }]);
    const view = new DataView(z.buffer);
    const descriptor = 30 + bytes("index.html").length + 5;
    expect(view.getUint32(descriptor, true)).toBe(0x08074b50);
    view.setUint32(descriptor + relative, 99, true);
    expect(() => readZip(z)).toThrow("data descriptor mismatch");
  }
});

it("accepts unsigned ZIP32 data descriptors and rejects missing descriptors", () => {
  const original = buildPayloadZip([{ path: "index.html", bytes: bytes("hello") }]);
  const at = 30 + bytes("index.html").length + 5;
  const remove = (length: number) => {
    const z = new Uint8Array(original.length - length);
    z.set(original.subarray(0, at));
    z.set(original.subarray(at + length), at);
    const view = new DataView(z.buffer);
    view.setUint32(z.length - 22 + 16, new DataView(original.buffer).getUint32(original.length - 22 + 16, true) - length, true);
    return z;
  };
  expect(readZip(remove(4)).entries[0]!.bytes).toEqual(bytes("hello"));
  expect(() => readZip(remove(16))).toThrow("data descriptor mismatch");
});

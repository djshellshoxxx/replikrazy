import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { DEFAULT_ZIP_LIMITS, readZip, ZipError } from "../src/core/zip";
import { bytes, craftZip } from "./zipcraft";

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
  it("rejects bad CRC", () => expect(reasons(craftZip([{ name: "c", data: bytes("abc"), crc: 1 }]))).toEqual(["size or CRC mismatch"]));
  it("rejects duplicate names", () => expect(reasons(craftZip([{ name: "a", data: bytes("1") }, { name: "a", data: bytes("2") }]))).toEqual(["duplicate entry name"]));
  it("rejects non-UTF-8 names", () => expect(reasons(craftZip([{ name: new Uint8Array([0xff, 0xfe]) }]))).toEqual(["entry name is not valid UTF-8"]));
  it("rejects non-ASCII names without UTF-8 flag", () => expect(reasons(craftZip([{ name: "é", flags: 0 }]))).toEqual(["non-ASCII name without UTF-8 flag"]));
  it("rejects stored size mismatch", () => expect(reasons(craftZip([{ name: "s", data: bytes("abc"), usize: 99 }]))).toEqual(["stored entry size mismatch"]));

  it("rejects high-ratio entries (bomb) before inflating", () => {
    const big = new Uint8Array(1_000_000);
    expect(reasons(craftZip([{ name: "bomb", data: big, deflate: true }]))).toEqual(["compression ratio exceeds limit"]);
  });
  it("caps output when the header under-declares size", () => {
    // Real data is 10 000 bytes; header claims 100. Output buffer is 100 bytes,
    // so inflation cannot grow past it and the CRC check rejects the entry.
    const data = new Uint8Array(10_000).map((_, i) => i & 0xff);
    const r = readZip(craftZip([{ name: "lie", data, deflate: true, usize: 100 }]));
    expect(r.entries).toEqual([]);
    expect(r.rejected[0]!.reason).toMatch(/CRC|corrupt|ratio/);
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
    expect(() => readZip(craftZip([{ name: "a", data: bytes("xx") }, { name: "b", data: bytes("xx"), localOffset: 0 }]))).toThrow("overlapping entries");
  });
  it("fails on ZIP64", () => expect(() => readZip(craftZip([{ name: "a" }], { zip64Locator: true }))).toThrow("ZIP64"));
  it("fails on garbage", () => expect(() => readZip(bytes("not a zip at all, definitely not"))).toThrow("not a ZIP"));
  it("fails on oversized archive", () => expect(() => readZip(new Uint8Array(10), { ...DEFAULT_ZIP_LIMITS, maxArchiveBytes: 5 })).toThrow("archive exceeds"));
  it("survives a truncated archive", () => {
    const z = zipSync({ "a.txt": bytes("hello world") });
    expect(() => readZip(z.subarray(0, z.length - 5))).toThrow(ZipError);
  });
});

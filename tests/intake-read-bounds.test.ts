import { describe, expect, it } from "vitest";
import { zipSync } from "fflate";
import { intakeFolder, type PickedFile } from "../src/core/intake";
import { runAnalysis } from "../src/core/pipeline";
import { DEFAULT_ZIP_LIMITS } from "../src/core/zip";

const data = new TextEncoder().encode("ok");

describe("read metadata boundary", () => {
  it.each([NaN, Infinity, -1, 0.5])("refuses invalid folder size %s before reading", async (size) => {
    let reads = 0;
    const r = await intakeFolder([{ webkitRelativePath: "index.html", size, arrayBuffer: async () => { reads++; return data.buffer; } }]);
    expect(reads).toBe(0);
    expect(r.issues[0]?.code).toBe("MK_LIMIT_EXCEEDED");
  });
  it("preflights the complete folder total before any read", async () => {
    let reads = 0;
    const files = ["index.html", "a.txt"].map((webkitRelativePath) => ({ webkitRelativePath, size: 2, arrayBuffer: async () => { reads++; return data.buffer; } }));
    const r = await intakeFolder(files, {}, { ...DEFAULT_ZIP_LIMITS, maxTotalBytes: 3 });
    expect(reads).toBe(0);
    expect(r.files).toEqual([]);
    expect(r.issues[0]?.code).toBe("MK_LIMIT_EXCEEDED");
  });
  it("checks folder bytes against the captured size even if metadata changes during read", async () => {
    let size = 2;
    const file: PickedFile = { webkitRelativePath: "index.html", get size() { return size; }, arrayBuffer: async () => { size = 3; return new Uint8Array(3).buffer; } };
    const r = await intakeFolder([file]);
    expect(r.files).toEqual([]);
    expect(r.issues[0]?.code).toBe("MK_INPUT_CHANGED");
  });
  it("preserves folder size-change detection through the analysis adapter", async () => {
    let size = data.length;
    const blob = { get size() { return size; }, arrayBuffer: async () => { size++; return data.buffer; } } as Blob;
    const r = await runAnalysis({ kind: "folder", entries: [{ path: "index.html", blob }] }, {});
    expect(r.intake.files).toEqual([]);
    expect(r.intake.issues[0]?.code).toBe("MK_INPUT_CHANGED");
  });
  it("rejects ZIP read-length changes before parsing", async () => {
    const zipped = zipSync({ "index.html": data });
    const file = { size: zipped.length - 1, arrayBuffer: async () => zipped.buffer } as Blob;
    const r = await runAnalysis({ kind: "zip", file }, {});
    expect(r.intake.files).toEqual([]);
    expect(r.inv.entries).toEqual([]);
    expect(r.intake.issues[0]?.code).toBe("MK_INPUT_CHANGED");
  });
  it("rejects ZIP metadata changes even if bytes match the original size", async () => {
    const zipped = zipSync({ "index.html": data });
    let size = zipped.length;
    const file = { get size() { return size; }, arrayBuffer: async () => { size++; return zipped.buffer; } } as Blob;
    const r = await runAnalysis({ kind: "zip", file }, {});
    expect(r.intake.files).toEqual([]);
    expect(r.intake.issues[0]?.code).toBe("MK_INPUT_CHANGED");
  });
  it("refuses invalid ZIP metadata without reading", async () => {
    let reads = 0;
    const file = { size: NaN, arrayBuffer: async () => { reads++; return data.buffer; } } as Blob;
    const r = await runAnalysis({ kind: "zip", file }, {});
    expect(reads).toBe(0);
    expect(r.intake.issues[0]?.code).toBe("MK_LIMIT_EXCEEDED");
  });
});

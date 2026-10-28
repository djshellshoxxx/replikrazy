import { expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { canonicalJson, CanonicalError } from "../src/contracts/canonical";
import { parseRecordJson, RecordJsonError } from "../src/contracts/record-json";
import { intakeZip, intakeFolder } from "../src/core/intake";
import { scanBundle, SCAN_LIMITS } from "../src/core/scan";
import { craftZip, bytes } from "./zipcraft";
it.each(["1.0000000000000001", "1e-400", "-1e-400", "9007199254740993"])("rejects numeric source rounded into integer %s", source => {
  expect(() => parseRecordJson(source)).toThrow(RecordJsonError);
});
it.each(["1.0", "1e3", "10e-1", "-1.25e2", "0e999999", "0.1"])("preserves exact numeric semantics %s", source => {
  expect(parseRecordJson(source)).toBe(JSON.parse(source));
});
it("rejects sparse canonical arrays rather than erasing holes", () => {
  for (const sparse of [Array(1), Array(2), [1, , 3]]) expect(() => canonicalJson(sparse)).toThrow(CanonicalError);
});
it("preserves leading BOM filename characters and folder/ZIP parity", async () => {
  const path = "\ufeffindex.html", data = bytes("ok");
  const zipped = intakeZip(craftZip([{ name: path, data }, { name: "index.html", data }]));
  const folder = await intakeFolder([{ webkitRelativePath: path, size: data.length, arrayBuffer: async () => data.buffer },
    { webkitRelativePath: "index.html", size: data.length, arrayBuffer: async () => data.buffer }]);
  expect(zipped.issues).toEqual([]);
  expect(zipped.files).toEqual(folder.files);
  expect(zipped.files.map(f => f.path)).toContain(path);
});
it.each([['script', 'fetch("a");', 150000], ['style', 'url(a)', 250000]] as const)("bounds dense inline %s without call-stack overflow", (tag, atom, count) => {
  const data = bytes(`<${tag}>${atom.repeat(count)}</${tag}>`);
  expect(data.length).toBeLessThan(SCAN_LIMITS.maxTextBytes);
  const start = performance.now();
  const r = scanBundle([{ path: "index.html", bytes: data }]);
  expect(r.truncated).toBe(true);
  expect(r.missing.length).toBeLessThanOrEqual(SCAN_LIMITS.maxRefsPerFile);
  expect(performance.now() - start).toBeLessThan(3000);
});
it("exports identical payload ZIPs across negative and positive timezones", () => {
  const program = `import {createServer} from 'vite';
    const s=await createServer({logLevel:"silent",server:{middlewareMode:true}});
    try { const {buildPayloadZip}=await s.ssrLoadModule('/src/core/exporter.ts');
      console.log(Buffer.from(buildPayloadZip([{path:'index.html',bytes:new TextEncoder().encode('ok')}])).toString('hex'));
    } finally {await s.close();}`;
  const output = ["America/Los_Angeles", "UTC", "Asia/Tokyo"].map(TZ => execFileSync(process.execPath, ["--input-type=module", "-e", program], { env: { ...process.env, TZ }, encoding: "utf8", timeout: 10000 }).trim());
  expect(output[0]).toBe(output[1]); expect(output[2]).toBe(output[1]);
});

it("bounds long fractional counter spellings without exponent expansion", () => {
  const start = performance.now();
  expect(() => parseRecordJson("1." + "0".repeat(500000) + "1")).toThrow(RecordJsonError);
  expect(performance.now() - start).toBeLessThan(3000);
});

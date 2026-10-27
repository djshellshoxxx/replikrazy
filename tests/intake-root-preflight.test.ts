import { craftZip } from "./zipcraft";
import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { intakeFolder, intakeZip } from "../src/core/intake";

const bytes = new TextEncoder().encode("public");
const folder = (paths: string[], stripRoot: boolean) => intakeFolder(paths.map((path) => ({
  webkitRelativePath: path, size: bytes.length, arrayBuffer: async () => bytes.slice().buffer,
})), { stripRoot });

describe("explicit root preflight", () => {
  for (const kind of ["folder", "zip"] as const) {
    const read = async (paths: string[], stripRoot: boolean) => kind === "folder"
      ? folder(paths, stripRoot)
      : intakeZip(zipSync(Object.fromEntries(paths.map((p) => [p, bytes]))), { stripRoot });
    it(`${kind}: validates payload path length after an explicit safe wrapper choice`, async () => {
      const path = `${"w".repeat(100)}/${"a".repeat(100)}/${"b".repeat(100)}/index.html`;
      const initial = await read([path], false);
      expect(initial.candidateRoot).toBe("w".repeat(100));
      expect(initial.issues.some((i) => i.code === "MK_PATH_INVALID")).toBe(true);
      const chosen = await read([path], true);
      expect(chosen.issues).toEqual([]);
      expect(chosen.strippedRoot).toBe("w".repeat(100));
      expect(chosen.files[0]!.path).toBe(path.slice(101));
      expect(chosen.files[0]!.bytes).toEqual(bytes);
    });
    it(`${kind}: does not infer a common root after discarding an invalid sibling`, async () => {
      const r = await read(["site/index.html", "other/bad?.html"], true);
      expect(r.candidateRoot).toBeNull();
      expect(r.strippedRoot).toBeNull();
      expect(r.files[0]!.path).toBe("site/index.html");
      expect(r.issues.some((i) => i.code === "MK_PATH_INVALID")).toBe(true);
    });
    for (const wrapper of ["..", ".", "bad?", "CON", "bad\\root"]) {
      it(`${kind}: never strips unsafe wrapper ${JSON.stringify(wrapper)}`, async () => {
        const r = await read([`${wrapper}/index.html`], true);
        expect(r.strippedRoot).toBeNull();
        expect(r.files).toEqual([]);
        expect(r.issues.some((i) => i.code === "MK_PATH_INVALID")).toBe(true);
      });
    }
  }
});

it("applies the same explicit root to ZIP directory records", () => {
  const root = "w".repeat(100), nested = `${"a".repeat(100)}/${"b".repeat(100)}`;
  const r = intakeZip(craftZip([{ name: `${root}/` }, { name: `${root}/${nested}/` },
    { name: `${root}/${nested}/index.html`, data: bytes }]), { stripRoot: true });
  expect(r.issues).toEqual([]);
  expect(r.files.map((f) => f.path)).toEqual([`${nested}/index.html`]);
});
it("does not hide an invalid or unrelated ZIP directory during root selection", () => {
  for (const directory of ["other/", "site/../", "site/bad?/", "site//"]) {
    const r = intakeZip(craftZip([{ name: directory }, { name: "site/index.html", data: bytes }]), { stripRoot: true });
    if (directory === "other/") expect(r.strippedRoot).toBeNull();
    else expect(r.issues.some((i) => i.code === "MK_PATH_INVALID")).toBe(true);
  }
});

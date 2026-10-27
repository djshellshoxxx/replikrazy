import { describe, expect, it } from "vitest";
import { artifactId, validateManifest, type ArtifactManifest } from "../src/contracts/manifest";

const file = (path = "index.html") => ({ path, size: 0, sha256: "a".repeat(64) });
const manifest = (files = [file()]) => ({ schemaVersion: "1.0", appId: "site", files, entrypoint: "index.html" });

describe("manifest admission boundary", () => {
  it("rejects inherited manifest fields", () => {
    expect(validateManifest(Object.create(manifest())).length).toBeGreaterThan(0);
  });
  it("rejects arrays decorated as manifests", () => {
    expect(validateManifest(Object.assign([], manifest())).length).toBeGreaterThan(0);
  });
  it("requires each file field to be its own property", () => {
    const forged = Object.assign(Object.create({ path: "index.html" }), { size: 0, sha256: "a".repeat(64), extra: true });
    expect(validateManifest(manifest([forged])).length).toBeGreaterThan(0);
  });
  it("rejects decorated arrays as file records", () => {
    expect(validateManifest(manifest([Object.assign([], file())])).length).toBeGreaterThan(0);
  });
  it("bounds file records before inspecting entries", () => {
    const files = new Array(10_001);
    Object.defineProperty(files, 0, { get() { throw new Error("must reject count before entry access"); } });
    expect(validateManifest(manifest(files))).toContain("files exceed intake count limit");
  });
  it("rejects case-fold collisions even when byte order is valid", () => {
    expect(validateManifest(manifest([file("INDEX.html"), file()]))).toContain("paths collide under intake case folding");
  });
  it("rejects file/directory conflicts", () => {
    expect(validateManifest(manifest([file("a"), file("a/b"), file()]))).toContain("path is both a file and a folder");
  });
  it("refuses to hash an unsupported or invalid manifest", async () => {
    const unsupported = { ...manifest(), schemaVersion: "2.0" } as unknown as ArtifactManifest;
    await expect(artifactId(unsupported)).rejects.toThrow("invalid artifact manifest");
    await expect(artifactId(manifest([file("INDEX.html"), file()]) as ArtifactManifest)).rejects.toThrow("invalid artifact manifest");
  });
  it("accepts exact null-prototype JSON records", () => {
    const f = Object.assign(Object.create(null), file());
    expect(validateManifest(Object.assign(Object.create(null), manifest([f])))).toEqual([]);
  });
});

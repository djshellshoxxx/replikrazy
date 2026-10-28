import { it, expect } from "vitest";
import { exportArtifactRecovery } from "../src/contracts/recovery-export";
import { inspectRecoverySource } from "../src/contracts/recovery-source";
import { artifactId, buildManifest } from "../src/contracts/manifest";
import { buildInventory } from "../src/core/inventory";
it("exports an artifact-only record that the existing reader can inspect", async () => {
  const inv = await buildInventory([{ path: "index.html", bytes: new TextEncoder().encode("public") }]);
  const m = buildManifest("saved", inv.entries, "index.html"); if (!m.ok) throw Error();
  const handle = { artifactId: await artifactId(m.manifest), manifest: m.manifest, totalBytes: inv.totalBytes, fileCount: 1,
    sourceKind: "zip", capturedAt: "2026-10-28T00:00:00.000Z" };
  const r = await exportArtifactRecovery(handle, "2026-10-28T01:00:00.000Z");
  expect(r.ok).toBe(true); if (!r.ok) return;
  const parsed = JSON.parse(r.value);
  expect(parsed.artifacts).toEqual([handle]);
  for (const field of ["plans", "operations", "provenance"]) expect(parsed[field]).toEqual([]);
  expect((await inspectRecoverySource(r.value)).result.ok).toBe(true);
  expect(await exportArtifactRecovery({ ...handle, artifactId: `sha256:${"0".repeat(64)}` }, parsed.exportedAt)).toMatchObject({ ok: false });
  expect(await exportArtifactRecovery(handle, "bad-time")).toMatchObject({ ok: false });
});

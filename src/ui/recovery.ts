import type { AnalysisInput } from "../core/pipeline";
import type { ArtifactManifest } from "../contracts/manifest";
import { RecoveryTask } from "./recovery-task";
import type { ErrorCode } from "../contracts/diagnostic";
export interface RecoverySelection { input: AnalysisInput; apply(manifest: ArtifactManifest, current: () => boolean): Promise<boolean> }
export function mountRecovery(selection: () => RecoverySelection | null, saveMetadata: (current: () => boolean) => Promise<boolean>) {
  const input = document.querySelector<HTMLInputElement>("#recovery-file")!;
  const profile = document.querySelector<HTMLInputElement>("#recovery-profile")!;
  const output = document.querySelector<HTMLElement>("#recovery-result")!;
  const cancel = document.querySelector<HTMLButtonElement>("#recovery-cancel")!;
  const backup = document.querySelector<HTMLButtonElement>("#recovery-source")!;
  const restore = document.querySelector<HTMLButtonElement>("#recovery-restore")!;
  const artifact = document.querySelector<HTMLInputElement>("#recovery-artifact")!;
  const task = new RecoveryTask(() => new Worker(new URL("./recovery-worker.ts", import.meta.url), { type: "module" }));
  let current: File | null = null, generation = 0;
  const error = (code: ErrorCode) => {
    if (code === "MK_CANCELLED") return "Inspection cancelled. The original file is still available to save.";
    if (code === "MK_LIMIT_EXCEEDED") return "Inspection stopped at a size, work or time limit (10 MiB, 60 seconds). The original file is unchanged.";
    if (code === "MK_PRIVATE_DATA") return "This record contains recognizable private material. It was not applied; no source contents are displayed.";
    if (code === "MK_SCHEMA_UNSUPPORTED" || code === "MK_CAPABILITY_UNSUPPORTED") return "Unsupported record version, mode or browser capability. The original file is unchanged and nothing was applied.";
    if (code === "MK_HASH_MISMATCH") return "The selected bytes or recorded identity do not match. Nothing was applied.";
    if (code === "MK_INPUT_CHANGED") return "The file changed while reading. Select it again.";
    if (code === "MK_PLAN_CHANGED") return "The record does not meet the selected local profile's plan timing rules. Nothing was applied.";
    return "Malformed or inconsistent recovery record. Nothing was applied; the original file is unchanged.";
  };
  const inspect = async (matching = false) => {
    if (!current) return;
    const snapshot = matching ? selection() : null;
    if (matching && !snapshot) { output.textContent = "Load a valid local site and choose its root and entry page first. Nothing was restored."; return; }
    const artifactIndex = Number(artifact.value) - 1;
    if (matching && (!Number.isSafeInteger(artifactIndex) || artifactIndex < 0 || artifactIndex >= 100)) { output.textContent = "Choose an artifact number from 1 to 100. Nothing was restored."; return; }
    const revision = ++generation;
    output.textContent = "Inspecting locally…"; cancel.hidden = false; backup.disabled = false;
    const result = await task.run(current, profile.checked, snapshot ? { artifactIndex, input: snapshot.input } : undefined);
    if (revision !== generation) return;
    const returnFocus = document.activeElement === cancel;
    cancel.hidden = true;
    output.textContent = result.ok
      ? `Recognized metadata: ${result.value.artifacts} artifacts, ${result.value.plans} plans, ${result.value.operations} operations, ${result.value.provenance} owner claims. ${result.value.profileChecked ? "Local profile checks passed. " : "No local profile was selected. "}Nothing was restored. Payload bytes, signatures and publisher trust are not verified.`
      : error(result.error.code);
    if (result.ok && snapshot && result.value.matchedManifest) {
      const applied = await snapshot.apply(result.value.matchedManifest, () => revision === generation);
      if (revision !== generation) return;
      output.textContent = applied ? "Exact local payload match. Artifact identity restored; review public data again before export. Plans, consent, provider status, signatures and publisher trust were not restored." : "The selected site changed. Nothing was restored; match the current files again.";
    }
    if (returnFocus) input.focus();
  };
  const clear = () => {
    generation++; task.cancel(); current = null; input.value = ""; profile.checked = false;
    cancel.hidden = true; backup.disabled = true; restore.disabled = true; output.textContent = "No recovery file selected.";
  };
  input.addEventListener("change", () => { current = input.files?.[0] ?? null; if (current) { restore.disabled = false; void inspect(); } else clear(); });
  profile.addEventListener("change", () => { if (current) void inspect(); });
  document.querySelector("#recovery-save")!.addEventListener("click", async () => {
    const revision = ++generation; task.cancel(); cancel.hidden = true;
    const saved = await saveMetadata(() => revision === generation);
    if (revision !== generation) return;
    output.textContent = saved ? "Recovery metadata saved. Keep the actual site files too; no plans, consent or provider state were exported." : "Load a valid local site first. If the selection changed, try saving its metadata again.";
  });
  restore.addEventListener("click", () => void inspect(true));
  artifact.addEventListener("change", () => { generation++; task.cancel(); cancel.hidden = true; output.textContent = "Artifact selection changed. Match again to restore its identity."; });
  cancel.addEventListener("click", () => task.cancel());
  document.querySelector("#recovery-clear")!.addEventListener("click", clear);
  backup.addEventListener("click", () => {
    if (!current) return;
    // Original immutable Blob: no decoding, serialization, renaming of entries,
    // or normalization. The record never enters localStorage or active state.
    const url = URL.createObjectURL(current);
    const a = document.createElement("a"); a.href = url; a.download = "replikrazy-original-recovery.json"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  });
}

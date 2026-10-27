import { RecoveryTask } from "./recovery-task";
import type { ErrorCode } from "../contracts/diagnostic";
export function mountRecovery() {
  const input = document.querySelector<HTMLInputElement>("#recovery-file")!;
  const profile = document.querySelector<HTMLInputElement>("#recovery-profile")!;
  const output = document.querySelector<HTMLElement>("#recovery-result")!;
  const cancel = document.querySelector<HTMLButtonElement>("#recovery-cancel")!;
  const backup = document.querySelector<HTMLButtonElement>("#recovery-source")!;
  const task = new RecoveryTask(() => new Worker(new URL("./recovery-worker.ts", import.meta.url), { type: "module" }));
  let current: File | null = null, generation = 0;
  const error = (code: ErrorCode) => {
    if (code === "MK_CANCELLED") return "Inspection cancelled. The original file is still available to save.";
    if (code === "MK_LIMIT_EXCEEDED") return "Inspection stopped at a size, work or time limit (10 MiB, 60 seconds). The original file is unchanged.";
    if (code === "MK_PRIVATE_DATA") return "This record contains recognizable private material. It was not applied; no source contents are displayed.";
    if (code === "MK_SCHEMA_UNSUPPORTED" || code === "MK_CAPABILITY_UNSUPPORTED") return "Unsupported record version, mode or browser capability. The original file is unchanged and nothing was applied.";
    if (code === "MK_HASH_MISMATCH") return "A recorded identity does not match its metadata. Nothing was applied.";
    if (code === "MK_INPUT_CHANGED") return "The file changed while reading. Select it again.";
    if (code === "MK_PLAN_CHANGED") return "The record does not meet the selected local profile's plan timing rules. Nothing was applied.";
    return "Malformed or inconsistent recovery record. Nothing was applied; the original file is unchanged.";
  };
  const inspect = async () => {
    if (!current) return;
    const revision = ++generation;
    output.textContent = "Inspecting locally…"; cancel.hidden = false; backup.disabled = false;
    const result = await task.run(current, profile.checked);
    if (revision !== generation) return;
    cancel.hidden = true;
    output.textContent = result.ok
      ? `Recognized metadata: ${result.value.artifacts} artifacts, ${result.value.plans} plans, ${result.value.operations} operations, ${result.value.provenance} owner claims. ${result.value.profileChecked ? "Local profile checks passed. " : "No local profile was selected. "}Nothing was restored. Payload bytes, signatures and publisher trust are not verified.`
      : error(result.error.code);
  };
  const clear = () => {
    generation++; task.cancel(); current = null; input.value = ""; profile.checked = false;
    cancel.hidden = true; backup.disabled = true; output.textContent = "No recovery file selected.";
  };
  input.addEventListener("change", () => { current = input.files?.[0] ?? null; if (current) void inspect(); else clear(); });
  profile.addEventListener("change", () => { if (current) void inspect(); });
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

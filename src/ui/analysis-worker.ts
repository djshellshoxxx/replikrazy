// Runs the analysis pipeline off the UI thread. The page cancels by calling
// worker.terminate(), which stops work immediately and frees its memory.
// Errors are reported as a fixed message: exception text could echo imported
// names or contents.

import { analysisError, inputError } from "../contracts/diagnostic";
import { runAnalysis, type AnalysisInput, type AnalysisOptions } from "../core/pipeline";

self.onmessage = async (ev: MessageEvent<{ input: AnalysisInput; opts: AnalysisOptions }>) => {
  try {
    const progress = (stage: string, done: number, total: number) => self.postMessage({ type: "progress", stage, done, total });
    const result = ev.data.opts.requireEntrypoint
      ? await runAnalysis(ev.data.input, { ...ev.data.opts, requireEntrypoint: true }, progress)
      : await runAnalysis(ev.data.input, ev.data.opts, progress);
    if ("kind" in result) {
      const fatal = result.issues.find(i => i.severity === "error" && (i.code === "MK_INPUT_CHANGED" || (!result.entries.length && !result.candidateRoot)));
      self.postMessage(fatal ? { type: "error", error: inputError(fatal.code) } : { type: "preflight", result }); return;
    }
    const fatal = result.intake.issues.find((i) => i.severity === "error" && ((result.intake.files.length === 0 && result.intake.candidateRoot === null) || i.code === "MK_INPUT_CHANGED"));
    if (fatal) {
      self.postMessage({ type: "error", error: inputError(fatal.code) });
      return;
    }
    // Transfer file buffers instead of copying them.
    const transfer = [...new Set(result.intake.files.map((f) => f.bytes.buffer as ArrayBuffer))];
    (self as unknown as Worker).postMessage({ type: "done", result }, transfer);
  } catch (error) {
    self.postMessage({ type: "error", error: analysisError(error instanceof DOMException && error.name === "NotReadableError" ? "changed" : "failed") });
  }
};

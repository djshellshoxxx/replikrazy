// Runs the analysis pipeline off the UI thread. The page cancels by calling
// worker.terminate(), which stops work immediately and frees its memory.
// Errors are reported as a fixed message: exception text could echo imported
// names or contents.

import { runAnalysis, type AnalysisInput } from "../core/pipeline";
import type { IntakeOptions } from "../core/intake";

self.onmessage = async (ev: MessageEvent<{ input: AnalysisInput; opts: IntakeOptions }>) => {
  try {
    const result = await runAnalysis(ev.data.input, ev.data.opts, (stage, done, total) => {
      self.postMessage({ type: "progress", stage, done, total });
    });
    // Transfer file buffers instead of copying them.
    const transfer = [...new Set(result.intake.files.map((f) => f.bytes.buffer as ArrayBuffer))];
    (self as unknown as Worker).postMessage({ type: "done", result }, transfer);
  } catch {
    self.postMessage({ type: "error" });
  }
};

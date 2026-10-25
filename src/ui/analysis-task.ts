import type { AnalysisInput, AnalysisOptions, AnalysisResult, Progress } from "../core/pipeline";

import { analysisError, inputError, type MKError, type Result } from "../contracts/diagnostic";

// Each view owns its worker. Never run untrusted synchronous scanning on the
// page thread: cancellation and the time budget require a terminable worker.
export class AnalysisTask {
  private stop: (() => void) | null = null;
  constructor(
    private readonly createWorker: () => Worker,
    private readonly budgetMs = 60_000,
    private readonly now: () => number = Date.now,
  ) {}

  cancel() { this.stop?.(); }

  run(input: AnalysisInput, opts: AnalysisOptions, progress: Progress): Promise<Result<AnalysisResult>> {
    this.cancel();
    return new Promise((resolve) => {
      let worker: Worker;
      try { worker = this.createWorker(); }
      catch { resolve({ ok: false, error: analysisError("unavailable") }); return; }
      const deadline = this.now() + this.budgetMs;
      let settled = false;
      const finish = (error?: MKError, result?: AnalysisResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        worker.terminate();
        if (this.stop === cancel) this.stop = null;
        if (error) resolve({ ok: false, error }); else resolve({ ok: true, value: result! });
      };
      const cancel = () => finish(analysisError("cancelled"));
      const timer = setTimeout(() => finish(analysisError("timeout")), this.budgetMs);
      this.stop = cancel;
      worker.onmessage = (ev: MessageEvent) => {
        if (settled) return;
        // Timers can be delayed by tab suspension; reject late messages too.
        if (this.now() >= deadline) { finish(analysisError("timeout")); return; }
        const m = ev.data;
        if (m.type === "progress") progress(m.stage, m.done, m.total);
        else if (m.type === "done") finish(undefined, m.result);
        else finish(m.error?.messageKey === "analysis.input-changed" ? analysisError("changed") : inputError(m.error?.code));
      };
      worker.onerror = () => finish(analysisError("failed"));
      worker.onmessageerror = () => finish(analysisError("failed"));
      try { worker.postMessage({ input, opts }); }
      catch { finish(analysisError("failed")); }
    });
  }
}

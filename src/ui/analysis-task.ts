import type { AnalysisInput, AnalysisOptions, AnalysisResult, Progress } from "../core/pipeline";

import { analysisError, inputError, isRecord, isUInt, type MKError, type Result } from "../contracts/diagnostic";

// Each view owns its worker. Never run untrusted synchronous scanning on the
// page thread: cancellation and the time budget require a terminable worker.
export class AnalysisTask {
  private stop: (() => void) | null = null;
  constructor(
    private readonly createWorker: () => Worker,
    private readonly budgetMs = 60_000,
    private readonly now: () => number = Date.now,
    private readonly monotonicNow: () => number = () => performance.now(),
  ) {}

  cancel() { this.stop?.(); }

  run(input: AnalysisInput, opts: AnalysisOptions, progress: Progress): Promise<Result<AnalysisResult>> {
    this.cancel();
    return new Promise((resolve) => {
      let worker: Worker;
      try { worker = this.createWorker(); }
      catch { resolve({ ok: false, error: analysisError("unavailable") }); return; }
      const deadline = this.now() + this.budgetMs;
      const monotonicDeadline = this.monotonicNow() + this.budgetMs;
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
        if (this.now() >= deadline || this.monotonicNow() >= monotonicDeadline) { finish(analysisError("timeout")); return; }
        const m = ev.data;
        if (!isRecord(m)) { finish(analysisError("failed")); return; }
        if (m.type === "progress") {
          if (!["reading", "hashing", "scanning"].includes(m.stage as string)
            || !isUInt(m.done) || !isUInt(m.total) || m.done > m.total) {
            finish(analysisError("failed")); return;
          }
          try { progress(m.stage as Parameters<Progress>[0], m.done, m.total); }
          catch { finish(analysisError("failed")); }
        } else if (m.type === "done" && isRecord(m.result)) {
          // Internal result shape is owned by the pipeline; this checks the
          // message envelope, not a general-purpose artifact import schema.
          finish(undefined, m.result as unknown as AnalysisResult);
        } else if (m.type === "error" && isRecord(m.error)) {
          finish(m.error.messageKey === "analysis.input-changed" ? analysisError("changed") : inputError(m.error.code));
        } else finish(analysisError("failed"));
      };
      worker.onerror = () => finish(analysisError("failed"));
      worker.onmessageerror = () => finish(analysisError("failed"));
      try { worker.postMessage({ input, opts }); }
      catch { finish(analysisError("failed")); }
    });
  }
}

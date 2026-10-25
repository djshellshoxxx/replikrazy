import type { AnalysisInput, AnalysisOptions, AnalysisResult, Progress } from "../core/pipeline";

export class AnalysisStopped extends Error {
  constructor(readonly reason: "cancelled" | "timeout" | "unavailable" | "failed") {
    super(reason);
  }
}

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

  run(input: AnalysisInput, opts: AnalysisOptions, progress: Progress): Promise<AnalysisResult> {
    this.cancel();
    return new Promise((resolve, reject) => {
      let worker: Worker;
      try { worker = this.createWorker(); }
      catch { reject(new AnalysisStopped("unavailable")); return; }
      const deadline = this.now() + this.budgetMs;
      let settled = false;
      const finish = (error?: AnalysisStopped, result?: AnalysisResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        worker.terminate();
        if (this.stop === cancel) this.stop = null;
        if (error) reject(error); else resolve(result!);
      };
      const cancel = () => finish(new AnalysisStopped("cancelled"));
      const timer = setTimeout(() => finish(new AnalysisStopped("timeout")), this.budgetMs);
      this.stop = cancel;
      worker.onmessage = (ev: MessageEvent) => {
        if (settled) return;
        // Timers can be delayed by tab suspension; reject late messages too.
        if (this.now() >= deadline) { finish(new AnalysisStopped("timeout")); return; }
        const m = ev.data;
        if (m.type === "progress") progress(m.stage, m.done, m.total);
        else if (m.type === "done") finish(undefined, m.result);
        else finish(new AnalysisStopped("failed"));
      };
      worker.onerror = () => finish(new AnalysisStopped("failed"));
      worker.onmessageerror = () => finish(new AnalysisStopped("failed"));
      try { worker.postMessage({ input, opts }); }
      catch { finish(new AnalysisStopped("failed")); }
    });
  }
}

import { isErrorCode, isRecord, isUInt, type ErrorCode, type Result } from "../contracts/diagnostic";
import { RECORD_MAX_BYTES } from "../contracts/record-json";
export interface RecoverySummary { artifacts: number; plans: number; operations: number; provenance: number; profileChecked: boolean }
export const recoveryError = (code: ErrorCode): Result<never> => ({ ok: false, error: { code, messageKey: "recovery.unapplied", params: {}, retry: "after-user-action" } });
const summary = (x: unknown): x is RecoverySummary => isRecord(x) && Object.keys(x).length === 5
  && ["artifacts", "plans", "operations", "provenance"].every((k) => isUInt(x[k]))
  && (x.artifacts as number) <= 100 && (x.plans as number) <= 100 && (x.operations as number) <= 1000
  && (x.provenance as number) <= 200_000 && typeof x.profileChecked === "boolean";
export class RecoveryTask {
  private stop: (() => void) | null = null;
  constructor(private readonly createWorker: () => Worker) {}
  cancel() { this.stop?.(); }
  run(file: Blob, profileChecked: boolean): Promise<Result<RecoverySummary>> {
    this.cancel();
    if (!Number.isSafeInteger(file.size) || file.size < 0 || file.size > RECORD_MAX_BYTES) return Promise.resolve(recoveryError("MK_LIMIT_EXCEEDED"));
    return new Promise((resolve) => {
      let worker: Worker;
      try { worker = this.createWorker(); } catch { resolve(recoveryError("MK_CAPABILITY_UNSUPPORTED")); return; }
      const deadline = Date.now() + 60_000, monotonicDeadline = performance.now() + 60_000;
      let settled = false;
      const finish = (result: Result<RecoverySummary>) => {
        if (settled) return;
        settled = true; clearTimeout(timer); worker.terminate();
        if (this.stop === cancel) this.stop = null;
        resolve(result);
      };
      const cancel = () => finish(recoveryError("MK_CANCELLED"));
      const timer = setTimeout(() => finish(recoveryError("MK_LIMIT_EXCEEDED")), 60_000);
      this.stop = cancel;
      worker.onmessage = (event) => {
        if (settled) return;
        if (Date.now() >= deadline || performance.now() >= monotonicDeadline) { finish(recoveryError("MK_LIMIT_EXCEEDED")); return; }
        const r: unknown = event.data;
        if (isRecord(r) && r.ok === true && summary(r.value) && r.value.profileChecked === profileChecked) finish({ ok: true, value: r.value });
        else if (isRecord(r) && r.ok === false && isRecord(r.error) && isErrorCode(r.error.code)) finish(recoveryError(r.error.code));
        else finish(recoveryError("MK_INTERNAL"));
      };
      worker.onerror = worker.onmessageerror = () => finish(recoveryError("MK_INTERNAL"));
      try { worker.postMessage({ file, profileChecked }); } catch { finish(recoveryError("MK_INTERNAL")); }
    });
  }
}

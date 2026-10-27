import { afterEach, describe, expect, it, vi } from "vitest";
import { AnalysisTask } from "../src/ui/analysis-task";

class FakeWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  terminate = vi.fn();
  postMessage = vi.fn();
  send(data: unknown) { this.onmessage?.({ data } as MessageEvent); }
}
const input = { kind: "zip" as const, file: new Blob() };
const setup = (now?: () => number) => {
  const workers: FakeWorker[] = [];
  const task = new AnalysisTask(() => {
    const w = new FakeWorker(); workers.push(w); return w as unknown as Worker;
  }, 60_000, now);
  return { task, workers };
};
afterEach(() => vi.useRealTimers());

describe("analysis worker lifecycle", () => {
  it("terminates a cancelled worker and ignores queued progress and results", async () => {
    const { task, workers } = setup();
    const progress = vi.fn();
    const result = task.run(input, {}, progress);
    const rejected = expect(result).resolves.toMatchObject({ ok: false, error: { code: "MK_CANCELLED", messageKey: "analysis.cancelled" } });
    task.cancel();
    workers[0]!.send({ type: "progress", stage: "reading", done: 1, total: 1 });
    workers[0]!.send({ type: "done", result: {} });
    await rejected;
    expect(progress).not.toHaveBeenCalled();
    expect(workers[0]!.terminate).toHaveBeenCalledTimes(1);
  });
  it("supersedes one job without letting its queued result cancel the replacement", async () => {
    const { task, workers } = setup();
    const first = expect(task.run(input, {}, vi.fn())).resolves.toMatchObject({ ok: false, error: { code: "MK_CANCELLED", messageKey: "analysis.cancelled" } });
    const second = task.run(input, {}, vi.fn());
    workers[0]!.send({ type: "done", result: { stale: true } });
    workers[1]!.send({ type: "done", result: { current: true } });
    await first;
    await expect(second).resolves.toEqual({ ok: true, value: { current: true } });
  });
  it("stops a worker that never responds at the unchanged 60 second limit", async () => {
    vi.useFakeTimers();
    const { task, workers } = setup();
    const result = expect(task.run(input, {}, vi.fn())).resolves.toMatchObject({ ok: false, error: { code: "MK_LIMIT_EXCEEDED", messageKey: "analysis.time-limit" } });
    vi.advanceTimersByTime(60_000);
    await result;
    expect(workers[0]!.terminate).toHaveBeenCalledTimes(1);
  });
  it("rejects a late result before a suspended timer gets its turn", async () => {
    let time = 0;
    const { task, workers } = setup(() => time);
    const result = expect(task.run(input, {}, vi.fn())).resolves.toMatchObject({ ok: false, error: { code: "MK_LIMIT_EXCEEDED", messageKey: "analysis.time-limit" } });
    time = 60_001;
    workers[0]!.send({ type: "done", result: {} });
    await result;
  });
  it("keeps cancellation local to its owner", async () => {
    const a = setup(), b = setup();
    const stopped = expect(a.task.run(input, {}, vi.fn())).resolves.toMatchObject({ ok: false, error: { code: "MK_CANCELLED", messageKey: "analysis.cancelled" } });
    const live = b.task.run(input, {}, vi.fn());
    a.task.cancel();
    b.workers[0]!.send({ type: "done", result: {} });
    await stopped;
    await expect(live).resolves.toEqual({ ok: true, value: {} });
  });
  it("fails closed if workers are unavailable", async () => {
    const task = new AnalysisTask(() => { throw new Error("worker denied"); });
    await expect(task.run(input, {}, vi.fn())).resolves.toMatchObject({ ok: false, error: { code: "MK_CAPABILITY_UNSUPPORTED", messageKey: "analysis.worker-unavailable" } });
  });
  it("cleans up failed message dispatch", async () => {
    const w = new FakeWorker();
    w.postMessage.mockImplementation(() => { throw new Error("clone failed"); });
    const task = new AnalysisTask(() => w as unknown as Worker);
    await expect(task.run(input, {}, vi.fn())).resolves.toMatchObject({ ok: false, error: { code: "MK_INTERNAL", messageKey: "analysis.failed" } });
    expect(w.terminate).toHaveBeenCalledTimes(1);
  });
});


it("maps worker errors to safe typed records without forwarding raw params or details", async () => {
  const { task, workers } = setup();
  const result = task.run(input, {}, vi.fn());
  workers[0]!.send({ type: "error", error: { code: "MK_INPUT_CHANGED", messageKey: "unsafe", params: { secret: "private-value" }, safeDetail: "private-value" } });
  await expect(result).resolves.toEqual({ ok: false, error: { code: "MK_INPUT_CHANGED", messageKey: "input.input-changed", params: {}, retry: "after-user-action" } });
  expect(JSON.stringify(await result)).not.toContain("private-value");
});

it("maps unrecognized worker error codes to a fixed internal error", async () => {
  const { task, workers } = setup();
  const result = task.run(input, {}, vi.fn());
  workers[0]!.send({ type: "error", error: { code: "private-value" } });
  await expect(result).resolves.toMatchObject({ ok: false, error: { code: "MK_INTERNAL", messageKey: "analysis.failed" } });
  expect(JSON.stringify(await result)).not.toContain("private-value");
});

it("keeps a monotonic deadline when the wall clock moves backwards", async () => {
  let wall = 100_000, elapsed = 0;
  const worker = new FakeWorker();
  const task = new AnalysisTask(() => worker as unknown as Worker, 60_000, () => wall, () => elapsed);
  const result = task.run(input, {}, vi.fn());
  wall = 1; elapsed = 60_000;
  worker.send({ type: "done", result: {} });
  await expect(result).resolves.toMatchObject({ ok: false, error: { code: "MK_LIMIT_EXCEEDED" } });
  expect(worker.terminate).toHaveBeenCalledTimes(1);
});

it.each([null, [], { type: "done" }, { type: "progress", stage: "secret", done: 0, total: 1 },
  { type: "progress", stage: "reading", done: -1, total: 1 },
  { type: "progress", stage: "reading", done: 2, total: 1 },
  { type: "progress", stage: "reading", done: 0, total: NaN },
])("settles malformed worker messages safely: %j", async (message) => {
  const { task, workers } = setup();
  const progress = vi.fn();
  const result = task.run(input, {}, progress);
  expect(() => workers[0]!.send(message)).not.toThrow();
  // A queued valid completion cannot turn a malformed message into success.
  workers[0]!.send({ type: "done", result: {} });
  await expect(result).resolves.toMatchObject({ ok: false, error: { code: "MK_INTERNAL" } });
  expect(progress).not.toHaveBeenCalled();
  expect(workers[0]!.terminate).toHaveBeenCalledTimes(1);
});

it("settles and terminates when the progress consumer throws", async () => {
  const { task, workers } = setup();
  const result = task.run(input, {}, () => { throw new Error("private callback detail"); });
  expect(() => workers[0]!.send({ type: "progress", stage: "reading", done: 0, total: 1 })).not.toThrow();
  workers[0]!.send({ type: "done", result: {} });
  await expect(result).resolves.toMatchObject({ ok: false, error: { code: "MK_INTERNAL" } });
  expect(JSON.stringify(await result)).not.toContain("private callback detail");
  expect(workers[0]!.terminate).toHaveBeenCalledTimes(1);
});

import { afterEach, expect, it, vi } from "vitest";
import { RecoveryTask } from "../src/ui/recovery-task";
import { RECORD_MAX_BYTES } from "../src/contracts/record-json";
class Fake {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror = null; onmessageerror = null;
  terminate = vi.fn(); postMessage = vi.fn();
  send(data: unknown) { this.onmessage?.({ data } as MessageEvent); }
}
const value = { artifacts: 0, plans: 0, operations: 0, provenance: 0, profileChecked: false };
const setup = () => { const workers: Fake[] = []; const task = new RecoveryTask(() => { const w = new Fake(); workers.push(w); return w as unknown as Worker; }); return { task, workers }; };
afterEach(() => vi.useRealTimers());
it("refuses oversized files before creating a worker", async () => {
  const create = vi.fn();
  expect(await new RecoveryTask(create).run({ size: RECORD_MAX_BYTES + 1 } as Blob, false)).toMatchObject({ ok: false, error: { code: "MK_LIMIT_EXCEEDED" } });
  expect(create).not.toHaveBeenCalled();
});
it("cancels superseded work and rejects its queued completion", async () => {
  const { task, workers } = setup();
  const first = task.run(new Blob(), false), second = task.run(new Blob(), false);
  workers[0]!.send({ ok: true, value }); workers[1]!.send({ ok: true, value });
  expect(await first).toMatchObject({ ok: false, error: { code: "MK_CANCELLED" } });
  expect(await second).toEqual({ ok: true, value });
  expect(workers[0]!.terminate).toHaveBeenCalledTimes(1);
});
it("terminates an unresponsive worker at the unchanged deadline", async () => {
  vi.useFakeTimers(); const { task, workers } = setup();
  const pending = task.run(new Blob(), false); vi.advanceTimersByTime(60_000);
  expect(await pending).toMatchObject({ ok: false, error: { code: "MK_LIMIT_EXCEEDED" } });
  expect(workers[0]!.terminate).toHaveBeenCalledTimes(1);
});
it("fails closed without worker support", async () => {
  expect(await new RecoveryTask(() => { throw Error("private detail"); }).run(new Blob(), false)).toMatchObject({ ok: false, error: { code: "MK_CAPABILITY_UNSUPPORTED" } });
});
it.each([null, { ok: true, value: { ...value, artifacts: 101 } }, { ok: true, value: { ...value, profileChecked: true } }])("rejects malformed or stale profile responses", async (response) => {
  const { task, workers } = setup(); const pending = task.run(new Blob(), false); workers[0]!.send(response);
  expect(await pending).toMatchObject({ ok: false, error: { code: "MK_INTERNAL" } });
});
it("does not forward error details", async () => {
  const { task, workers } = setup(); const pending = task.run(new Blob(), false);
  workers[0]!.send({ ok: false, error: { code: "MK_PRIVATE_DATA", safeDetail: "synthetic-private", params: { value: "synthetic-private" } } });
  const result = await pending;
  expect(result).toMatchObject({ ok: false, error: { code: "MK_PRIVATE_DATA", params: {} } });
  expect(JSON.stringify(result)).not.toContain("synthetic-private");
});
it("requires a matched manifest only for explicit payload matching", async () => {
  const { task, workers } = setup();
  const pending = task.run(new Blob(), false, { artifactIndex: 0, input: { kind: "folder", entries: [] } });
  workers[0]!.send({ ok: true, value });
  expect(await pending).toMatchObject({ ok: false, error: { code: "MK_INTERNAL" } });
});

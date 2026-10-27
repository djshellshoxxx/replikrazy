import { inspectRecoverySource } from "../contracts/recovery-source";
import { LOCAL_VERIFY_PROFILE } from "../contracts/local-verify-profile";
import { RECORD_MAX_BYTES } from "../contracts/record-json";
import { recoveryError } from "./recovery-task";
self.onmessage = async (event: MessageEvent<{ file: Blob; profileChecked: boolean }>) => {
  try {
    const { file, profileChecked } = event.data;
    const size = file.size;
    if (!Number.isSafeInteger(size) || size < 0 || size > RECORD_MAX_BYTES) { self.postMessage(recoveryError("MK_LIMIT_EXCEEDED")); return; }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.length !== size || file.size !== size) { self.postMessage(recoveryError("MK_INPUT_CHANGED")); return; }
    // Fatal decoding; preserve BOM as a character so strict JSON rejects it.
    const source = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
    const inspected = await inspectRecoverySource(source, profileChecked ? { validationProfile: LOCAL_VERIFY_PROFILE } : {});
    if (!inspected.result.ok) { self.postMessage(recoveryError(inspected.result.error.code)); return; }
    const envelope = inspected.result.value.envelope;
    self.postMessage({ ok: true, value: { artifacts: (envelope.artifacts as unknown[]).length, plans: (envelope.plans as unknown[]).length,
      operations: (envelope.operations as unknown[]).length, provenance: (envelope.provenance as unknown[]).length, profileChecked } });
  } catch { self.postMessage(recoveryError("MK_RECORD_CORRUPT")); }
};

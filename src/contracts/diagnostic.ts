// MK-CTR-001/002/003. Shared serialization types, not provider/API support.
import { ID_RE } from "./manifest";
import { validatePath } from "../core/paths";

export const ERROR_CODES = [
  "MK_SCHEMA_UNSUPPORTED", "MK_INPUT_EMPTY", "MK_INPUT_ROOT", "MK_INPUT_CHANGED", "MK_PATH_INVALID", "MK_PATH_COLLISION", "MK_ENTRY_UNSUPPORTED", "MK_ZIP_CORRUPT", "MK_ZIP_ENCRYPTED", "MK_ZIP_BOMB", "MK_LIMIT_EXCEEDED", "MK_SECRET_SUSPECTED", "MK_PRIVATE_DATA", "MK_HASH_MISMATCH",
  "MK_CAPABILITY_UNSUPPORTED", "MK_EVIDENCE_STALE", "MK_POLICY_BLOCKED", "MK_ELIGIBILITY_UNKNOWN", "MK_QUOTA_UNKNOWN", "MK_QUOTA_EXCEEDED", "MK_COST_UNKNOWN", "MK_PLAN_CHANGED", "MK_CONSENT_REQUIRED", "MK_BACKUP_REQUIRED", "MK_DESTINATION_CHANGED",
  "MK_AUTH_UNSUPPORTED", "MK_AUTH_DENIED", "MK_AUTH_EXPIRED", "MK_SCOPE_MISMATCH", "MK_AUTH_STATE", "MK_ORIGIN_BLOCKED", "MK_CORS_OR_NETWORK", "MK_RATE_LIMIT", "MK_PROVIDER_REJECTED", "MK_PROVIDER_UNAVAILABLE", "MK_OUTCOME_UNKNOWN",
  "MK_CANCELLED", "MK_INTERRUPTED", "MK_CONCURRENT_OPERATION", "MK_IDEMPOTENCY_CONFLICT", "MK_VERIFY_UNREADABLE", "MK_VERIFY_MISMATCH", "MK_RETENTION_UNCONFIRMED", "MK_ROLLBACK_UNSUPPORTED", "MK_RECORD_CORRUPT", "MK_STORAGE_UNAVAILABLE", "MK_INTERNAL",
] as const;
export type ErrorCode = typeof ERROR_CODES[number];
export type Severity = "info" | "warning" | "blocker";
export type Params = Record<string, string | number>;
export interface Diagnostic {
  id: string;
  requirementId: string;
  severity: Severity;
  certainty: "definite" | "heuristic" | "unknown";
  code: ErrorCode;
  path?: string;
  messageKey: string;
  params: Params;
  remediationKey: string;
}
export interface MKError {
  code: ErrorCode;
  messageKey: string;
  params: Params;
  retry: "never" | "after-user-action" | "safe-backoff" | "reconcile-first";
  targetId?: string;
  operationId?: string;
  safeDetail?: string;
}
export type Result<T> = { ok: true; value: T } | { ok: false; error: MKError };
export const isRecord = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x) && (Object.getPrototypeOf(x) === Object.prototype || Object.getPrototypeOf(x) === null);
export const isUInt = (x: unknown): x is number => typeof x === "number" && Number.isSafeInteger(x) && x >= 0;
export const boundedText = (x: unknown, max: number): x is string => typeof x === "string" && [...x].length <= max && ![...x].some((c) => c.length === 1 && c.charCodeAt(0) >= 0xd800 && c.charCodeAt(0) <= 0xdfff);
export const isId = (x: unknown): x is string => typeof x === "string" && ID_RE.test(x);
export const exactKeys = (x: Record<string, unknown>, required: string[], optional: string[] = []) => required.every((k) => Object.hasOwn(x, k)) && Object.keys(x).every((k) => required.includes(k) || optional.includes(k));
export const isParams = (x: unknown): x is Params => isRecord(x) && Object.entries(x).every(([k, v]) => boundedText(k, 200) && (boundedText(v, 2000) || isUInt(v)));
export const isErrorCode = (x: unknown): x is ErrorCode => ERROR_CODES.includes(x as ErrorCode);

export function isDiagnostic(x: unknown): x is Diagnostic {
  return isRecord(x) && exactKeys(x, ["id", "requirementId", "severity", "certainty", "code", "messageKey", "params", "remediationKey"], ["path"])
    && isId(x.id) && typeof x.requirementId === "string" && /^MK-[A-Z]{2,3}-[0-9]{3}$/.test(x.requirementId)
    && ["info", "warning", "blocker"].includes(x.severity as string) && ["definite", "heuristic", "unknown"].includes(x.certainty as string)
    && isErrorCode(x.code) && isId(x.messageKey) && isParams(x.params) && isId(x.remediationKey)
    && (!Object.hasOwn(x, "path") || (boundedText(x.path, 240) && validatePath(x.path).ok));
}
export function isMKError(x: unknown): x is MKError {
  return isRecord(x) && exactKeys(x, ["code", "messageKey", "params", "retry"], ["targetId", "operationId", "safeDetail"])
    && isErrorCode(x.code) && isId(x.messageKey) && isParams(x.params)
    && ["never", "after-user-action", "safe-backoff", "reconcile-first"].includes(x.retry as string)
    && (!Object.hasOwn(x, "targetId") || isId(x.targetId))
    && (!Object.hasOwn(x, "operationId") || (typeof x.operationId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(x.operationId)))
    && (!Object.hasOwn(x, "safeDetail") || boundedText(x.safeDetail, 2000));
}

// Only fixed messages cross the worker boundary. Never forward exception text.
const ANALYSIS_ERRORS = {
  cancelled: ["MK_CANCELLED", "analysis.cancelled"],
  timeout: ["MK_LIMIT_EXCEEDED", "analysis.time-limit"],
  unavailable: ["MK_CAPABILITY_UNSUPPORTED", "analysis.worker-unavailable"],
  changed: ["MK_INPUT_CHANGED", "analysis.input-changed"],
  failed: ["MK_INTERNAL", "analysis.failed"],
} as const;
export function analysisError(reason: keyof typeof ANALYSIS_ERRORS): MKError {
  const [code, messageKey] = ANALYSIS_ERRORS[reason];
  return { code, messageKey, params: {}, retry: "after-user-action" };
}

const INPUT_ERROR_CODES = ERROR_CODES.slice(0, 15);
export function inputError(code: unknown): MKError {
  if (!INPUT_ERROR_CODES.includes(code as ErrorCode)) return analysisError("failed");
  return { code: code as ErrorCode, messageKey: `input.${(code as string).slice(3).toLowerCase().replaceAll("_", "-")}`, params: {}, retry: "after-user-action" };
}

import type { Claim, Evidence } from "./types";

// Helpers keep adapter files short and make the evidence level explicit.
export const unknown = <T>(note = "not verified"): Claim<T> => ({ value: null, evidence: "unreviewed", note });
export const claim = <T>(value: T, evidence: Evidence, note?: string, source?: string, observed?: string): Claim<T> => ({
  value, evidence, note, ...(source ? { source } : {}), ...(observed ? { observed } : {}),
});
export const noBrowserDeploy: Claim<boolean> = {
  value: false,
  evidence: "unsupported",
  note: "No direct-from-browser deployment route is qualified. Use the manual export.",
};

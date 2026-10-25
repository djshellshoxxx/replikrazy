// Owner-declared intended use (research MK-CTR-004 IntendedUse, MK-POL-003).
// It is a declaration that drives policy gates, not a verified fact.

export type UseCategory = "public-demo" | "personal" | "commercial" | "payment" | "token" | "other";

export interface IntendedUse {
  category: UseCategory;
  // Always false in a valid record: private data must be removed upstream,
  // there is no "publish it anyway" override (MK-ART-005).
  containsPrivateData: false;
  ownerHasRights: boolean;
  description: string;
  country?: string; // ISO 3166-1 alpha-2, volunteered, never geolocated
}

export const USE_CATEGORIES: readonly UseCategory[] = ["public-demo", "personal", "commercial", "payment", "token", "other"];

// Payment/token/key-handling interfaces need evidence no provider currently
// has in this catalogue (no-injection audit, headers, origin isolation), so
// they are blocked everywhere until a destination is qualified for them.
export const SENSITIVE_USES: readonly UseCategory[] = ["payment", "token"];

export function validateIntendedUse(u: IntendedUse): string[] {
  const errors: string[] = [];
  if (!USE_CATEGORIES.includes(u.category)) errors.push("unknown use category");
  if (u.containsPrivateData !== false) errors.push("private data must be removed before mirroring");
  if ([...u.description].length > 2000) errors.push("description is longer than 2,000 characters");
  if (u.country !== undefined && !/^[A-Z]{2}$/.test(u.country)) errors.push("country must be a two-letter ISO 3166-1 code");
  return errors;
}

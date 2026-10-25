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

// Shared by destination assessment and both export actions. Record validity
// alone is not permission to export: rights and sensitive-use gates also apply.
export function exportUseBlockers(u: IntendedUse): string[] {
  const blockers = validateIntendedUse(u);
  if (u.ownerHasRights !== true) blockers.push("you have not confirmed you have the rights to publish this site");
  if (SENSITIVE_USES.includes(u.category))
    blockers.push(`no destination is qualified for ${u.category} apps (sensitive profile: needs a verified no-injection, header and origin-isolation review)`);
  return blockers;
}

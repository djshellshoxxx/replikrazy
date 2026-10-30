// Structural exclusions for recovery records (MK-CTR-007), not a general
// content-secret detector or a claim that arbitrary prose is secret-free.
const prohibited = new Set(["accesstoken", "refreshtoken", "idtoken", "authorization", "password", "clientsecret", "privatekey", "cookies", "localstorage", "sessionstorage"]);
export function hasExcludedRecordMaterial(root: unknown): boolean {
  const pending = [root];
  while (pending.length) {
    const value = pending.pop();
    if (typeof value === "string") {
      if (/-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/.test(value)) return true;
    } else if (Array.isArray(value)) { for (const child of value) pending.push(child); }
    else if (value && typeof value === "object") {
      const obj = value as Record<string, unknown>;
      // Private JWK members are never public provenance; no crypto is enabled.
      if (typeof obj.kty === "string" && ["d", "p", "q", "dp", "dq", "qi", "oth", "k"].some((key) => Object.hasOwn(obj, key))) return true;
      for (const [key, child] of Object.entries(obj)) {
        if (prohibited.has(key.toLowerCase().replace(/[-_.]/g, ""))) return true;
        pending.push(child);
      }
    }
  }
  return false;
}

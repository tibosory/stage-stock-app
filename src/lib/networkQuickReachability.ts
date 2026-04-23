/**
 * Cache court pour `checkServerReachableQuick` : moins d’allers-retours HTTP répétitifs
 * (re-vérifications au fil de l’usage) tout en invalidant assez vite en cas d’échec.
 */
const OK_TTL_MS = 12_000;
const FAIL_TTL_MS = 5_000;

type Entry = { value: boolean; at: number };

let entry: Entry | null = null;

export function getCachedQuickReachable(): boolean | null {
  if (!entry) return null;
  const age = Date.now() - entry.at;
  const ttl = entry.value ? OK_TTL_MS : FAIL_TTL_MS;
  if (age > ttl) {
    entry = null;
    return null;
  }
  return entry.value;
}

export function setCachedQuickReachable(value: boolean): void {
  entry = { value, at: Date.now() };
}

export function invalidateQuickReachabilityCache(): void {
  entry = null;
}

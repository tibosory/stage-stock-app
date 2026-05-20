type Entry<T> = {
  value: T;
  expiresAt: number;
};

/**
 * Cache mémoire ultra léger pour accélérer les lectures répétées
 * sans toucher la base locale à chaque frappe.
 */
export class LocalCache {
  private store = new Map<string, Entry<unknown>>();

  get<T>(key: string): T | null {
    const hit = this.store.get(key);
    if (!hit) return null;
    if (Date.now() > hit.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return hit.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + Math.max(1, ttlMs) });
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

export const localCache = new LocalCache();

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'stagestock_comfort_prefs_v1';

export type ComfortPrefs = {
  /** Petit retour haptique quand un scan correspond à une fiche (matériel ou consommable). */
  hapticOnScanMatch: boolean;
};

const DEFAULTS: ComfortPrefs = {
  hapticOnScanMatch: true,
};

function merge(raw: unknown): ComfortPrefs {
  if (!raw || typeof raw !== 'object') return { ...DEFAULTS };
  const o = raw as Record<string, unknown>;
  return {
    hapticOnScanMatch:
      typeof o.hapticOnScanMatch === 'boolean' ? o.hapticOnScanMatch : DEFAULTS.hapticOnScanMatch,
  };
}

let cache: ComfortPrefs | null = null;

export function invalidateComfortPrefsCache(): void {
  cache = null;
}

export async function loadComfortPrefs(): Promise<ComfortPrefs> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    const prefs = merge(parsed);
    cache = prefs;
    return prefs;
  } catch {
    cache = { ...DEFAULTS };
    return cache;
  }
}

export async function getComfortPrefsCached(): Promise<ComfortPrefs> {
  if (cache) return cache;
  return loadComfortPrefs();
}

export async function saveComfortPrefs(patch: Partial<ComfortPrefs>): Promise<ComfortPrefs> {
  const prev = await loadComfortPrefs();
  const next: ComfortPrefs = { ...prev, ...patch };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  cache = next;
  return next;
}

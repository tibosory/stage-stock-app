import AsyncStorage from '@react-native-async-storage/async-storage';
import { getResolvedApiBase } from '../config/stageStockApi';

const STORAGE_KEY_DUAL_BACKEND_SYNC = 'stagestock_sync_dual_backend';
const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').trim();

function isHttpUrl(v: string): boolean {
  return /^https?:\/\//i.test(v);
}

function parseBooleanEnv(v: string | undefined): boolean | null {
  if (!v) return null;
  const t = v.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(t)) return true;
  if (['0', 'false', 'no', 'off'].includes(t)) return false;
  return null;
}

/**
 * DOUBLE_BACKEND : piloté par l'UI (AsyncStorage), avec fallback optionnel via env.
 */
export async function getDoubleBackendEnabled(): Promise<boolean> {
  const fromUi = await AsyncStorage.getItem(STORAGE_KEY_DUAL_BACKEND_SYNC);
  if (fromUi === '1') return true;
  if (fromUi === '0') return false;
  const envFallback = parseBooleanEnv(process.env.EXPO_PUBLIC_DOUBLE_BACKEND);
  return envFallback ?? false;
}

export async function resolveApiUrlForSync(): Promise<string> {
  const resolved = (await getResolvedApiBase()).trim();
  if (isHttpUrl(resolved)) return resolved.replace(/\/+$/, '');
  if (isHttpUrl(API_URL)) return API_URL.replace(/\/+$/, '');
  return '';
}

export async function canCallApiSync(scope: string): Promise<
  | { ok: true; apiUrl: string; doubleBackend: true }
  | { ok: false; reason: string; doubleBackend: boolean; apiUrl: string }
> {
  const doubleBackend = await getDoubleBackendEnabled();
  const apiUrl = await resolveApiUrlForSync();

  if (!doubleBackend) {
    const reason = 'DOUBLE_BACKEND désactivé';
    console.log(`[sync][skip][${scope}] ${reason}`);
    return { ok: false, reason, doubleBackend, apiUrl };
  }
  if (!apiUrl) {
    const reason = 'API_URL non configurée';
    console.log(`[sync][skip][${scope}] ${reason}`);
    return { ok: false, reason, doubleBackend, apiUrl };
  }
  console.log(`[sync][guard][${scope}] API autorisée (${apiUrl})`);
  return { ok: true, apiUrl, doubleBackend: true };
}

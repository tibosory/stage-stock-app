import AsyncStorage from '@react-native-async-storage/async-storage';
import { invalidateQuickReachabilityCache } from './networkQuickReachability';

const K_BASE = 'stagestock_api_base_override';
const K_KEY = 'stagestock_api_key_override';
const K_HEALTH = 'stagestock_api_health_path_override';
const K_ACCESS = 'stagestock_api_access_token';
/** Second serveur (ex. cloud ↔ PC local) pour import/export dans l’écran dédié */
const K_SECONDARY_BASE = 'stagestock_api_secondary_base';
const K_SECONDARY_KEY = 'stagestock_api_secondary_key';

function trimSlash(u: string): string {
  return u.replace(/\/+$/, '');
}

const ABSOLUTE_SCHEME_RE = /^[a-z][a-z0-9+.-]*:\/\//i;
const HOST_WITH_OPTIONAL_PORT_RE =
  /^(localhost|(\d{1,3}\.){3}\d{1,3}|\[[0-9a-f:]+\]|[a-z0-9.-]+)(:\d+)?(\/.*)?$/i;

/**
 * Normalise une saisie utilisateur d'URL API.
 * - Accepte `192.168.1.77:8090` et le convertit en `http://192.168.1.77:8090`
 * - Conserve les URL `http://`/`https://` explicites
 */
/**
 * Supprime un suffixe `/api` en fin d’URL serveur.
 * L’app construit les chemins elle‑même (`/api/sync/...`, `/ask`, `/health`) à partir de la **racine** du backend
 * (ex. `http://192.168.1.20:8091`). Si l’utilisateur saisit `http://…/api`, sans correction on obtient `/api/ask` → 404.
 */
export function stripStageStockServerRootSuffix(url: string): string {
  let t = url.trim().replace(/\/+$/, '');
  if (!t) return '';
  if (/\/api$/i.test(t)) {
    t = t.replace(/\/api$/i, '').replace(/\/+$/, '');
  }
  t = t.replace(/\/(pair\.html|pair|serveur\.html|diagnostic)$/i, '').replace(/\/+$/, '');
  return t;
}

export function normalizeHttpBaseUrl(input: string): string | null {
  const t = input.trim();
  if (!t) return null;
  let candidate = t;
  if (!ABSOLUTE_SCHEME_RE.test(candidate)) {
    if (!HOST_WITH_OPTIONAL_PORT_RE.test(candidate)) return null;
    candidate = `http://${candidate}`;
  }
  try {
    const u = new URL(candidate);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (!u.hostname) return null;
    return trimSlash(u.toString());
  } catch {
    return null;
  }
}

export async function getApiBaseOverride(): Promise<string | null> {
  const v = (await AsyncStorage.getItem(K_BASE))?.trim();
  if (!v) return null;
  const raw = normalizeHttpBaseUrl(v) ?? trimSlash(v);
  return stripStageStockServerRootSuffix(raw);
}

export async function setApiBaseOverride(url: string | null): Promise<void> {
  if (!url?.trim()) {
    await AsyncStorage.removeItem(K_BASE);
  } else {
    const normalized = normalizeHttpBaseUrl(url) ?? trimSlash(url.trim());
    await AsyncStorage.setItem(K_BASE, stripStageStockServerRootSuffix(normalized));
  }
  invalidateQuickReachabilityCache();
}

export async function getApiKeyOverride(): Promise<string | null> {
  const v = (await AsyncStorage.getItem(K_KEY))?.trim();
  return v || null;
}

export async function setApiKeyOverride(key: string | null): Promise<void> {
  if (!key?.trim()) {
    await AsyncStorage.removeItem(K_KEY);
  } else {
    await AsyncStorage.setItem(K_KEY, key.trim());
  }
  invalidateQuickReachabilityCache();
}

export async function getHealthPathOverride(): Promise<string | null> {
  const v = (await AsyncStorage.getItem(K_HEALTH))?.trim();
  return v || null;
}

export async function setHealthPathOverride(path: string | null): Promise<void> {
  if (!path?.trim()) {
    await AsyncStorage.removeItem(K_HEALTH);
  } else {
    await AsyncStorage.setItem(K_HEALTH, path.trim());
  }
  invalidateQuickReachabilityCache();
}

export async function getAccessToken(): Promise<string | null> {
  const v = (await AsyncStorage.getItem(K_ACCESS))?.trim();
  return v || null;
}

export async function setAccessToken(token: string | null): Promise<void> {
  if (!token?.trim()) {
    await AsyncStorage.removeItem(K_ACCESS);
  } else {
    await AsyncStorage.setItem(K_ACCESS, token.trim());
  }
  invalidateQuickReachabilityCache();
}

export async function clearAllApiEndpointOverrides(): Promise<void> {
  await AsyncStorage.multiRemove([K_BASE, K_KEY, K_HEALTH]);
  invalidateQuickReachabilityCache();
}

export async function getSecondaryApiBase(): Promise<string | null> {
  const v = (await AsyncStorage.getItem(K_SECONDARY_BASE))?.trim();
  if (!v) return null;
  const raw = normalizeHttpBaseUrl(v) ?? trimSlash(v);
  return stripStageStockServerRootSuffix(raw);
}

export async function setSecondaryApiBase(url: string | null): Promise<void> {
  if (!url?.trim()) {
    await AsyncStorage.removeItem(K_SECONDARY_BASE);
    return;
  }
  const normalized = normalizeHttpBaseUrl(url) ?? trimSlash(url.trim());
  await AsyncStorage.setItem(K_SECONDARY_BASE, stripStageStockServerRootSuffix(normalized));
}

export async function getSecondaryApiKey(): Promise<string | null> {
  const v = (await AsyncStorage.getItem(K_SECONDARY_KEY))?.trim();
  return v || null;
}

export async function setSecondaryApiKey(key: string | null): Promise<void> {
  if (!key?.trim()) {
    await AsyncStorage.removeItem(K_SECONDARY_KEY);
    return;
  }
  await AsyncStorage.setItem(K_SECONDARY_KEY, key.trim());
}

/** Validation minimale : schéma http(s) et au moins une autorité. */
export function looksLikeHttpUrl(s: string): boolean {
  return normalizeHttpBaseUrl(s) !== null;
}

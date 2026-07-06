import AsyncStorage from '@react-native-async-storage/async-storage';
import { invalidateQuickReachabilityCache } from './networkQuickReachability';
import { readSecret, writeSecret, removeSecrets } from './secureSecretStorage';
import {
  looksLikeHttpUrl,
  normalizeHttpBaseUrl,
  stripStageStockServerRootSuffix,
} from './httpUrlUtils';

export { looksLikeHttpUrl, normalizeHttpBaseUrl, stripStageStockServerRootSuffix } from './httpUrlUtils';

const K_BASE = 'stagestock_api_base_override';
const K_KEY = 'stagestock_api_key_override';
const K_HEALTH = 'stagestock_api_health_path_override';
const K_ACCESS = 'stagestock_api_access_token';
/** Second serveur (ex. cloud ↔ PC local) pour import/export dans l’écran dédié */
const K_SECONDARY_BASE = 'stagestock_api_secondary_base';
const K_SECONDARY_KEY = 'stagestock_api_secondary_key';
/** URL de l’API CAPI (pont CATRACK) — ex. http://192.168.1.77:8080 */
const K_CAPI_BRIDGE = 'stagestock_capi_bridge_base';

function trimSlash(u: string): string {
  return u.replace(/\/+$/, '');
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
  return readSecret(K_KEY);
}

export async function setApiKeyOverride(key: string | null): Promise<void> {
  await writeSecret(K_KEY, key);
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
  return readSecret(K_ACCESS);
}

export async function setAccessToken(token: string | null): Promise<void> {
  await writeSecret(K_ACCESS, token);
  invalidateQuickReachabilityCache();
}

export async function clearAllApiEndpointOverrides(): Promise<void> {
  await AsyncStorage.multiRemove([K_BASE, K_HEALTH]);
  await removeSecrets([K_KEY, K_ACCESS]);
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
  return readSecret(K_SECONDARY_KEY);
}

export async function setSecondaryApiKey(key: string | null): Promise<void> {
  await writeSecret(K_SECONDARY_KEY, key);
}

export async function getCapiBridgeBaseOverride(): Promise<string | null> {
  const v = (await AsyncStorage.getItem(K_CAPI_BRIDGE))?.trim();
  if (!v) return null;
  const raw = normalizeHttpBaseUrl(v) ?? trimSlash(v);
  return stripStageStockServerRootSuffix(raw);
}

export async function setCapiBridgeBaseOverride(url: string | null): Promise<void> {
  if (!url?.trim()) {
    await AsyncStorage.removeItem(K_CAPI_BRIDGE);
    return;
  }
  const normalized = normalizeHttpBaseUrl(url) ?? trimSlash(url.trim());
  await AsyncStorage.setItem(K_CAPI_BRIDGE, stripStageStockServerRootSuffix(normalized));
}

/** Re-normalise l’URL enregistrée (supprime /pair, /api, etc.) après jumelage ou saisie manuelle. */
export async function reconcileStoredApiBaseUrl(): Promise<void> {
  const base = await getApiBaseOverride();
  if (base) {
    await setApiBaseOverride(base);
  }
}

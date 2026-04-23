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

export async function getApiBaseOverride(): Promise<string | null> {
  const v = (await AsyncStorage.getItem(K_BASE))?.trim();
  return v || null;
}

export async function setApiBaseOverride(url: string | null): Promise<void> {
  if (!url?.trim()) {
    await AsyncStorage.removeItem(K_BASE);
  } else {
    await AsyncStorage.setItem(K_BASE, trimSlash(url.trim()));
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
  return v || null;
}

export async function setSecondaryApiBase(url: string | null): Promise<void> {
  if (!url?.trim()) {
    await AsyncStorage.removeItem(K_SECONDARY_BASE);
    return;
  }
  await AsyncStorage.setItem(K_SECONDARY_BASE, trimSlash(url.trim()));
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
  const t = s.trim();
  return /^https?:\/\/.+/i.test(t) && t.length > 10;
}

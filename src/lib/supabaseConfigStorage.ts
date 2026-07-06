import AsyncStorage from '@react-native-async-storage/async-storage';
import { readSecret, writeSecret, removeSecrets } from './secureSecretStorage';

const K_URL = '@stagestock/supabase_url_override';
const K_KEY = '@stagestock/supabase_anon_key_override';

export type SupabaseOverride = { url: string; anonKey: string };

export async function loadSupabaseOverride(): Promise<SupabaseOverride | null> {
  const url = (await AsyncStorage.getItem(K_URL))?.trim() ?? '';
  const anonKey = (await readSecret(K_KEY)) ?? '';
  if (url && anonKey) return { url, anonKey };
  return null;
}

export async function saveSupabaseOverride(override: SupabaseOverride): Promise<void> {
  await AsyncStorage.setItem(K_URL, override.url.trim());
  await writeSecret(K_KEY, override.anonKey.trim());
}

export async function clearSupabaseOverride(): Promise<void> {
  await AsyncStorage.removeItem(K_URL);
  await removeSecrets([K_KEY]);
}

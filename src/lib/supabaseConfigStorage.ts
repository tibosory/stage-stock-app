import AsyncStorage from '@react-native-async-storage/async-storage';

const K_URL = '@stagestock/supabase_url_override';
const K_KEY = '@stagestock/supabase_anon_key_override';

export type SupabaseOverride = { url: string; anonKey: string };

export async function loadSupabaseOverride(): Promise<SupabaseOverride | null> {
  const [[, u], [, k]] = await AsyncStorage.multiGet([K_URL, K_KEY]);
  const url = u?.trim() ?? '';
  const anonKey = k?.trim() ?? '';
  if (url && anonKey) return { url, anonKey };
  return null;
}

export async function saveSupabaseOverride(override: SupabaseOverride): Promise<void> {
  await AsyncStorage.multiSet([
    [K_URL, override.url.trim()],
    [K_KEY, override.anonKey.trim()],
  ]);
}

export async function clearSupabaseOverride(): Promise<void> {
  await AsyncStorage.multiRemove([K_URL, K_KEY]);
}

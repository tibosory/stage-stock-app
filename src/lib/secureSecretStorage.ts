import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSecurityUseSecureStore } from './securityFlags';

async function getSecureStoreModule(): Promise<typeof import('expo-secure-store') | null> {
  if (Platform.OS === 'web') return null;
  try {
    return await import('expo-secure-store');
  } catch {
    return null;
  }
}

async function migrateLegacyToSecure(key: string, legacy: string): Promise<void> {
  const SecureStore = await getSecureStoreModule();
  if (!SecureStore) return;
  try {
    await SecureStore.setItemAsync(key, legacy);
    await AsyncStorage.removeItem(key);
  } catch {
    /* garde AsyncStorage si SecureStore indisponible */
  }
}

export async function readSecret(key: string): Promise<string | null> {
  const useSecure = await getSecurityUseSecureStore();
  if (useSecure) {
    const SecureStore = await getSecureStoreModule();
    if (SecureStore) {
      try {
        const secure = (await SecureStore.getItemAsync(key))?.trim();
        if (secure) return secure;
      } catch {
        /* fallback legacy */
      }
    }
  }
  const legacy = (await AsyncStorage.getItem(key))?.trim();
  if (legacy && useSecure) {
    await migrateLegacyToSecure(key, legacy);
  }
  return legacy || null;
}

export async function writeSecret(key: string, value: string | null): Promise<void> {
  const trimmed = value?.trim() ?? '';
  const useSecure = await getSecurityUseSecureStore();
  if (!trimmed) {
    await AsyncStorage.removeItem(key);
    if (useSecure) {
      const SecureStore = await getSecureStoreModule();
      if (SecureStore) {
        try {
          await SecureStore.deleteItemAsync(key);
        } catch {
          /* ignore */
        }
      }
    }
    return;
  }
  if (useSecure) {
    const SecureStore = await getSecureStoreModule();
    if (SecureStore) {
      try {
        await SecureStore.setItemAsync(key, trimmed);
        await AsyncStorage.removeItem(key);
        return;
      } catch {
        /* fallback AsyncStorage */
      }
    }
  }
  await AsyncStorage.setItem(key, trimmed);
}

export async function removeSecrets(keys: string[]): Promise<void> {
  await Promise.all(keys.map(k => writeSecret(k, null)));
}

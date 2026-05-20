import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppLanguage } from '../i18n/strings';

const KEY = 'stagestock_app_language';

export async function getStoredAppLanguage(): Promise<AppLanguage | null> {
  const raw = (await AsyncStorage.getItem(KEY))?.trim().toLowerCase();
  if (!raw) return null;
  if (raw === 'fr' || raw === 'en') return raw;
  // Legacy values from old builds are mapped to English.
  if (raw === 'es' || raw === 'de' || raw === 'it' || raw === 'pt') return 'en';
  return null;
}

export async function setStoredAppLanguage(lang: AppLanguage): Promise<void> {
  await AsyncStorage.setItem(KEY, lang);
}

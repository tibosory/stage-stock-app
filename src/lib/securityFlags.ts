import AsyncStorage from '@react-native-async-storage/async-storage';

const K_SECURE_STORE = 'stagestock_security_use_secure_store';
const K_FG_SKIP_IDLE = 'stagestock_sync_fg_skip_idle';

/** Stockage chiffré des clés API / anon Supabase (défaut : activé). */
export async function getSecurityUseSecureStore(): Promise<boolean> {
  const v = await AsyncStorage.getItem(K_SECURE_STORE);
  if (v === '0') return false;
  return true;
}

export async function setSecurityUseSecureStore(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(K_SECURE_STORE, enabled ? '1' : '0');
}

/** Ne pas lancer la sync inventaire au premier plan si rien n’est en attente (défaut : activé). */
export async function getForegroundSyncSkipWhenIdle(): Promise<boolean> {
  const v = await AsyncStorage.getItem(K_FG_SKIP_IDLE);
  if (v === '0') return false;
  return true;
}

export async function setForegroundSyncSkipWhenIdle(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(K_FG_SKIP_IDLE, enabled ? '1' : '0');
}

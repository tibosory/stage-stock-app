import AsyncStorage from '@react-native-async-storage/async-storage';

export const DATA_BACKEND_MODE_STORAGE_KEY = 'stagestock_data_backend_mode';

/** Backend de données actif (mutuellement exclusif). */
export type DataBackendMode = 'local_server' | 'supabase';

let runtimeMode: DataBackendMode | null = null;
let initialized = false;

export function isDataBackendModeInitialized(): boolean {
  return initialized;
}

export function getDataBackendModeRuntime(): DataBackendMode | null {
  return runtimeMode;
}

export function setDataBackendModeRuntime(mode: DataBackendMode): void {
  runtimeMode = mode;
  initialized = true;
}

export async function loadDataBackendModeFromStorage(): Promise<DataBackendMode | null> {
  try {
    const raw = await AsyncStorage.getItem(DATA_BACKEND_MODE_STORAGE_KEY);
    if (raw === 'local_server' || raw === 'supabase') {
      setDataBackendModeRuntime(raw);
      return raw;
    }
    runtimeMode = null;
    initialized = true;
    return null;
  } catch {
    initialized = true;
    return null;
  }
}

export async function persistDataBackendMode(mode: DataBackendMode): Promise<void> {
  await AsyncStorage.setItem(DATA_BACKEND_MODE_STORAGE_KEY, mode);
  setDataBackendModeRuntime(mode);
}

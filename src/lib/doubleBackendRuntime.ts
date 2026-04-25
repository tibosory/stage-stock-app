import AsyncStorage from '@react-native-async-storage/async-storage';

export const DOUBLE_BACKEND_STORAGE_KEY = 'stagestock_sync_dual_backend';

let doubleBackendRuntime = false;
let initialized = false;

export function getDoubleBackendRuntime(): boolean {
  return doubleBackendRuntime;
}

export function isDoubleBackendRuntimeInitialized(): boolean {
  return initialized;
}

export function setDoubleBackendRuntime(value: boolean): void {
  doubleBackendRuntime = !!value;
  initialized = true;
}

export async function loadDoubleBackendRuntimeFromStorage(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(DOUBLE_BACKEND_STORAGE_KEY);
    setDoubleBackendRuntime(raw === '1');
  } catch {
    setDoubleBackendRuntime(false);
  }
  return doubleBackendRuntime;
}

export async function persistDoubleBackendRuntime(value: boolean): Promise<void> {
  const v = !!value;
  await AsyncStorage.setItem(DOUBLE_BACKEND_STORAGE_KEY, v ? '1' : '0');
  setDoubleBackendRuntime(v);
}

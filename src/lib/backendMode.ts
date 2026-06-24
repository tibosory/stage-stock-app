import { getResolvedApiBase } from '../config/stageStockApi';
import { isSupabaseConfigured } from './supabase';

const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').trim();

function isHttpUrl(v: string): boolean {
  return /^https?:\/\//i.test(v);
}

async function resolveApiUrlForBackendDefault(): Promise<string> {
  const resolved = (await getResolvedApiBase()).trim();
  if (isHttpUrl(resolved)) return resolved.replace(/\/+$/, '');
  if (isHttpUrl(API_URL)) return API_URL.replace(/\/+$/, '');
  return '';
}
import {
  getDataBackendModeRuntime,
  isDataBackendModeInitialized,
  loadDataBackendModeFromStorage,
  persistDataBackendMode,
  type DataBackendMode,
} from './backendModeRuntime';

export type { DataBackendMode };

export const BACKEND_SKIP = {
  localNotSelected: 'backend_mode_supabase',
  supabaseNotSelected: 'backend_mode_local',
} as const;

export async function getDataBackendMode(): Promise<DataBackendMode> {
  if (!isDataBackendModeInitialized()) {
    await loadDataBackendModeFromStorage();
  }
  const stored = getDataBackendModeRuntime();
  if (stored === 'local_server' || stored === 'supabase') return stored;

  const apiUrl = await resolveApiUrlForBackendDefault();
  if (apiUrl) return 'local_server';
  if (isSupabaseConfigured()) return 'supabase';
  return 'local_server';
}

export async function setDataBackendMode(mode: DataBackendMode): Promise<void> {
  await persistDataBackendMode(mode);
}

export async function isLocalServerBackend(): Promise<boolean> {
  return (await getDataBackendMode()) === 'local_server';
}

export async function isSupabaseBackend(): Promise<boolean> {
  return (await getDataBackendMode()) === 'supabase';
}

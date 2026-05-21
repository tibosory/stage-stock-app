/**
 * Orchestrateur Accueil Pro single-target : serveur local **ou** Supabase.
 */
import type * as SQLite from 'expo-sqlite';
import type { InventorySyncEndpoint } from './inventoryApiSync';
import {
  pushAccueilProToApi,
  syncAccueilProFromApi,
  type AccueilProPullResult,
} from './accueilProApiSync';
import {
  pushAccueilProToSupabase,
  syncAccueilProFromSupabase,
} from './accueilProSupabaseSync';
import { getDataBackendMode } from './backendMode';

export type AccueilProSyncDatabase = SQLite.SQLiteDatabase;

export async function pushAccueilPro(
  endpoint: InventorySyncEndpoint | null,
  opts?: { database?: AccueilProSyncDatabase }
): Promise<boolean> {
  const mode = await getDataBackendMode();
  if (mode === 'supabase') return pushAccueilProToSupabase(opts);
  return pushAccueilProToApi(endpoint, opts);
}

export async function syncAccueilProFromRemote(
  endpoint: InventorySyncEndpoint | null,
  opts?: { database?: AccueilProSyncDatabase; full?: boolean }
): Promise<AccueilProPullResult> {
  const mode = await getDataBackendMode();
  if (mode === 'supabase') return syncAccueilProFromSupabase(opts);
  return syncAccueilProFromApi(endpoint, opts);
}

export type AccueilProBidirectionalResult = {
  pushed: boolean;
  pull: AccueilProPullResult;
};

export async function syncAccueilProBidirectional(
  endpoint: InventorySyncEndpoint | null,
  opts?: { database?: AccueilProSyncDatabase }
): Promise<AccueilProBidirectionalResult> {
  const pushed = await pushAccueilPro(endpoint, opts);
  const pull = await syncAccueilProFromRemote(endpoint, opts);
  return { pushed, pull };
}

/**
 * Orchestrateur single-target : inventaire synchronisé vers UN backend choisi
 * (serveur local + Tailscale/LAN **ou** Supabase), jamais les deux à la fois.
 */
import { checkServerReachableQuick } from '../config/stageStockApi';
import { getDataBackendMode } from './backendMode';
import { canCallApiSync, canCallSupabaseSync } from './syncGuards';
import { syncFromInventoryApi, syncToInventoryApi } from './inventoryApiSync';
import { syncFromSupabase, syncToSupabase } from './supabase';
import { getIsOnlineRuntime } from './networkRuntime';
import { recordSyncTelemetry } from './syncTelemetry';
import {
  pushWorkspaceSettingsToSupabase,
  pullWorkspaceSettingsFromSupabase,
} from './workspaceSettingsSync';
import {
  pushAccueilProToSupabase,
  syncAccueilProFromSupabase,
} from './accueilProSupabaseSync';

export type InventorySyncDirection = 'push' | 'pull' | 'bidirectional';

export type InventorySyncResult = {
  ok: boolean;
  backend: DataBackendMode | 'none';
  error?: string;
  pushOk?: boolean;
  pullOk?: boolean;
};

type DataBackendMode = 'local_server' | 'supabase';

async function runLocalPush(scope: string): Promise<{ ok: boolean; error?: string }> {
  const guard = await canCallApiSync(`${scope}:push`);
  if (!guard.ok) {
    await recordSyncTelemetry('api', 'push', 'skipped', guard.reason);
    return { ok: false, error: guard.reason };
  }
  if (!(await checkServerReachableQuick())) {
    const reason = 'Serveur API injoignable';
    await recordSyncTelemetry('api', 'push', 'skipped', reason);
    return { ok: false, error: reason };
  }
  const result = await syncToInventoryApi();
  await recordSyncTelemetry('api', 'push', result.ok ? 'ok' : 'error', result.error);
  return result;
}

async function runLocalPull(scope: string): Promise<{ ok: boolean; error?: string }> {
  const guard = await canCallApiSync(`${scope}:pull`);
  if (!guard.ok) {
    await recordSyncTelemetry('api', 'pull', 'skipped', guard.reason);
    return { ok: false, error: guard.reason };
  }
  if (!(await checkServerReachableQuick())) {
    const reason = 'Serveur API injoignable';
    await recordSyncTelemetry('api', 'pull', 'skipped', reason);
    return { ok: false, error: reason };
  }
  const result = await syncFromInventoryApi();
  await recordSyncTelemetry('api', 'pull', result.ok ? 'ok' : 'error', result.error);
  return result;
}

async function runSupabasePush(scope: string): Promise<{ ok: boolean; error?: string }> {
  const guard = await canCallSupabaseSync(`${scope}:push`);
  if (!guard.ok) {
    await recordSyncTelemetry('supabase', 'push', 'skipped', guard.reason);
    return { ok: false, error: guard.reason };
  }
  const inv = await syncToSupabase();
  if (!inv.ok) {
    await recordSyncTelemetry('supabase', 'push', 'error', inv.error);
    return inv;
  }
  try {
    await pushWorkspaceSettingsToSupabase();
    await pushAccueilProToSupabase();
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    await recordSyncTelemetry('supabase', 'push', 'error', err);
    return { ok: false, error: err };
  }
  await recordSyncTelemetry('supabase', 'push', 'ok', undefined);
  return { ok: true };
}

async function runSupabasePull(scope: string): Promise<{ ok: boolean; error?: string }> {
  const guard = await canCallSupabaseSync(`${scope}:pull`);
  if (!guard.ok) {
    await recordSyncTelemetry('supabase', 'pull', 'skipped', guard.reason);
    return { ok: false, error: guard.reason };
  }
  const inv = await syncFromSupabase();
  if (!inv.ok) {
    await recordSyncTelemetry('supabase', 'pull', 'error', inv.error);
    return inv;
  }
  try {
    await pullWorkspaceSettingsFromSupabase();
    await syncAccueilProFromSupabase();
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    await recordSyncTelemetry('supabase', 'pull', 'error', err);
    return { ok: false, error: err };
  }
  await recordSyncTelemetry('supabase', 'pull', 'ok', undefined);
  return { ok: true };
}

export async function runInventorySync(options: {
  scope: string;
  direction: InventorySyncDirection;
}): Promise<InventorySyncResult> {
  const mode = await getDataBackendMode();
  const { scope, direction } = options;

  if (mode === 'local_server') {
    if (direction === 'push') {
      const push = await runLocalPush(scope);
      return { ok: push.ok, backend: 'local_server', pushOk: push.ok, error: push.error };
    }
    if (direction === 'pull') {
      const pull = await runLocalPull(scope);
      return { ok: pull.ok, backend: 'local_server', pullOk: pull.ok, error: pull.error };
    }
    const push = await runLocalPush(scope);
    const pull = push.ok ? await runLocalPull(scope) : { ok: false as const, error: push.error };
    return {
      ok: push.ok && pull.ok,
      backend: 'local_server',
      pushOk: push.ok,
      pullOk: pull.ok,
      error: push.error ?? pull.error,
    };
  }

  if (mode === 'supabase') {
    if (!getIsOnlineRuntime()) {
      const reason = 'OFFLINE';
      await recordSyncTelemetry('supabase', direction === 'pull' ? 'pull' : 'push', 'skipped', reason);
      if (direction === 'bidirectional') {
        await recordSyncTelemetry('supabase', 'pull', 'skipped', reason);
      }
      return { ok: false, backend: 'supabase', error: reason };
    }
    if (direction === 'push') {
      const push = await runSupabasePush(scope);
      return { ok: push.ok, backend: 'supabase', pushOk: push.ok, error: push.error };
    }
    if (direction === 'pull') {
      const pull = await runSupabasePull(scope);
      return { ok: pull.ok, backend: 'supabase', pullOk: pull.ok, error: pull.error };
    }
    const push = await runSupabasePush(scope);
    const pull = push.ok ? await runSupabasePull(scope) : { ok: false as const, error: push.error };
    return {
      ok: push.ok && pull.ok,
      backend: 'supabase',
      pushOk: push.ok,
      pullOk: pull.ok,
      error: push.error ?? pull.error,
    };
  }

  return { ok: false, backend: 'none', error: 'Aucun backend configuré' };
}

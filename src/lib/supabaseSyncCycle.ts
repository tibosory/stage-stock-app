import { isV1LanMode } from '../config/appMode';
import { syncFromSupabase, syncToSupabase } from './supabase';
import { getIsOnlineRuntime } from './networkRuntime';
import { recordSyncTelemetry } from './syncTelemetry';
import { canCallSupabaseSync } from './syncGuards';

/** Sync Supabase (push puis pull) — uniquement si le backend Supabase est sélectionné. */
export async function runSupabaseSyncCycleIfEnabled(): Promise<boolean> {
  if (isV1LanMode()) {
    await recordSyncTelemetry('supabase', 'push', 'skipped', 'Mode V1 LAN');
    await recordSyncTelemetry('supabase', 'pull', 'skipped', 'Mode V1 LAN');
    return false;
  }

  const guard = await canCallSupabaseSync('runSupabaseSyncCycleIfEnabled');
  if (!guard.ok) {
    await recordSyncTelemetry('supabase', 'push', 'skipped', guard.reason);
    await recordSyncTelemetry('supabase', 'pull', 'skipped', guard.reason);
    return false;
  }

  if (!getIsOnlineRuntime()) {
    await recordSyncTelemetry('supabase', 'push', 'skipped', 'OFFLINE');
    await recordSyncTelemetry('supabase', 'pull', 'skipped', 'OFFLINE');
    return false;
  }

  const pushSb = await syncToSupabase();
  await recordSyncTelemetry('supabase', 'push', pushSb.ok ? 'ok' : 'error', pushSb.error);
  if (pushSb.ok) {
    const pullSb = await syncFromSupabase();
    await recordSyncTelemetry('supabase', 'pull', pullSb.ok ? 'ok' : 'error', pullSb.error);
    return pullSb.ok;
  }
  return false;
}

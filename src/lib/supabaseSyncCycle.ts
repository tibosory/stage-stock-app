import { isV1LanMode } from '../config/appMode';
import { isSupabaseConfigured, syncFromSupabase, syncToSupabase } from './supabase';
import { getIsOnlineRuntime } from './networkRuntime';
import { recordSyncTelemetry } from './syncTelemetry';

/** Sync Supabase (push puis pull) — ignorée en mode V1 LAN. */
export async function runSupabaseSyncCycleIfEnabled(): Promise<boolean> {
  if (isV1LanMode()) {
    await recordSyncTelemetry('supabase', 'push', 'skipped', 'Mode V1 LAN');
    await recordSyncTelemetry('supabase', 'pull', 'skipped', 'Mode V1 LAN');
    return false;
  }
  if (isSupabaseConfigured() && getIsOnlineRuntime()) {
    const pushSb = await syncToSupabase();
    await recordSyncTelemetry('supabase', 'push', pushSb.ok ? 'ok' : 'error', pushSb.error);
    if (pushSb.ok) {
      const pullSb = await syncFromSupabase();
      await recordSyncTelemetry('supabase', 'pull', pullSb.ok ? 'ok' : 'error', pullSb.error);
      return pullSb.ok;
    }
    return false;
  }
  if (!getIsOnlineRuntime()) {
    await recordSyncTelemetry('supabase', 'push', 'skipped', 'OFFLINE');
    await recordSyncTelemetry('supabase', 'pull', 'skipped', 'OFFLINE');
  } else if (!isSupabaseConfigured()) {
    await recordSyncTelemetry('supabase', 'push', 'skipped', 'Supabase non configuré');
    await recordSyncTelemetry('supabase', 'pull', 'skipped', 'Supabase non configuré');
  }
  return false;
}

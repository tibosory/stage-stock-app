/**
 * À l’ouverture / retour au premier plan : tente d’abord d’envoyer les changements locaux,
 * puis de recevoir le snapshot serveur (GET /api/sync/snapshot) pour aligner l’inventaire.
 * Silencieux (pas d’alerte) — échoue proprement si l’API est injoignable.
 */
import { AppState, type AppStateStatus } from 'react-native';
import { checkServerReachableQuick } from '../config/stageStockApi';
import { runAutoLanDiscoveryWhenUnreachable } from './consumerAutoConnect';
import { getConsommablesAlerte, getPrets, getMateriel } from '../db/database';
import { reschedulePretReturnReminders } from './pretNotifications';
import { rescheduleVgpDueReminders } from './vgpNotifications';
import { rescheduleSeuilBasReminders } from './seuilNotifications';
import { syncFromInventoryApi, syncToInventoryApi } from './inventoryApiSync';
import { maybeSendAutoAlertEmailsIfNeeded } from './autoAlertEmails';
import { isSupabaseConfigured, syncFromSupabase, syncToSupabase } from './supabase';
import { recordSyncTelemetry } from './syncTelemetry';
import { canCallApiSync } from './syncGuards';
import { getDoubleBackendRuntime } from './doubleBackendRuntime';
import { getIsOnlineRuntime } from './networkRuntime';

let lastRunAt = 0;
/** Évite double exécution (connexion + bascule d’état) sur le même retour d’app. */
const MIN_MS_BETWEEN_RUNS = 4_000;

/** Enregistré depuis App.tsx pour rafraîchir la session après sync (comptes utilisateurs). */
let refreshSessionAfterSync: (() => Promise<void>) | null = null;

export function setForegroundInventorySyncRefreshSession(fn: (() => Promise<void>) | null): void {
  refreshSessionAfterSync = fn;
}

/** Après sync inventaire (pull réussi), rafraîchit la session si enregistré (même mécanisme que retour au 1er plan). */
export async function runRefreshSessionAfterInventoryPullIfRegistered(): Promise<void> {
  try {
    await refreshSessionAfterSync?.();
  } catch {
    /* ignore */
  }
}

export async function runForegroundInventorySync(): Promise<void> {
  const now = Date.now();
  if (lastRunAt > 0 && now - lastRunAt < MIN_MS_BETWEEN_RUNS) return;
  lastRunAt = now;

  try {
    await runAutoLanDiscoveryWhenUnreachable();
    const dualBackend = getDoubleBackendRuntime();
    let gotFreshData = false;
    const apiGuard = await canCallApiSync('runForegroundInventorySync');

    const reachable = apiGuard.ok ? await checkServerReachableQuick() : false;
    if (apiGuard.ok && reachable) {
      const pushApi = await syncToInventoryApi();
      await recordSyncTelemetry('api', 'push', pushApi.ok ? 'ok' : 'error', pushApi.error);
      const pull = await syncFromInventoryApi();
      await recordSyncTelemetry('api', 'pull', pull.ok ? 'ok' : 'error', pull.error);
      if (pull.ok) gotFreshData = true;
    } else if (!apiGuard.ok) {
      await recordSyncTelemetry('api', 'push', 'skipped', apiGuard.reason);
      await recordSyncTelemetry('api', 'pull', 'skipped', apiGuard.reason);
    } else {
      await recordSyncTelemetry('api', 'push', 'skipped', 'Serveur API injoignable');
      await recordSyncTelemetry('api', 'pull', 'skipped', 'Serveur API injoignable');
    }

    if (dualBackend && isSupabaseConfigured() && getIsOnlineRuntime()) {
      const pushSb = await syncToSupabase();
      await recordSyncTelemetry('supabase', 'push', pushSb.ok ? 'ok' : 'error', pushSb.error);
      if (pushSb.ok) {
        const pullSb = await syncFromSupabase();
        await recordSyncTelemetry('supabase', 'pull', pullSb.ok ? 'ok' : 'error', pullSb.error);
        if (pullSb.ok) gotFreshData = true;
      }
    } else if (!getIsOnlineRuntime()) {
      await recordSyncTelemetry('supabase', 'push', 'skipped', 'OFFLINE');
      await recordSyncTelemetry('supabase', 'pull', 'skipped', 'OFFLINE');
    } else if (dualBackend && !isSupabaseConfigured()) {
      await recordSyncTelemetry('supabase', 'push', 'skipped', 'Supabase non configuré');
      await recordSyncTelemetry('supabase', 'pull', 'skipped', 'Supabase non configuré');
    }

    if (gotFreshData) {
      await runRefreshSessionAfterInventoryPullIfRegistered();
      const [prets, mats, seuils] = await Promise.all([
        getPrets(),
        getMateriel(),
        getConsommablesAlerte(),
      ]);
      await reschedulePretReturnReminders(prets);
      await rescheduleVgpDueReminders(mats);
      await rescheduleSeuilBasReminders(seuils);
      void maybeSendAutoAlertEmailsIfNeeded();
    }
  } catch {
    /* silencieux — hors ligne ou API indisponible */
  }
}

export function subscribeForegroundInventorySync(): () => void {
  const onChange = (s: AppStateStatus) => {
    if (s === 'active') void runForegroundInventorySync();
  };
  const sub = AppState.addEventListener('change', onChange);
  void runForegroundInventorySync();
  return () => sub.remove();
}

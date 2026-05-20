/**
 * À l’ouverture / retour au premier plan : sync API inventaire (PC LAN).
 * Supabase ignoré en mode V1 LAN.
 */
import { AppState, type AppStateStatus } from 'react-native';
import { checkServerReachableQuick } from '../config/stageStockApi';
import { runAutoLanDiscoveryWhenUnreachable } from './consumerAutoConnect';
import { getPrets } from '../db/loanDb';
import { getMateriel, getConsommablesAlerte } from '../db/inventoryDb';
import { reschedulePretReturnReminders } from './pretNotifications';
import { rescheduleVgpDueReminders } from './vgpNotifications';
import { rescheduleSeuilBasReminders } from './seuilNotifications';
import { syncFromInventoryApi, syncToInventoryApi } from './inventoryApiSync';
import { maybeSendAutoAlertEmailsIfNeeded } from './autoAlertEmails';
import { canCallApiSync } from './syncGuards';
import { recordSyncTelemetry } from './syncTelemetry';
import { runSupabaseSyncCycleIfEnabled } from './supabaseSyncCycle';
import { notifyForegroundSyncIssue } from './syncUserFeedback';

let lastRunAt = 0;
const MIN_MS_BETWEEN_RUNS = 4_000;

let refreshSessionAfterSync: (() => Promise<void>) | null = null;

export function setForegroundInventorySyncRefreshSession(fn: (() => Promise<void>) | null): void {
  refreshSessionAfterSync = fn;
}

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
    let gotFreshData = false;
    const apiGuard = await canCallApiSync('runForegroundInventorySync');
    const reachable = apiGuard.ok ? await checkServerReachableQuick() : false;

    if (await runSupabaseSyncCycleIfEnabled()) {
      gotFreshData = true;
    }

    if (apiGuard.ok && reachable) {
      const pushApi = await syncToInventoryApi();
      await recordSyncTelemetry('api', 'push', pushApi.ok ? 'ok' : 'error', pushApi.error);
      const pull = await syncFromInventoryApi();
      await recordSyncTelemetry('api', 'pull', pull.ok ? 'ok' : 'error', pull.error);
      if (pull.ok) gotFreshData = true;
      if (!pushApi.ok || !pull.ok) {
        notifyForegroundSyncIssue(
          'Synchronisation incomplète',
          pushApi.error ?? pull.error ?? 'Le PC de la salle est injoignable ou a refusé la sync. Vérifiez le Wi‑Fi et l’onglet Connexion.'
        );
      }
    } else if (!apiGuard.ok) {
      await recordSyncTelemetry('api', 'push', 'skipped', apiGuard.reason);
      await recordSyncTelemetry('api', 'pull', 'skipped', apiGuard.reason);
    } else {
      await recordSyncTelemetry('api', 'push', 'skipped', 'Serveur API injoignable');
      await recordSyncTelemetry('api', 'pull', 'skipped', 'Serveur API injoignable');
      notifyForegroundSyncIssue(
        'PC non joignable',
        'Le serveur local ne répond pas. Vérifiez que le PC est allumé, sur le même Wi‑Fi, puis ouvrez Connexion pour tester.'
      );
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
    /* ignore */
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

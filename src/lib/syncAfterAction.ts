/**
 * Option Paramètres : après une action locale (sauvegarde prêt, matériel, etc.), envoi puis réception
 * depuis **Supabase** (si configuré + en ligne) puis depuis l’**API inventaire** si joignable.
 * Désactivé par défaut (économie réseau / batterie).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { checkServerReachableQuick } from '../config/stageStockApi';
import { getPrets } from '../db/loanDb';
import { getMateriel, getConsommablesAlerte } from '../db/inventoryDb';
import { reschedulePretReturnReminders } from './pretNotifications';
import { rescheduleVgpDueReminders } from './vgpNotifications';
import { rescheduleSeuilBasReminders } from './seuilNotifications';
import { syncFromInventoryApi, syncToInventoryApi } from './inventoryApiSync';
import { runRefreshSessionAfterInventoryPullIfRegistered } from './foregroundInventorySync';
import { maybeSendAutoAlertEmailsIfNeeded } from './autoAlertEmails';
import { recordSyncTelemetry } from './syncTelemetry';
import { canCallApiSync } from './syncGuards';
import { runSupabaseSyncCycleIfEnabled } from './supabaseSyncCycle';

const STORAGE_KEY = 'stagestock_sync_after_each_action';

export async function getSyncAfterEachActionEnabled(): Promise<boolean> {
  const v = await AsyncStorage.getItem(STORAGE_KEY);
  return v === '1';
}

export async function setSyncAfterEachActionEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
}

let lastTriggerAt = 0;
const DEBOUNCE_MS = 2_500;

export async function triggerSyncAfterActionIfEnabled(): Promise<void> {
  if (!(await getSyncAfterEachActionEnabled())) return;

  const now = Date.now();
  if (lastTriggerAt > 0 && now - lastTriggerAt < DEBOUNCE_MS) return;
  lastTriggerAt = now;

  try {
    let gotFreshData = false;
    const apiGuard = await canCallApiSync('triggerSyncAfterActionIfEnabled');

    if (await runSupabaseSyncCycleIfEnabled()) {
      gotFreshData = true;
    }

    if (apiGuard.ok && (await checkServerReachableQuick())) {
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
    /* silencieux */
  }
}

/**
 * Option Paramètres : après une action locale (sauvegarde prêt, matériel, etc.), envoyer puis recevoir
 * depuis l’API pour se rapprocher du temps réel. Désactivé par défaut (économie réseau / batterie).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { checkServerReachableQuick } from '../config/stageStockApi';
import { getConsommablesAlerte, getMateriel, getPrets } from '../db/database';
import { reschedulePretReturnReminders } from './pretNotifications';
import { rescheduleVgpDueReminders } from './vgpNotifications';
import { rescheduleSeuilBasReminders } from './seuilNotifications';
import { syncFromInventoryApi, syncToInventoryApi } from './inventoryApiSync';
import { runRefreshSessionAfterInventoryPullIfRegistered } from './foregroundInventorySync';
import { maybeSendAutoAlertEmailsIfNeeded } from './autoAlertEmails';

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
    if (!(await checkServerReachableQuick())) return;
    await syncToInventoryApi();
    const pull = await syncFromInventoryApi();
    if (pull.ok) {
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

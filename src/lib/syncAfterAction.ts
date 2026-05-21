/**
 * Option Paramètres : après une action locale (sauvegarde prêt, matériel, etc.), envoi puis réception
 * vers le backend choisi (serveur local **ou** Supabase), jamais les deux.
 * Désactivé par défaut (économie réseau / batterie).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getPrets } from '../db/loanDb';
import { getMateriel, getConsommablesAlerte } from '../db/inventoryDb';
import { reschedulePretReturnReminders } from './pretNotifications';
import { rescheduleVgpDueReminders } from './vgpNotifications';
import { rescheduleSeuilBasReminders } from './seuilNotifications';
import { runRefreshSessionAfterInventoryPullIfRegistered } from './foregroundInventorySync';
import { maybeSendAutoAlertEmailsIfNeeded } from './autoAlertEmails';
import { runInventorySync } from './inventorySyncOrchestrator';

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
    const result = await runInventorySync({
      scope: 'triggerSyncAfterActionIfEnabled',
      direction: 'bidirectional',
    });

    if (result.ok) {
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

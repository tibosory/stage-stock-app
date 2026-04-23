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
    const reachable = await checkServerReachableQuick();
    if (!reachable) return;

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

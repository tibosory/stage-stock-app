/**
 * À l’ouverture / retour au premier plan : sync inventaire vers le backend choisi
 * (serveur local **ou** Supabase), jamais les deux.
 */
import { AppState, type AppStateStatus } from 'react-native';
import { runAutoLanDiscoveryWhenUnreachable } from './consumerAutoConnect';
import { getPrets } from '../db/loanDb';
import { getMateriel, getConsommablesAlerte } from '../db/inventoryDb';
import { reschedulePretReturnReminders } from './pretNotifications';
import { rescheduleVgpDueReminders } from './vgpNotifications';
import { rescheduleSeuilBasReminders } from './seuilNotifications';
import { maybeSendAutoAlertEmailsIfNeeded } from './autoAlertEmails';
import { recordSyncTelemetry } from './syncTelemetry';
import { notifyForegroundSyncIssue } from './syncUserFeedback';
import { getDataBackendMode } from './backendMode';
import { runInventorySync } from './inventorySyncOrchestrator';

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
    const backendMode = await getDataBackendMode();
    if (backendMode === 'local_server') {
      await runAutoLanDiscoveryWhenUnreachable();
    }

    const result = await runInventorySync({
      scope: 'runForegroundInventorySync',
      direction: 'bidirectional',
    });

    if (!result.ok) {
      if (backendMode === 'local_server') {
        notifyForegroundSyncIssue(
          'PC non joignable',
          result.error ??
            'Le serveur local ne répond pas. Vérifiez que le PC est allumé, sur le même Wi‑Fi ou Tailscale, puis ouvrez Connexion pour tester.'
        );
      } else if (backendMode === 'supabase' && result.error === 'OFFLINE') {
        await recordSyncTelemetry('supabase', 'push', 'skipped', 'OFFLINE');
        await recordSyncTelemetry('supabase', 'pull', 'skipped', 'OFFLINE');
      } else if (backendMode === 'supabase') {
        notifyForegroundSyncIssue(
          'Synchronisation cloud incomplète',
          result.error ?? 'Impossible de synchroniser avec Supabase. Vérifiez la connexion Internet et la configuration cloud.'
        );
      } else if (backendMode === 'local_server' && (result.pushOk === false || result.pullOk === false)) {
        notifyForegroundSyncIssue(
          'Synchronisation incomplète',
          result.error ??
            'Le PC de la salle est injoignable ou a refusé la sync. Vérifiez le Wi‑Fi, Tailscale et l’onglet Connexion.'
        );
      }
      return;
    }

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

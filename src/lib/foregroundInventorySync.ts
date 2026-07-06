/**
 * À l’ouverture / retour au premier plan : sync inventaire vers le backend choisi
 * (serveur local **ou** Supabase), jamais les deux.
 */
import { AppState, type AppStateStatus } from 'react-native';
import { runAutoLanDiscoveryWhenUnreachable } from './consumerAutoConnect';
import { isPairingInProgress } from './pairingSessionGuard';
import { getPrets } from '../db/loanDb';
import { getMateriel, getConsommablesAlerte } from '../db/inventoryDb';
import { reschedulePretReturnReminders } from './pretNotifications';
import { rescheduleVgpDueReminders } from './vgpNotifications';
import { rescheduleSeuilBasReminders } from './seuilNotifications';
import { maybeSendAutoAlertEmailsIfNeeded } from './autoAlertEmails';
import { recordSyncTelemetry } from './syncTelemetry';
import { notifyForegroundSyncIssue } from './syncUserFeedback';
import { getEffectiveSupabaseUrlForDisplay } from './supabase';
import { runInventorySync } from './inventorySyncOrchestrator';
import { getDataBackendMode } from './backendMode';
import { hasCompletedWorkspaceOnboarding } from './workspaceOnboardingStorage';
import { isInvalidSnapshotJsonError } from './syncSnapshotResponseHint';
import { getForegroundSyncSkipWhenIdle } from './securityFlags';
import { loadSyncHealthSnapshot } from './syncHealthSnapshot';
import { formatPartialInventorySyncError, isPartialInventorySync } from './inventorySyncPartial';

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

  try {
    if (await getForegroundSyncSkipWhenIdle()) {
      const health = await loadSyncHealthSnapshot();
      if (!health.hasPendingWork) return;
    }
  } catch {
    /* continue sync if health probe fails */
  }

  lastRunAt = now;

  try {
    const backendMode = await getDataBackendMode();
    if (backendMode === 'local_server') {
      if (!isPairingInProgress()) {
        await runAutoLanDiscoveryWhenUnreachable();
      }
    }

    const result = await runInventorySync({
      scope: 'runForegroundInventorySync',
      direction: 'bidirectional',
    });

    if (!result.ok) {
      const onboardingDone = await hasCompletedWorkspaceOnboarding();
      const suppressAlert = isPairingInProgress() || !onboardingDone;
      if (suppressAlert) {
        return;
      }
      if (result.error === 'OFFLINE' && backendMode === 'supabase') {
        await recordSyncTelemetry('supabase', 'push', 'skipped', 'OFFLINE');
        await recordSyncTelemetry('supabase', 'pull', 'skipped', 'OFFLINE');
        return;
      }
      if (isPartialInventorySync(result)) {
        notifyForegroundSyncIssue(
          'Synchronisation incomplète',
          formatPartialInventorySyncError(result)
        );
        return;
      }
      if (backendMode === 'local_server') {
        const title = isInvalidSnapshotJsonError(result.error)
          ? 'Réponse serveur incorrecte'
          : 'PC non joignable';
        notifyForegroundSyncIssue(
          title,
          result.error ??
            'Le serveur local ne répond pas. Vérifiez que le PC est allumé, sur le même Wi‑Fi ou Tailscale, puis ouvrez Connexion pour tester.'
        );
      } else if (backendMode === 'supabase') {
        const projectUrl = getEffectiveSupabaseUrlForDisplay();
        const urlHint = projectUrl
          ? `\n\nProjet configuré : ${projectUrl}\nSi l’erreur mentionne une table « schema cache », rescannez le QR d’invitation (Connexion) ou exécutez le schéma SQL complet sur ce projet Supabase, puis attendez 1 min.`
          : '';
        notifyForegroundSyncIssue(
          'Synchronisation cloud incomplète',
          (result.error ?? 'Impossible de synchroniser avec Supabase. Vérifiez la connexion Internet et la configuration cloud.') +
            urlHint
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

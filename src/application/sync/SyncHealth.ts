import type { SyncState } from './SyncStateStore';
import type { SyncQueueStats } from '../../saas/services/offlineSync';

export type SyncHealth = {
  score: number;
  level: 'healthy' | 'warning' | 'critical';
  reasons: string[];
};

export function computeSyncHealth(state: SyncState, queue: SyncQueueStats | null): SyncHealth {
  let score = 100;
  const reasons: string[] = [];
  const qSize = queue?.size ?? 0;
  const retries = queue?.retryingCount ?? 0;
  const failures = state.consecutiveFailures ?? 0;

  if (qSize > 50) {
    score -= 30;
    reasons.push(`Queue élevée (${qSize})`);
  } else if (qSize > 10) {
    score -= 15;
    reasons.push(`Queue modérée (${qSize})`);
  }

  if (retries > 0) {
    score -= Math.min(20, retries * 2);
    reasons.push(`Tâches en retry (${retries})`);
  }

  if (state.phase === 'error') {
    score -= 30;
    reasons.push(`Dernière sync en erreur (${state.lastErrorCategory ?? 'unknown'})`);
  }

  if (failures > 0) {
    score -= Math.min(20, failures * 4);
    reasons.push(`Échecs consécutifs (${failures})`);
  }

  score = Math.max(0, Math.min(100, score));
  const level: SyncHealth['level'] = score >= 75 ? 'healthy' : score >= 45 ? 'warning' : 'critical';
  if (reasons.length === 0) reasons.push('Aucun signal de dégradation');
  return { score, level, reasons };
}

import { SyncService } from '../services/SyncService';
import { getSyncState, setSyncState } from './SyncStateStore';
import { computeSyncBackoffDelay } from './SyncBackoff';

let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;
let baseIntervalMs = 30000;

function getCurrentIntervalMs(): number {
  return computeSyncBackoffDelay(baseIntervalMs, getSyncState().consecutiveFailures ?? 0);
}

function normalizePhaseAfterTick(): void {
  if (getSyncState().phase === 'running') {
    setSyncState({ phase: 'idle' });
  }
}

function scheduleNextTick(): void {
  const delay = getCurrentIntervalMs();
  setSyncState({
    schedulerActive: true,
    nextBackoffMs: delay,
    nextScheduledAt: new Date(Date.now() + delay).toISOString(),
  });
  timer = setTimeout(runOneTick, delay);
}

function runOneTick(): void {
  if (running) {
    scheduleNextTick();
    return;
  }
  running = true;
  void SyncService.syncAllOfflineQueues()
    .catch(() => undefined)
    .finally(() => {
      running = false;
      normalizePhaseAfterTick();
      scheduleNextTick();
    });
}

export function triggerSyncNow(): Promise<void> {
  return SyncService.syncAllOfflineQueues();
}

export function startSyncScheduler(intervalMs: number = 30000): () => void {
  if (timer) return () => stopSyncScheduler();
  baseIntervalMs = intervalMs;
  scheduleNextTick();

  return () => stopSyncScheduler();
}

export function stopSyncScheduler(): void {
  if (!timer) return;
  clearTimeout(timer);
  timer = null;
  setSyncState({
    schedulerActive: false,
    nextScheduledAt: undefined,
    nextBackoffMs: undefined,
  });
}

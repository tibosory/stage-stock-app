import { flushSyncQueue } from '../../saas/services/offlineSync';
import { syncTrackingOfflineQueue } from '../../services/tracking/offlineSync';
import { getSyncState, setSyncState } from '../sync/SyncStateStore';
import { classifySyncError } from '../sync/SyncErrorClassifier';

export const SyncService = {
  async syncAllOfflineQueues(): Promise<void> {
    const startedAt = new Date().toISOString();
    setSyncState({
      phase: 'running',
      lastRunAt: startedAt,
      lastErrorMessage: undefined,
    });
    try {
      await syncTrackingOfflineQueue();
      await flushSyncQueue();
      setSyncState({
        phase: 'success',
        lastSuccessAt: new Date().toISOString(),
        consecutiveFailures: 0,
        lastErrorMessage: undefined,
      });
    } catch (e) {
      const classified = classifySyncError(e);
      const prevFailures = (getSyncState().consecutiveFailures ?? 0) + 1;
      setSyncState({
        phase: 'error',
        lastErrorAt: new Date().toISOString(),
        lastErrorCode: classified.code,
        lastErrorCategory: classified.category,
        lastErrorMessage: classified.message,
        consecutiveFailures: prevFailures,
      });
      throw e;
    }
  },

  resetSyncFailureCounters(): void {
    setSyncState({
      consecutiveFailures: 0,
      lastErrorAt: undefined,
      lastErrorCode: undefined,
      lastErrorCategory: undefined,
      lastErrorMessage: undefined,
      phase: 'idle',
    });
  },
};

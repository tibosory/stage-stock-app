import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabase } from '../../lib/supabase';
import { resolveLww } from '../../application/sync/ConflictResolver';
import {
  planQueuePurge as planQueuePurgeCore,
  type PurgeSyncQueueResult,
} from '../../application/sync/SyncQueuePurge';

type SyncTask = {
  id: string;
  table: string;
  op: 'upsert' | 'delete';
  payload: Record<string, unknown>;
  organization_id: string;
  updated_at: string;
  retries: number;
};

export type SyncQueueStats = {
  size: number;
  retryingCount: number;
  maxRetries: number;
  oldestUpdatedAt?: string;
  newestUpdatedAt?: string;
  byTable: Record<string, number>;
};


const KEY = 'stagestock_saas_sync_queue_v1';
const MAX_RETRY = 6;

async function readQueue(): Promise<SyncTask[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SyncTask[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue: SyncTask[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(queue));
}

export async function enqueueSyncTask(task: Omit<SyncTask, 'retries'>): Promise<void> {
  const q = await readQueue();
  q.push({ ...task, retries: 0 });
  await writeQueue(q);
}

export async function getSyncQueueStats(): Promise<SyncQueueStats> {
  const q = await readQueue();
  const byTable: Record<string, number> = {};
  let retryingCount = 0;
  let maxRetries = 0;
  let oldestTs = Number.POSITIVE_INFINITY;
  let newestTs = 0;

  for (const t of q) {
    byTable[t.table] = (byTable[t.table] ?? 0) + 1;
    if (t.retries > 0) retryingCount += 1;
    if (t.retries > maxRetries) maxRetries = t.retries;
    const ts = Date.parse(t.updated_at);
    if (Number.isFinite(ts)) {
      if (ts < oldestTs) oldestTs = ts;
      if (ts > newestTs) newestTs = ts;
    }
  }

  return {
    size: q.length,
    retryingCount,
    maxRetries,
    oldestUpdatedAt: Number.isFinite(oldestTs) ? new Date(oldestTs).toISOString() : undefined,
    newestUpdatedAt: newestTs > 0 ? new Date(newestTs).toISOString() : undefined,
    byTable,
  };
}

export function planQueuePurge(
  queue: SyncTask[],
  options?: { allowCritical?: boolean; maxRetriesToKeep?: number }
): { nextQueue: SyncTask[]; result: PurgeSyncQueueResult } {
  return planQueuePurgeCore(queue, options);
}

export async function purgeSyncQueueSafely(options?: {
  allowCritical?: boolean;
  maxRetriesToKeep?: number;
}): Promise<PurgeSyncQueueResult> {
  const q = await readQueue();
  const { nextQueue, result } = planQueuePurge(q, options);
  await writeQueue(nextQueue);
  return result;
}

export async function flushSyncQueue(): Promise<void> {
  const q = await readQueue();
  if (q.length === 0) return;
  const sb = getSupabase();
  const next: SyncTask[] = [];
  for (const t of q) {
    try {
      if (t.op === 'upsert') {
        const { error } = await sb.from(t.table).upsert([t.payload]);
        if (error) throw error;
      } else {
        const id = String(t.payload.id ?? '');
        if (!id) throw new Error('Missing id for delete task');
        const { error } = await sb.from(t.table).delete().eq('id', id);
        if (error) throw error;
      }
    } catch {
      if (t.retries + 1 < MAX_RETRY) {
        next.push({ ...t, retries: t.retries + 1 });
      }
    }
  }
  await writeQueue(next);
}

/**
 * Résolution simple de conflit:
 * dernier updated_at gagne (last-write-wins).
 */
export function resolveConflictLww<T extends { updated_at?: string }>(localRow: T, remoteRow: T): T {
  return resolveLww(localRow, remoteRow, 'prefer_local');
}

import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = 'stagestock_sync_queue_v1';
const MAX_RETRY = 8;
const BASE_BACKOFF_MS = 2_000;
const MAX_BACKOFF_MS = 5 * 60_000;

let memoryQueue = null;
let loadingPromise = null;

function nowIso() {
  return new Date().toISOString();
}

function toMs(iso) {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : 0;
}

function computeBackoffMs(retryCount) {
  const ms = BASE_BACKOFF_MS * Math.pow(2, Math.max(0, retryCount - 1));
  return Math.min(ms, MAX_BACKOFF_MS);
}

async function ensureLoaded() {
  if (Array.isArray(memoryQueue)) return memoryQueue;
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(QUEUE_KEY);
      memoryQueue = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(memoryQueue)) memoryQueue = [];
    } catch (error) {
      console.log('[queueService] load error:', error);
      memoryQueue = [];
    } finally {
      loadingPromise = null;
    }
    return memoryQueue;
  })();
  return loadingPromise;
}

async function persist() {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(memoryQueue || []));
}

function dedupeByMovementId(list) {
  const map = new Map();
  for (const item of list) {
    if (!item?.movementId) continue;
    map.set(item.movementId, { ...map.get(item.movementId), ...item });
  }
  return [...map.values()];
}

export async function getQueueStats() {
  const q = await ensureLoaded();
  return {
    count: q.length,
    pendingApi: q.filter(x => x.pendingApi).length,
    pendingSupabase: q.filter(x => x.pendingSupabase).length,
  };
}

export async function getQueueSnapshot() {
  const q = await ensureLoaded();
  return [...q];
}

export async function enqueueMovementTask(task) {
  const q = await ensureLoaded();
  const normalized = {
    movementId: String(task.movementId || ''),
    payload: task.payload || {},
    pendingApi: !!task.pendingApi,
    pendingSupabase: !!task.pendingSupabase,
    createdAt: task.createdAt || nowIso(),
    updatedAt: nowIso(),
    retryCount: Number(task.retryCount || 0),
    nextRetryAt: task.nextRetryAt || nowIso(),
    lastError: task.lastError || null,
  };
  if (!normalized.movementId) {
    throw new Error('movementId requis pour la queue');
  }
  const merged = dedupeByMovementId([...q, normalized]).sort(
    (a, b) => toMs(a.createdAt) - toMs(b.createdAt)
  );
  memoryQueue = merged;
  await persist();
  console.log('[queueService] enqueue:', normalized.movementId, {
    pendingApi: normalized.pendingApi,
    pendingSupabase: normalized.pendingSupabase,
    size: memoryQueue.length,
  });
  return normalized;
}

export async function upsertMovementTask(update) {
  const q = await ensureLoaded();
  const idx = q.findIndex(x => x.movementId === update.movementId);
  if (idx < 0) {
    return enqueueMovementTask(update);
  }
  q[idx] = {
    ...q[idx],
    ...update,
    updatedAt: nowIso(),
  };
  memoryQueue = dedupeByMovementId(q).sort((a, b) => toMs(a.createdAt) - toMs(b.createdAt));
  await persist();
  return q[idx];
}

export async function removeMovementTask(movementId) {
  const q = await ensureLoaded();
  memoryQueue = q.filter(x => x.movementId !== movementId);
  await persist();
  console.log('[queueService] remove:', movementId, 'size=', memoryQueue.length);
}

export async function markTaskFailure(movementId, errorMessage) {
  const q = await ensureLoaded();
  const idx = q.findIndex(x => x.movementId === movementId);
  if (idx < 0) return;
  const prev = q[idx];
  const retryCount = Math.min(MAX_RETRY, Number(prev.retryCount || 0) + 1);
  const waitMs = computeBackoffMs(retryCount);
  const nextRetryAt = new Date(Date.now() + waitMs).toISOString();
  q[idx] = {
    ...prev,
    retryCount,
    nextRetryAt,
    lastError: errorMessage || 'UNKNOWN_ERROR',
    updatedAt: nowIso(),
  };
  memoryQueue = q;
  await persist();
  console.log('[queueService] fail:', movementId, {
    retryCount,
    waitMs,
    nextRetryAt,
    error: errorMessage || 'UNKNOWN_ERROR',
  });
}

export async function getReadyTasks(limit = 30) {
  const q = await ensureLoaded();
  const now = Date.now();
  return q
    .filter(x => toMs(x.nextRetryAt) <= now)
    .sort((a, b) => toMs(a.createdAt) - toMs(b.createdAt))
    .slice(0, Math.max(1, limit));
}

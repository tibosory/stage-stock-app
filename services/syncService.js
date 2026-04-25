import { getSupabase } from '../src/lib/supabase';
import {
  getDoubleBackendRuntime,
  isDoubleBackendRuntimeInitialized,
  loadDoubleBackendRuntimeFromStorage,
} from '../src/lib/doubleBackendRuntime';
import { getIsOnlineRuntime } from '../src/lib/networkRuntime';
import {
  enqueueMovementTask,
  getQueueSnapshot,
  getReadyTasks,
  getQueueStats,
  markTaskFailure,
  removeMovementTask,
  upsertMovementTask,
} from './queueService';

const API_URL = (process.env.EXPO_PUBLIC_API_URL || '').trim();
const FLUSH_BATCH_SIZE = 25;
let flushInProgress = false;

function nowIso() {
  return new Date().toISOString();
}

function uuidLike() {
  return (
    Date.now().toString(36) +
    '-' +
    Math.random().toString(36).slice(2, 10) +
    '-' +
    Math.random().toString(36).slice(2, 6)
  );
}

function normalizeMovement(data) {
  const payload = { ...(data || {}) };
  payload.id = String(payload.id || uuidLike());
  payload.created_at = payload.created_at || nowIso();
  payload.client_created_at = payload.client_created_at || payload.created_at;
  payload.client_updated_at = nowIso();
  return payload;
}

async function getDoubleBackendEnabled() {
  if (isDoubleBackendRuntimeInitialized()) return getDoubleBackendRuntime();
  const loaded = await loadDoubleBackendRuntimeFromStorage();
  return loaded;
}

async function canCallLocalApi(scope) {
  const DOUBLE_BACKEND = await getDoubleBackendEnabled();
  if (!DOUBLE_BACKEND || !API_URL) {
    console.log(
      `[syncService] ${scope}: local API skipped (DOUBLE_BACKEND=${DOUBLE_BACKEND}, API_URL=${API_URL ? 'set' : 'missing'})`
    );
    return false;
  }
  return true;
}

async function safeFetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }
  return { response, json, text };
}

async function sendToLocalApi(payload) {
  if (!(await canCallLocalApi('sendToLocalApi'))) {
    return { ok: false, skipped: true, reason: 'DOUBLE_BACKEND_OFF_OR_API_URL_MISSING' };
  }
  try {
    const { response, text } = await safeFetchJson(`${API_URL.replace(/\/+$/, '')}/mouvements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': String(payload.id),
      },
      body: JSON.stringify(payload),
    });
    if (response.ok || response.status === 409) {
      return { ok: true };
    }
    return { ok: false, error: `HTTP ${response.status} ${text || ''}`.trim() };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function sendToSupabase(payload) {
  if (!getIsOnlineRuntime()) {
    return { ok: false, skipped: true, reason: 'OFFLINE' };
  }
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('mouvements').upsert([payload], { onConflict: 'id' });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function flushOneTask(task) {
  const movementId = String(task.movementId);
  let pendingApi = !!task.pendingApi;
  let pendingSupabase = !!task.pendingSupabase;

  if (pendingApi) {
    const apiRes = await sendToLocalApi(task.payload);
    if (apiRes.ok || apiRes.skipped) {
      pendingApi = false;
      if (apiRes.skipped) {
        console.log(`[syncService] queue ${movementId}: API skipped (${apiRes.reason})`);
      }
    } else {
      await markTaskFailure(movementId, `API:${apiRes.error || 'UNKNOWN'}`);
      return { ok: false, movementId, error: apiRes.error || 'API_FAIL' };
    }
  }

  if (pendingSupabase) {
    const sbRes = await sendToSupabase(task.payload);
    if (sbRes.ok || sbRes.skipped) {
      pendingSupabase = sbRes.skipped ? true : false;
      if (sbRes.skipped) {
        await markTaskFailure(movementId, `SUPABASE:${sbRes.reason || 'SKIPPED'}`);
        return { ok: false, movementId, error: sbRes.reason || 'SUPABASE_SKIPPED' };
      }
    } else {
      await markTaskFailure(movementId, `SUPABASE:${sbRes.error || 'UNKNOWN'}`);
      return { ok: false, movementId, error: sbRes.error || 'SUPABASE_FAIL' };
    }
  }

  if (!pendingApi && !pendingSupabase) {
    await removeMovementTask(movementId);
  } else {
    await upsertMovementTask({
      movementId,
      payload: task.payload,
      pendingApi,
      pendingSupabase,
      retryCount: 0,
      nextRetryAt: nowIso(),
      lastError: null,
    });
  }

  return { ok: true, movementId };
}

export async function flushQueue(options = {}) {
  if (flushInProgress) {
    return { ok: true, skipped: true, reason: 'FLUSH_IN_PROGRESS' };
  }
  flushInProgress = true;
  const limit = Number(options.limit || FLUSH_BATCH_SIZE);
  let processed = 0;
  let failed = 0;
  try {
    const ready = await getReadyTasks(limit);
    if (ready.length === 0) {
      return { ok: true, processed: 0, failed: 0 };
    }
    for (const task of ready) {
      const r = await flushOneTask(task);
      processed += 1;
      if (!r.ok) failed += 1;
    }
    const stats = await getQueueStats();
    console.log('[syncService] flushQueue done:', { processed, failed, remaining: stats.count });
    return { ok: failed === 0, processed, failed, remaining: stats.count };
  } finally {
    flushInProgress = false;
  }
}

/**
 * Enregistrement mouvement robuste :
 * - horodatage systématique
 * - anti-doublons via ID stable
 * - persistance queue avant envoi (no data loss)
 * - tentative immédiate + retry auto ensuite
 */
export async function createMouvement(data) {
  const payload = normalizeMovement(data);
  await enqueueMovementTask({
    movementId: payload.id,
    payload,
    pendingApi: await canCallLocalApi('createMouvement'),
    pendingSupabase: true,
    createdAt: payload.client_created_at || nowIso(),
    nextRetryAt: nowIso(),
  });

  const flush = await flushQueue({ limit: 1 });
  const q = await getQueueSnapshot();
  const stillQueued = q.find(x => x.movementId === payload.id);
  const result = {
    ok: !stillQueued,
    mouvementId: payload.id,
    queued: !!stillQueued,
    flush,
  };
  console.log('[syncService] createMouvement result:', result);
  return result;
}

/**
 * Récupère les mouvements non synchronisés API locale, puis les pousse vers Supabase (upsert anti-doublons).
 */
export async function syncFromAPI() {
  if (!(await canCallLocalApi('syncFromAPI'))) {
    return { ok: true, synced: 0, skipped: true, reason: 'DOUBLE_BACKEND_OFF_OR_API_URL_MISSING' };
  }
  if (!getIsOnlineRuntime()) {
    console.log('[syncService] syncFromAPI skipped: OFFLINE for Supabase target');
    return { ok: false, synced: 0, error: 'OFFLINE' };
  }
  try {
    const { response, json, text } = await safeFetchJson(
      `${API_URL.replace(/\/+$/, '')}/mouvements?synced=false`,
      { method: 'GET' }
    );
    if (!response.ok) {
      const msg = `HTTP ${response.status} ${text || ''}`.trim();
      console.log('[syncService] syncFromAPI local API failed:', msg);
      return { ok: false, synced: 0, error: msg };
    }
    const rows = Array.isArray(json) ? json.map(normalizeMovement) : [];
    if (rows.length === 0) return { ok: true, synced: 0 };
    const supabase = getSupabase();
    const { error } = await supabase.from('mouvements').upsert(rows, { onConflict: 'id' });
    if (error) {
      console.log('[syncService] syncFromAPI Supabase upsert failed:', error.message);
      return { ok: false, synced: 0, error: error.message };
    }
    console.log('[syncService] syncFromAPI synced:', rows.length);
    return { ok: true, synced: rows.length };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log('[syncService] syncFromAPI exception:', msg);
    return { ok: false, synced: 0, error: msg };
  }
}

/**
 * Source principale : Supabase uniquement.
 */
export async function getStocks() {
  if (!getIsOnlineRuntime()) {
    console.log('[syncService] getStocks Supabase skipped: OFFLINE');
    return { ok: false, data: [], error: 'OFFLINE' };
  }
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('stocks').select('*');
    if (error) {
      console.log('[syncService] getStocks Supabase error:', error.message);
      return { ok: false, data: [], error: error.message };
    }
    return { ok: true, data: data || [] };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log('[syncService] getStocks exception:', msg);
    return { ok: false, data: [], error: msg };
  }
}

/**
 * À appeler au retour online pour reprise automatique.
 */
export async function syncOnNetworkBack() {
  console.log('[syncService] syncOnNetworkBack start');
  const r1 = await flushQueue({ limit: FLUSH_BATCH_SIZE });
  const r2 = await syncFromAPI();
  const stats = await getQueueStats();
  console.log('[syncService] syncOnNetworkBack done', { flush: r1, fromApi: r2, queue: stats });
  return { flush: r1, fromApi: r2, queue: stats };
}

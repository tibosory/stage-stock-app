import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabase } from '../src/lib/supabase';

const API_URL = (process.env.EXPO_PUBLIC_API_URL || '').trim();
const DUAL_BACKEND_STORAGE_KEY = 'stagestock_sync_dual_backend';

async function getDoubleBackendEnabled() {
  try {
    const raw = await AsyncStorage.getItem(DUAL_BACKEND_STORAGE_KEY);
    return raw === '1';
  } catch (error) {
    console.log('[syncService] read DOUBLE_BACKEND failed:', error);
    return false;
  }
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

/**
 * 1) Envoi optionnel vers API locale (si double backend + URL)
 * 2) Envoi systématique vers Supabase
 */
export async function createMouvement(data) {
  const supabase = getSupabase();
  let localApiOk = false;
  let supabaseOk = false;
  let localApiError = null;
  let supabaseError = null;

  if (await canCallLocalApi('createMouvement')) {
    try {
      const { response, text } = await safeFetchJson(`${API_URL.replace(/\/+$/, '')}/mouvements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        localApiError = `HTTP ${response.status} ${text || ''}`.trim();
        console.log('[syncService] createMouvement local API failed:', localApiError);
      } else {
        localApiOk = true;
        console.log('[syncService] createMouvement local API OK');
      }
    } catch (error) {
      localApiError = error instanceof Error ? error.message : String(error);
      console.log('[syncService] createMouvement local API offline/error:', localApiError);
    }
  }

  try {
    const { error } = await supabase.from('mouvements').insert([data]);
    if (error) {
      supabaseError = error.message;
      console.log('[syncService] createMouvement Supabase error:', supabaseError);
    } else {
      supabaseOk = true;
      console.log('[syncService] createMouvement Supabase OK');
    }
  } catch (error) {
    supabaseError = error instanceof Error ? error.message : String(error);
    console.log('[syncService] createMouvement Supabase exception:', supabaseError);
  }

  return { ok: supabaseOk, supabaseOk, localApiOk, supabaseError, localApiError };
}

/**
 * Récupère les mouvements non synchronisés de l'API locale puis les pousse vers Supabase.
 * Ne jette jamais d'exception (retourne un objet de résultat).
 */
export async function syncFromAPI() {
  const supabase = getSupabase();
  if (!(await canCallLocalApi('syncFromAPI'))) {
    return { ok: true, synced: 0, skipped: true, reason: 'DOUBLE_BACKEND_OFF_OR_API_URL_MISSING' };
  }

  try {
    const { response, json, text } = await safeFetchJson(
      `${API_URL.replace(/\/+$/, '')}/mouvements?synced=false`,
      { method: 'GET' }
    );
    if (!response.ok) {
      const msg = `HTTP ${response.status} ${text || ''}`.trim();
      console.log('[syncService] syncFromAPI: local API GET failed:', msg);
      return { ok: false, synced: 0, error: msg };
    }

    const rows = Array.isArray(json) ? json : [];
    if (rows.length === 0) {
      console.log('[syncService] syncFromAPI: nothing to sync');
      return { ok: true, synced: 0 };
    }

    const { error } = await supabase.from('mouvements').upsert(rows, { onConflict: 'id' });
    if (error) {
      console.log('[syncService] syncFromAPI: Supabase upsert failed:', error.message);
      return { ok: false, synced: 0, error: error.message };
    }

    console.log(`[syncService] syncFromAPI: ${rows.length} rows synced to Supabase`);
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
  const supabase = getSupabase();
  try {
    const { data, error } = await supabase.from('stocks').select('*');
    if (error) {
      console.log('[syncService] getStocks Supabase error:', error.message);
      return { ok: false, data: [], error: error.message };
    }
    console.log(`[syncService] getStocks OK (${Array.isArray(data) ? data.length : 0} rows)`);
    return { ok: true, data: data || [] };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log('[syncService] getStocks exception:', msg);
    return { ok: false, data: [], error: msg };
  }
}

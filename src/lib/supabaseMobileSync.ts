/**
 * Synchronisation inventaire + Régie via Supabase (push / pull).
 */
import type { PostgrestError } from '@supabase/supabase-js';
import { getDB } from '../db/coreDb';
import { getSupabase, isSupabaseConfigured } from './supabase';
import { applyInventorySnapshotRows } from './inventoryApiSync';
import {
  reconcileRegieFromSnapshot,
  loadRegiePushPayload,
  markRegieSynced,
  regiePayloadIsEmpty,
  uploadPendingRegiePhotos,
  downloadMissingRegiePhotos,
  clearRegieDeletionsAfterPush,
  type RegieSnapshotSlice,
  REGIE_TABLES,
} from './regieInventorySync';

const MSG_SUPABASE_MANQUE =
  'Supabase n’est pas configuré. Renseignez l’URL du projet et la clé anon (Paramètres → Projet Supabase sur cet appareil), ' +
  'ou définissez EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY au build (EAS).';

type UpsertTable =
  | 'categories'
  | 'localisations'
  | 'materiels'
  | 'consommables'
  | 'prets'
  | 'pret_materiels'
  | (typeof REGIE_TABLES)[number];

const REGIE_PUSH_ORDER: (typeof REGIE_TABLES)[number][] = [
  'conduites',
  'mises_techniques',
  'tops',
  'etapes',
  'positions',
  'position_photos',
];

const REGIE_DELETE_ORDER: (typeof REGIE_TABLES)[number][] = [
  'position_photos',
  'positions',
  'etapes',
  'tops',
  'conduites',
  'mises_techniques',
];

function formatSyncError(e: unknown): string {
  const raw =
    e instanceof Error
      ? e.message
      : e && typeof e === 'object' && 'message' in e
        ? String((e as { message: unknown }).message)
        : String(e);
  if (/network request failed/i.test(raw)) {
    return (
      `${raw}\n\n` +
      'Causes fréquentes :\n' +
      '• Projet Supabase non configuré sur l’appareil ou variables EAS absentes.\n' +
      '• Téléphone hors ligne, Wi‑Fi invité qui bloque les API, VPN ou DNS privé (ex. « DNS privé » Android) qui bloque supabase.co.\n' +
      '• Projet Supabase en pause (gratuit) : réactiver sur supabase.com.\n' +
      '• URL incorrecte (faute de frappe, espaces).'
    );
  }
  return raw;
}

function materielRowForRemote(m: Record<string, unknown>) {
  return {
    ...m,
    photo_local: null,
    notice_pdf_local: null,
    notice_photo_local: null,
    synced: true,
  };
}

function consoRowForRemote(c: Record<string, unknown>) {
  return { ...c, photo_local: null, synced: true };
}

function extractMissingColumnName(raw: string): string | null {
  const m =
    /column\s+"?([a-zA-Z0-9_]+)"?\s+(?:of relation|does not exist)/i.exec(raw) ??
    /Could not find the '([a-zA-Z0-9_]+)' column/i.exec(raw);
  return m?.[1] ?? null;
}

function removeColumnFromRows<T extends Record<string, unknown>>(rows: T[], col: string): T[] {
  return rows.map(row => {
    const next = { ...row };
    delete next[col];
    return next;
  });
}

async function safeUpsert(
  table: UpsertTable,
  rows: Record<string, unknown>[]
): Promise<{ error: PostgrestError | null; removedColumns: string[] }> {
  if (rows.length === 0) return { error: null, removedColumns: [] };
  let current = rows;
  const removedColumns: string[] = [];
  const sb = getSupabase();
  for (let i = 0; i < 8; i += 1) {
    const { error } = await sb.from(table).upsert(current);
    if (!error) return { error: null, removedColumns };
    const missing = extractMissingColumnName(error.message);
    if (!missing) return { error, removedColumns };
    removedColumns.push(missing);
    current = removeColumnFromRows(current, missing);
  }
  return {
    error: { message: 'Trop de colonnes incompatibles détectées côté Supabase.' } as PostgrestError,
    removedColumns,
  };
}

function uniqueCatLocIds(rows: { categorie_id?: string | null; localisation_id?: string | null }[]): {
  cat: string[];
  loc: string[];
} {
  const cat = new Set<string>();
  const loc = new Set<string>();
  for (const r of rows) {
    if (r.categorie_id) cat.add(String(r.categorie_id));
    if (r.localisation_id) loc.add(String(r.localisation_id));
  }
  return { cat: [...cat], loc: [...loc] };
}

async function upsertRowsOrFail(
  table: UpsertTable,
  rows: Record<string, unknown>[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error, removedColumns } = await safeUpsert(table, rows);
  if (!error) return { ok: true };
  if (removedColumns.length) {
    console.log(`[supabase] ${table} colonnes ignorées:`, removedColumns.join(', '));
  }
  return { ok: false, error: `Supabase ${table}: ${error.message}` };
}

async function applyRegieDeletions(
  deletions: { table: string; id: string }[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sb = getSupabase();
  const byTable = new Map<string, string[]>();
  for (const d of deletions) {
    const t = String(d.table);
    const id = String(d.id);
    if (!id) continue;
    const list = byTable.get(t) ?? [];
    list.push(id);
    byTable.set(t, list);
  }
  for (const table of REGIE_DELETE_ORDER) {
    const ids = byTable.get(table);
    if (!ids?.length) continue;
    const { error } = await sb.from(table).delete().in('id', ids);
    if (error) return { ok: false, error: `Supabase suppression ${table}: ${error.message}` };
  }
  return { ok: true };
}

async function fetchAllRows(table: string): Promise<Record<string, unknown>[]> {
  const sb = getSupabase();
  const { data, error } = await sb.from(table).select('*');
  if (error) {
    if (/does not exist/i.test(error.message)) {
      throw new Error(
        `Table Supabase « ${table} » absente. Exportez et exécutez le schéma SQL (Paramètres → Projet Supabase).`
      );
    }
    throw error;
  }
  return (data ?? []) as Record<string, unknown>[];
}

export async function syncToSupabase(): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: MSG_SUPABASE_MANQUE };
  }
  try {
    const database = await getDB();
    const materielsToSync = await database.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM materiels WHERE synced = 0'
    );
    const consoToSync = await database.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM consommables WHERE synced = 0'
    );
    const pretsToSync = await database.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM prets WHERE synced = 0'
    );
    const regiePayload = await loadRegiePushPayload(database, 'unsynced');

    if (
      materielsToSync.length === 0 &&
      consoToSync.length === 0 &&
      pretsToSync.length === 0 &&
      regiePayloadIsEmpty(regiePayload)
    ) {
      return { ok: true };
    }

    const { cat: catIds, loc: locIds } = uniqueCatLocIds([...materielsToSync, ...consoToSync]);

    if (catIds.length > 0) {
      const ph = catIds.map(() => '?').join(',');
      const rows = await database.getAllAsync<Record<string, unknown>>(
        `SELECT * FROM categories WHERE id IN (${ph})`,
        catIds
      );
      const r = await upsertRowsOrFail('categories', rows);
      if (!r.ok) return r;
    }

    if (locIds.length > 0) {
      const ph = locIds.map(() => '?').join(',');
      const rows = await database.getAllAsync<Record<string, unknown>>(
        `SELECT * FROM localisations WHERE id IN (${ph})`,
        locIds
      );
      const r = await upsertRowsOrFail('localisations', rows);
      if (!r.ok) return r;
    }

    if (materielsToSync.length > 0) {
      const r = await upsertRowsOrFail(
        'materiels',
        materielsToSync.map(m => materielRowForRemote(m))
      );
      if (!r.ok) return r;
    }

    if (consoToSync.length > 0) {
      const r = await upsertRowsOrFail(
        'consommables',
        consoToSync.map(c => consoRowForRemote(c))
      );
      if (!r.ok) return r;
    }

    if (pretsToSync.length > 0) {
      const r = await upsertRowsOrFail(
        'prets',
        pretsToSync.map(p => ({ ...p, synced: true }))
      );
      if (!r.ok) return r;

      const pretIds = pretsToSync.map(p => String(p.id));
      const ph = pretIds.map(() => '?').join(',');
      const pretMateriels = await database.getAllAsync<Record<string, unknown>>(
        `SELECT * FROM pret_materiels WHERE pret_id IN (${ph})`,
        pretIds
      );
      if (pretMateriels.length > 0) {
        const pm = await upsertRowsOrFail('pret_materiels', pretMateriels);
        if (!pm.ok) return pm;
      }
    }

    if (regiePayload.regie_deletions.length > 0) {
      const del = await applyRegieDeletions(regiePayload.regie_deletions);
      if (!del.ok) return del;
    }

    for (const table of REGIE_PUSH_ORDER) {
      const rows = regiePayload[table];
      if (!rows.length) continue;
      const r = await upsertRowsOrFail(table, rows);
      if (!r.ok) return r;
    }

    await database.execAsync('BEGIN IMMEDIATE;');
    try {
      const markSynced = async (table: string, ids: string[]) => {
        if (ids.length === 0) return;
        const ph = ids.map(() => '?').join(',');
        await database.runAsync(`UPDATE ${table} SET synced = 1 WHERE id IN (${ph})`, ids);
      };
      await markSynced(
        'materiels',
        materielsToSync.map(m => String(m.id))
      );
      await markSynced(
        'consommables',
        consoToSync.map(c => String(c.id))
      );
      await markSynced(
        'prets',
        pretsToSync.map(p => String(p.id))
      );
      await markRegieSynced(database, 'unsynced');
      await clearRegieDeletionsAfterPush();
      await database.execAsync('COMMIT;');
    } catch (e) {
      try {
        await database.execAsync('ROLLBACK;');
      } catch {
        /* ignore */
      }
      return {
        ok: false,
        error:
          e instanceof Error
            ? e.message
            : 'Erreur locale après envoi Supabase : marquage synced.',
      };
    }

    try {
      await uploadPendingRegiePhotos(database, null);
    } catch {
      /* best effort */
    }

    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: formatSyncError(e) };
  }
}

export async function syncFromSupabase(): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: MSG_SUPABASE_MANQUE };
  }
  try {
    const database = await getDB();
    const [
      categories,
      localisations,
      materiels,
      consommables,
      prets,
      pret_materiels,
      conduites,
      tops,
      mises_techniques,
      etapes,
      positions,
      position_photos,
    ] = await Promise.all([
      fetchAllRows('categories'),
      fetchAllRows('localisations'),
      fetchAllRows('materiels'),
      fetchAllRows('consommables'),
      fetchAllRows('prets'),
      fetchAllRows('pret_materiels'),
      fetchAllRows('conduites'),
      fetchAllRows('tops'),
      fetchAllRows('mises_techniques'),
      fetchAllRows('etapes'),
      fetchAllRows('positions'),
      fetchAllRows('position_photos'),
    ]);

    const snap = {
      categories,
      localisations,
      materiels,
      consommables,
      prets,
      pret_materiels,
      conduites,
      tops,
      mises_techniques,
      etapes,
      positions,
      position_photos,
    };

    await database.execAsync('BEGIN IMMEDIATE;');
    try {
      await applyInventorySnapshotRows(database, snap);
      await reconcileRegieFromSnapshot(database, snap as RegieSnapshotSlice);
      await database.execAsync('COMMIT;');
    } catch (e) {
      try {
        await database.execAsync('ROLLBACK;');
      } catch {
        /* ignore */
      }
      throw e;
    }

    try {
      await downloadMissingRegiePhotos(database, null);
    } catch {
      /* best effort */
    }

    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: formatSyncError(e) };
  }
}

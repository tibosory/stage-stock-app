/**
 * Synchronisation inventaire + Régie via Supabase (push / pull).
 */
import type { PostgrestError } from '@supabase/supabase-js';
import { getDB } from '../db/coreDb';
import { loadPendingInventoryDeletions, clearPendingInventoryDeletions } from '../db/regieDeletionSyncDb';
import { getSupabase, isSupabaseConfigured } from './supabase';
import { applyInventorySnapshotRows } from './inventoryApiSync';
import { reconcileInventoryFromSnapshot, type InventoryReconcileDb } from './inventorySnapshotReconcile';
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
import {
  uploadPendingConsommablePhotos,
  downloadMissingConsommablePhotos,
} from './consommablePhotoSync';
import {
  uploadPendingMaterielMedia,
  downloadMissingMaterielMedia,
} from './materielPhotoSync';
import { invalidateInventorySnapshotCache } from '../db/materialRepository';

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

function isSchemaCacheError(message: string): boolean {
  return /schema cache/i.test(message) || /Could not find the table/i.test(message);
}

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
  if (isSchemaCacheError(raw)) {
    return (
      `${raw}\n\n` +
      'Le serveur Supabase met parfois quelques secondes à reconnaître les tables après une mise à jour. ' +
      'Fermez l’app complètement, attendez 1 minute, puis réessayez Envoyer ↑ dans Connexion. ' +
      'Vérifiez aussi que l’URL du projet correspond bien à celui configuré par l’administrateur.'
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

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function safeUpsert(
  table: UpsertTable,
  rows: Record<string, unknown>[]
): Promise<{ error: PostgrestError | null; removedColumns: string[] }> {
  if (rows.length === 0) return { error: null, removedColumns: [] };
  let current = rows;
  const removedColumns: string[] = [];
  const sb = getSupabase();
  for (let schemaAttempt = 0; schemaAttempt < 4; schemaAttempt += 1) {
    for (let i = 0; i < 8; i += 1) {
      const { error } = await sb.from(table).upsert(current);
      if (!error) return { error: null, removedColumns };
      if (isSchemaCacheError(error.message) && schemaAttempt < 3) {
        await sleep(1200 * (schemaAttempt + 1));
        break;
      }
      const missing = extractMissingColumnName(error.message);
      if (!missing) return { error, removedColumns };
      removedColumns.push(missing);
      current = removeColumnFromRows(current, missing);
    }
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
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const { error } = await sb.from(table).delete().in('id', ids);
      if (!error) break;
      if (isSchemaCacheError(error.message) && attempt < 3) {
        await sleep(1200 * (attempt + 1));
        continue;
      }
      return { ok: false, error: `Supabase suppression ${table}: ${error.message}` };
    }
  }
  return { ok: true };
}

async function applyInventoryDeletions(
  deletions: { table: string; id: string }[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sb = getSupabase();
  const materielIds: string[] = [];
  const consoIds: string[] = [];
  for (const d of deletions) {
    const id = String(d.id).trim();
    if (!id) continue;
    if (d.table === 'materiels') materielIds.push(id);
    else if (d.table === 'consommables') consoIds.push(id);
  }
  if (materielIds.length > 0) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const { error: pmErr } = await sb.from('pret_materiels').delete().in('materiel_id', materielIds);
      if (pmErr && !isSchemaCacheError(pmErr.message)) {
        return { ok: false, error: `Supabase suppression pret_materiels: ${pmErr.message}` };
      }
      const { error } = await sb.from('materiels').delete().in('id', materielIds);
      if (!error) break;
      if (isSchemaCacheError(error.message) && attempt < 3) {
        await sleep(1200 * (attempt + 1));
        continue;
      }
      return { ok: false, error: `Supabase suppression materiels: ${error.message}` };
    }
  }
  if (consoIds.length > 0) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const { error } = await sb.from('consommables').delete().in('id', consoIds);
      if (!error) break;
      if (isSchemaCacheError(error.message) && attempt < 3) {
        await sleep(1200 * (attempt + 1));
        continue;
      }
      return { ok: false, error: `Supabase suppression consommables: ${error.message}` };
    }
  }
  return { ok: true };
}

async function fetchAllRows(table: string): Promise<Record<string, unknown>[]> {
  const sb = getSupabase();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { data, error } = await sb.from(table).select('*');
    if (!error) return (data ?? []) as Record<string, unknown>[];
    if (isSchemaCacheError(error.message) && attempt < 3) {
      await sleep(1200 * (attempt + 1));
      continue;
    }
    if (/does not exist/i.test(error.message)) {
      throw new Error(
        `Table Supabase « ${table} » absente. Exportez et exécutez le schéma SQL (Paramètres → Projet Supabase).`
      );
    }
    throw error;
  }
  throw new Error(`Table Supabase « ${table} » : cache schéma API — réessayez dans une minute.`);
}

export type SupabaseSyncPushResult = {
  ok: boolean;
  error?: string;
  /** Envoi incrémental sans rien à pousser alors que l’inventaire local n’est pas vide. */
  nothingPushed?: boolean;
  localInventory?: { materiels: number; consommables: number };
  pushed?: { materiels: number; consommables: number; prets: number };
};

async function countLocalInventory(database: Awaited<ReturnType<typeof getDB>>): Promise<{
  materiels: number;
  consommables: number;
}> {
  const [m, c] = await Promise.all([
    database.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM materiels'),
    database.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM consommables'),
  ]);
  return { materiels: Number(m?.n ?? 0), consommables: Number(c?.n ?? 0) };
}

/** Envoie tout l’inventaire local vers Supabase (pas seulement `synced = 0`). */
export async function pushFullInventoryToSupabase(): Promise<SupabaseSyncPushResult> {
  return syncToSupabase({ mode: 'full' });
}

export async function syncToSupabase(
  options?: { mode?: 'incremental' | 'full' }
): Promise<SupabaseSyncPushResult> {
  const mode = options?.mode ?? 'incremental';
  if (!isSupabaseConfigured()) {
    return { ok: false, error: MSG_SUPABASE_MANQUE };
  }
  try {
    const database = await getDB();
    const materielSql =
      mode === 'full' ? 'SELECT * FROM materiels' : 'SELECT * FROM materiels WHERE synced = 0';
    const consoSql =
      mode === 'full' ? 'SELECT * FROM consommables' : 'SELECT * FROM consommables WHERE synced = 0';
    const pretSql = mode === 'full' ? 'SELECT * FROM prets' : 'SELECT * FROM prets WHERE synced = 0';
    const materielsToSync = await database.getAllAsync<Record<string, unknown>>(materielSql);
    const consoToSync = await database.getAllAsync<Record<string, unknown>>(consoSql);
    const pretsToSync = await database.getAllAsync<Record<string, unknown>>(pretSql);
    const regiePayload = await loadRegiePushPayload(database, mode === 'full' ? 'full' : 'unsynced');
    const inventoryDeletions = await loadPendingInventoryDeletions();

    if (
      mode === 'incremental' &&
      materielsToSync.length === 0 &&
      consoToSync.length === 0 &&
      pretsToSync.length === 0 &&
      inventoryDeletions.length === 0 &&
      regiePayloadIsEmpty(regiePayload)
    ) {
      const localInventory = await countLocalInventory(database);
      if (localInventory.materiels > 0 || localInventory.consommables > 0) {
        return { ok: true, nothingPushed: true, localInventory };
      }
      return { ok: true };
    }

    if (mode === 'full') {
      const total =
        materielsToSync.length +
        consoToSync.length +
        pretsToSync.length +
        inventoryDeletions.length;
      const regieRows =
        regiePayload.conduites.length +
        regiePayload.tops.length +
        regiePayload.mises_techniques.length +
        regiePayload.etapes.length +
        regiePayload.positions.length +
        regiePayload.position_photos.length;
      if (total === 0 && regieRows === 0 && regiePayload.regie_deletions.length === 0) {
        return { ok: true };
      }
    }

    if (inventoryDeletions.length > 0) {
      const invDel = await applyInventoryDeletions(inventoryDeletions);
      if (!invDel.ok) return invDel;
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
      try {
        await uploadPendingMaterielMedia(database);
      } catch {
        /* best effort */
      }
      const materielsFresh = await database.getAllAsync<Record<string, unknown>>(materielSql);
      const r = await upsertRowsOrFail(
        'materiels',
        materielsFresh.map(m => materielRowForRemote(m))
      );
      if (!r.ok) return r;
    }

    if (consoToSync.length > 0) {
      try {
        await uploadPendingConsommablePhotos(database);
      } catch {
        /* best effort */
      }
      const consoFresh = await database.getAllAsync<Record<string, unknown>>(consoSql);
      const r = await upsertRowsOrFail(
        'consommables',
        consoFresh.map(c => consoRowForRemote(c))
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
      if (mode === 'full') {
        await database.execAsync('UPDATE materiels SET synced = 1');
        await database.execAsync('UPDATE consommables SET synced = 1');
        await database.execAsync('UPDATE prets SET synced = 1');
        await markRegieSynced(database, 'full');
      } else {
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
      }
      await clearPendingInventoryDeletions();
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
    try {
      await uploadPendingMaterielMedia(database);
      await uploadPendingConsommablePhotos(database);
    } catch {
      /* best effort */
    }

    return {
      ok: true,
      pushed: {
        materiels: materielsToSync.length,
        consommables: consoToSync.length,
        prets: pretsToSync.length,
      },
    };
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
      await reconcileInventoryFromSnapshot(database as InventoryReconcileDb, snap);
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
    try {
      await downloadMissingMaterielMedia(database, null);
    } catch {
      /* best effort */
    }
    try {
      await downloadMissingConsommablePhotos(database, null);
    } catch {
      /* best effort */
    }

    invalidateInventorySnapshotCache();
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: formatSyncError(e) };
  }
}

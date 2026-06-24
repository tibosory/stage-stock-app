/**
 * Sync inventaire — module Régie (conduites, tops, mises techniques, étapes, positions, photos).
 * Branché sur GET /api/sync/snapshot et POST /api/sync/bulk via inventoryApiSync.ts.
 */
import type * as SQLite from 'expo-sqlite';
import { filterSnapshotRowsByUnsyncedIds } from './inventorySnapshotMerge';
import { loadPendingRegieDeletions, clearPendingRegieDeletions } from '../db/regieDeletionSyncDb';
import { removePositionPhotoLocal } from './miseTechniquePhotoStorage';
import { downloadRegiePositionPhoto, uploadRegiePositionPhoto } from './regiePhotoUpload';
import type { InventorySyncEndpoint } from './inventoryApiSync';

type SqliteDb = SQLite.SQLiteDatabase;

export const REGIE_TABLES = [
  'conduites',
  'tops',
  'mises_techniques',
  'etapes',
  'positions',
  'position_photos',
] as const;

export type RegieTable = (typeof REGIE_TABLES)[number];

export type RegieSnapshotSlice = {
  conduites?: Record<string, unknown>[];
  tops?: Record<string, unknown>[];
  mises_techniques?: Record<string, unknown>[];
  etapes?: Record<string, unknown>[];
  positions?: Record<string, unknown>[];
  position_photos?: Record<string, unknown>[];
};

const SQLITE_BIND_CHUNK_BUDGET = 900;

function sqlVal(v: unknown): string | number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string' || typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  return String(v);
}

function num01(v: unknown): number {
  if (v === true || v === 1) return 1;
  if (v === false || v === 0) return 0;
  if (typeof v === 'string' && (v === '1' || v.toLowerCase() === 'true')) return 1;
  return 0;
}

async function loadUnsyncedIds(database: SqliteDb, table: RegieTable): Promise<Set<string>> {
  const rows = await database.getAllAsync<{ id: string }>(`SELECT id FROM ${table} WHERE synced = 0`);
  return new Set(rows.map(r => String(r.id)));
}

async function upsertChunk(
  database: SqliteDb,
  sqlPrefix: string,
  tupleSql: string,
  colsPerRow: number,
  rows: (string | number | null)[][]
): Promise<void> {
  if (rows.length === 0) return;
  const chunk = Math.max(1, Math.floor(SQLITE_BIND_CHUNK_BUDGET / colsPerRow));
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    const tuples = slice.map(() => tupleSql).join(', ');
    await database.runAsync(sqlPrefix + tuples, slice.flat());
  }
}

/** Applique les lignes Régie d’un snapshot serveur (respecte les lignes locales `synced = 0`). */
export async function applyRegieSnapshotRows(database: SqliteDb, snap: RegieSnapshotSlice): Promise<void> {
  const unsyncedConduites = await loadUnsyncedIds(database, 'conduites');
  const unsyncedTops = await loadUnsyncedIds(database, 'tops');
  const unsyncedMises = await loadUnsyncedIds(database, 'mises_techniques');
  const unsyncedEtapes = await loadUnsyncedIds(database, 'etapes');
  const unsyncedPositions = await loadUnsyncedIds(database, 'positions');
  const unsyncedPhotos = await loadUnsyncedIds(database, 'position_photos');

  const conduites = filterSnapshotRowsByUnsyncedIds(
    (snap.conduites ?? []).filter((c): c is Record<string, unknown> => Boolean(c?.id)),
    unsyncedConduites
  );
  await upsertChunk(
    database,
    `INSERT OR REPLACE INTO conduites (
      id, nom_spectacle, tour_id, titre, departement, notes, created_at, updated_at, synced
    ) VALUES `,
    '(?,?,?,?,?,?,?,?,1)',
    9,
    conduites.map(c => [
      String(c.id),
      sqlVal(c.nom_spectacle ?? ''),
      c.tour_id != null ? String(c.tour_id) : null,
      sqlVal(c.titre ?? ''),
      sqlVal(c.departement ?? 'generale'),
      sqlVal(c.notes ?? null),
      sqlVal(c.created_at ?? null),
      sqlVal(c.updated_at ?? null),
    ])
  );

  const tops = filterSnapshotRowsByUnsyncedIds(
    (snap.tops ?? []).filter((t): t is Record<string, unknown> => Boolean(t?.id && t?.conduite_id)),
    unsyncedTops
  );
  await upsertChunk(
    database,
    `INSERT OR REPLACE INTO tops (
      id, conduite_id, numero, minutage, minutage_secondes, departement, description, detail,
      localisation, action, repere, effectue, created_at, updated_at, synced
    ) VALUES `,
    '(?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)',
    15,
    tops.map(t => [
      String(t.id),
      String(t.conduite_id),
      t.numero != null ? Number(t.numero) : 0,
      sqlVal(t.minutage ?? null),
      t.minutage_secondes != null ? Number(t.minutage_secondes) : null,
      sqlVal(t.departement ?? 'autre'),
      sqlVal(t.description ?? ''),
      sqlVal(t.detail ?? null),
      sqlVal(t.localisation ?? null),
      sqlVal(t.action ?? null),
      sqlVal(t.repere ?? null),
      num01(t.effectue),
      sqlVal(t.created_at ?? null),
      sqlVal(t.updated_at ?? null),
    ])
  );

  const mises = filterSnapshotRowsByUnsyncedIds(
    (snap.mises_techniques ?? []).filter((m): m is Record<string, unknown> => Boolean(m?.id)),
    unsyncedMises
  );
  await upsertChunk(
    database,
    `INSERT OR REPLACE INTO mises_techniques (
      id, nom_spectacle, tour_id, titre, notes, created_at, updated_at, synced
    ) VALUES `,
    '(?,?,?,?,?,?,?,1)',
    8,
    mises.map(m => [
      String(m.id),
      sqlVal(m.nom_spectacle ?? ''),
      m.tour_id != null ? String(m.tour_id) : null,
      sqlVal(m.titre ?? ''),
      sqlVal(m.notes ?? null),
      sqlVal(m.created_at ?? null),
      sqlVal(m.updated_at ?? null),
    ])
  );

  const etapes = filterSnapshotRowsByUnsyncedIds(
    (snap.etapes ?? []).filter((e): e is Record<string, unknown> => Boolean(e?.id && e?.mise_technique_id)),
    unsyncedEtapes
  );
  await upsertChunk(
    database,
    `INSERT OR REPLACE INTO etapes (
      id, mise_technique_id, ordre, nom, description, created_at, updated_at, synced
    ) VALUES `,
    '(?,?,?,?,?,?,?,1)',
    8,
    etapes.map(e => [
      String(e.id),
      String(e.mise_technique_id),
      e.ordre != null ? Number(e.ordre) : 0,
      sqlVal(e.nom ?? ''),
      sqlVal(e.description ?? null),
      sqlVal(e.created_at ?? null),
      sqlVal(e.updated_at ?? null),
    ])
  );

  const positions = filterSnapshotRowsByUnsyncedIds(
    (snap.positions ?? []).filter((p): p is Record<string, unknown> => Boolean(p?.id && p?.etape_id)),
    unsyncedPositions
  );
  await upsertChunk(
    database,
    `INSERT OR REPLACE INTO positions (
      id, etape_id, materiel_id, nom_objet, description_emplacement, zone, notes, ordre, created_at, updated_at, synced
    ) VALUES `,
    '(?,?,?,?,?,?,?,?,?,?,1)',
    11,
    positions.map(p => [
      String(p.id),
      String(p.etape_id),
      p.materiel_id != null ? String(p.materiel_id) : null,
      sqlVal(p.nom_objet ?? ''),
      sqlVal(p.description_emplacement ?? ''),
      sqlVal(p.zone ?? 'non_definie'),
      sqlVal(p.notes ?? null),
      p.ordre != null ? Number(p.ordre) : 0,
      sqlVal(p.created_at ?? null),
      sqlVal(p.updated_at ?? null),
    ])
  );

  const photos = filterSnapshotRowsByUnsyncedIds(
    (snap.position_photos ?? []).filter((p): p is Record<string, unknown> => Boolean(p?.id && p?.position_id)),
    unsyncedPhotos
  );
  for (const ph of photos) {
    const id = String(ph.id);
    const existing = await database.getFirstAsync<{ local_uri: string | null; photo_url: string | null }>(
      'SELECT local_uri, photo_url FROM position_photos WHERE id = ?',
      [id]
    );
    const serverPhotoUrl = ph.photo_url != null ? String(ph.photo_url) : null;
    const serverUri = ph.local_uri != null ? String(ph.local_uri) : '';
    const localUri =
      existing?.local_uri && String(existing.local_uri).startsWith('file://')
        ? String(existing.local_uri)
        : serverUri;
    await database.runAsync(
      `INSERT OR REPLACE INTO position_photos (id, position_id, local_uri, photo_url, ordre, created_at, updated_at, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        id,
        String(ph.position_id),
        localUri,
        serverPhotoUrl ?? existing?.photo_url ?? null,
        ph.ordre != null ? Number(ph.ordre) : 0,
        sqlVal(ph.created_at ?? null),
        sqlVal(ph.updated_at ?? ph.created_at ?? null),
      ]
    );
  }
}

const RECONCILE_ORDER: { key: keyof RegieSnapshotSlice; table: RegieTable }[] = [
  { key: 'position_photos', table: 'position_photos' },
  { key: 'positions', table: 'positions' },
  { key: 'etapes', table: 'etapes' },
  { key: 'tops', table: 'tops' },
  { key: 'conduites', table: 'conduites' },
  { key: 'mises_techniques', table: 'mises_techniques' },
];

/** Supprime localement les lignes Régie absentes du snapshot serveur (`synced = 1` uniquement). */
export async function reconcileRegieFromSnapshot(database: SqliteDb, snap: RegieSnapshotSlice): Promise<void> {
  for (const { key, table } of RECONCILE_ORDER) {
    const remoteIds = new Set(
      (snap[key] ?? [])
        .filter((r): r is Record<string, unknown> => Boolean(r?.id))
        .map(r => String(r.id))
    );
    const unsynced = await loadUnsyncedIds(database, table);
    const localRows = await database.getAllAsync<{ id: string; synced: number }>(
      `SELECT id, synced FROM ${table}`
    );
    for (const row of localRows) {
      const id = String(row.id);
      if (unsynced.has(id)) continue;
      if (remoteIds.has(id)) continue;
      if ((row.synced ?? 0) === 0) continue;
      if (table === 'position_photos') {
        const ph = await database.getFirstAsync<{ local_uri: string | null }>(
          'SELECT local_uri FROM position_photos WHERE id = ?',
          [id]
        );
        await removePositionPhotoLocal(ph?.local_uri);
      }
      await database.runAsync(`DELETE FROM ${table} WHERE id = ?`, [id]);
    }
  }
}

export type RegiePushPayload = {
  conduites: Record<string, unknown>[];
  tops: Record<string, unknown>[];
  mises_techniques: Record<string, unknown>[];
  etapes: Record<string, unknown>[];
  positions: Record<string, unknown>[];
  position_photos: Record<string, unknown>[];
  regie_deletions: { table: string; id: string }[];
};

export async function loadRegiePushPayload(
  database: SqliteDb,
  mode: 'unsynced' | 'full'
): Promise<RegiePushPayload> {
  const where = mode === 'unsynced' ? ' WHERE synced = 0' : '';
  const [conduites, tops, mises_techniques, etapes, positions, position_photos] = await Promise.all([
    database.getAllAsync<Record<string, unknown>>(`SELECT * FROM conduites${where}`),
    database.getAllAsync<Record<string, unknown>>(`SELECT * FROM tops${where}`),
    database.getAllAsync<Record<string, unknown>>(`SELECT * FROM mises_techniques${where}`),
    database.getAllAsync<Record<string, unknown>>(`SELECT * FROM etapes${where}`),
    database.getAllAsync<Record<string, unknown>>(`SELECT * FROM positions${where}`),
    database.getAllAsync<Record<string, unknown>>(`SELECT * FROM position_photos${where}`),
  ]);
  const regie_deletions = mode === 'unsynced' ? await loadPendingRegieDeletions() : [];
  return {
    conduites: conduites.map(r => ({ ...r, synced: 1 })),
    tops: tops.map(r => ({ ...r, synced: 1 })),
    mises_techniques: mises_techniques.map(r => ({ ...r, synced: 1 })),
    etapes: etapes.map(r => ({ ...r, synced: 1 })),
    positions: positions.map(r => ({ ...r, synced: 1 })),
    position_photos: position_photos.map(r => ({ ...r, local_uri: null, synced: 1 })),
    regie_deletions,
  };
}

export function regiePayloadIsEmpty(payload: RegiePushPayload): boolean {
  return (
    payload.conduites.length === 0 &&
    payload.tops.length === 0 &&
    payload.mises_techniques.length === 0 &&
    payload.etapes.length === 0 &&
    payload.positions.length === 0 &&
    payload.position_photos.length === 0 &&
    payload.regie_deletions.length === 0
  );
}

/** Téléverse les photos locales non synchronisées vers le serveur. */
export async function uploadPendingRegiePhotos(
  database: SqliteDb,
  endpoint?: InventorySyncEndpoint | null
): Promise<void> {
  const rows = await database.getAllAsync<{
    id: string;
    position_id: string;
    local_uri: string | null;
    photo_url: string | null;
  }>(
    `SELECT id, position_id, local_uri, photo_url FROM position_photos
     WHERE synced = 0 AND local_uri IS NOT NULL AND TRIM(local_uri) LIKE 'file://%'`
  );
  for (const row of rows) {
    const local = row.local_uri?.trim();
    if (!local) continue;
    try {
      const photoUrl = await uploadRegiePositionPhoto({
        photoId: String(row.id),
        localUri: local,
        endpoint,
      });
      await database.runAsync('UPDATE position_photos SET photo_url = ?, synced = 1, updated_at = ? WHERE id = ?', [
        photoUrl,
        new Date().toISOString(),
        String(row.id),
      ]);
    } catch {
      /* garde synced = 0 pour retenter */
    }
  }
}

/** Télécharge les photos distantes manquantes localement. */
export async function downloadMissingRegiePhotos(
  database: SqliteDb,
  endpoint?: InventorySyncEndpoint | null
): Promise<void> {
  const rows = await database.getAllAsync<{
    id: string;
    position_id: string;
    local_uri: string | null;
    photo_url: string | null;
  }>(
    `SELECT id, position_id, local_uri, photo_url FROM position_photos
     WHERE photo_url IS NOT NULL AND TRIM(photo_url) != ''`
  );
  for (const row of rows) {
    const local = row.local_uri?.trim() ?? '';
    if (local.startsWith('file://')) continue;
    const photoUrl = row.photo_url?.trim();
    if (!photoUrl) continue;
    try {
      const dest = await downloadRegiePositionPhoto({
        photoId: String(row.id),
        positionId: String(row.position_id),
        photoUrl,
        endpoint,
      });
      await database.runAsync(
        'UPDATE position_photos SET local_uri = ?, updated_at = ? WHERE id = ?',
        [dest, new Date().toISOString(), String(row.id)]
      );
    } catch {
      /* silencieux — retenter au prochain pull */
    }
  }
}

export async function clearRegieDeletionsAfterPush(): Promise<void> {
  await clearPendingRegieDeletions();
}

export async function markRegieSynced(database: SqliteDb, mode: 'unsynced' | 'full'): Promise<void> {
  if (mode === 'full') {
    for (const table of REGIE_TABLES) {
      await database.execAsync(`UPDATE ${table} SET synced = 1`);
    }
    return;
  }
  await database.execAsync('UPDATE conduites SET synced = 1 WHERE synced = 0');
  await database.execAsync('UPDATE tops SET synced = 1 WHERE synced = 0');
  await database.execAsync('UPDATE mises_techniques SET synced = 1 WHERE synced = 0');
  await database.execAsync('UPDATE etapes SET synced = 1 WHERE synced = 0');
  await database.execAsync('UPDATE positions SET synced = 1 WHERE synced = 0');
  await database.execAsync('UPDATE position_photos SET synced = 1 WHERE synced = 0');
}

import { generateId, getDB } from './database';

export type RegieDeletionTable =
  | 'conduites'
  | 'tops'
  | 'mises_techniques'
  | 'etapes'
  | 'positions'
  | 'position_photos';

/** Enregistre une suppression locale à propager au serveur (avant DELETE SQL). */
export async function logRegieDeletion(table: RegieDeletionTable, entityId: string): Promise<void> {
  const id = entityId.trim();
  if (!id) return;
  const database = await getDB();
  const now = new Date().toISOString();
  await database.runAsync(
    `INSERT OR REPLACE INTO sync_regie_deletions (id, table_name, entity_id, created_at)
     VALUES (?, ?, ?, ?)`,
    [generateId(), table, id, now]
  );
}

export async function loadPendingRegieDeletions(): Promise<{ table: RegieDeletionTable; id: string }[]> {
  const database = await getDB();
  const rows = await database.getAllAsync<{ table_name: string; entity_id: string }>(
    'SELECT table_name, entity_id FROM sync_regie_deletions ORDER BY created_at ASC'
  );
  const allowed = new Set<RegieDeletionTable>([
    'conduites',
    'tops',
    'mises_techniques',
    'etapes',
    'positions',
    'position_photos',
  ]);
  return rows
    .filter(r => allowed.has(r.table_name as RegieDeletionTable))
    .map(r => ({ table: r.table_name as RegieDeletionTable, id: String(r.entity_id) }));
}

export async function clearPendingRegieDeletions(): Promise<void> {
  const database = await getDB();
  await database.runAsync('DELETE FROM sync_regie_deletions');
}

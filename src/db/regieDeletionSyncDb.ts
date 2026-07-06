export type RegieDeletionTable =
  | 'conduites'
  | 'tops'
  | 'mises_techniques'
  | 'etapes'
  | 'positions'
  | 'position_photos';

export type InventoryDeletionTable = 'materiels' | 'consommables';

const REGIE_TABLE_NAMES: RegieDeletionTable[] = [
  'conduites',
  'tops',
  'mises_techniques',
  'etapes',
  'positions',
  'position_photos',
];

const INVENTORY_TABLE_NAMES: InventoryDeletionTable[] = ['materiels', 'consommables'];

export type DeletionSyncDb = {
  runAsync(sql: string, params?: readonly unknown[]): Promise<unknown>;
  getAllAsync<T>(sql: string, params?: readonly unknown[]): Promise<T[]>;
};

function newDeletionRowId(): string {
  return `del_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

async function resolveDeletionDb(database?: DeletionSyncDb): Promise<DeletionSyncDb> {
  if (database) return database;
  const { getDB } = await import('./database');
  return (await getDB()) as DeletionSyncDb;
}

async function logPendingDeletion(
  table: string,
  entityId: string,
  database?: DeletionSyncDb
): Promise<void> {
  const id = entityId.trim();
  if (!id) return;
  const db = await resolveDeletionDb(database);
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT OR REPLACE INTO sync_regie_deletions (id, table_name, entity_id, created_at)
     VALUES (?, ?, ?, ?)`,
    [newDeletionRowId(), table, id, now]
  );
}

/** Enregistre une suppression Régie à propager au serveur (avant DELETE SQL). */
export async function logRegieDeletion(table: RegieDeletionTable, entityId: string): Promise<void> {
  await logPendingDeletion(table, entityId);
}

/** Enregistre une suppression stock/consommable à propager au serveur (avant DELETE SQL). */
export async function logInventoryDeletion(
  table: InventoryDeletionTable,
  entityId: string,
  database?: DeletionSyncDb
): Promise<void> {
  await logPendingDeletion(table, entityId, database);
}

export async function loadPendingRegieDeletions(): Promise<{ table: RegieDeletionTable; id: string }[]> {
  const { getDB } = await import('./database');
  const database = await getDB();
  const rows = await database.getAllAsync<{ table_name: string; entity_id: string }>(
    'SELECT table_name, entity_id FROM sync_regie_deletions ORDER BY created_at ASC'
  );
  const allowed = new Set<string>(REGIE_TABLE_NAMES);
  return rows
    .filter(r => allowed.has(r.table_name))
    .map(r => ({ table: r.table_name as RegieDeletionTable, id: String(r.entity_id) }));
}

export async function loadPendingInventoryDeletions(): Promise<
  { table: InventoryDeletionTable; id: string }[]
> {
  const { getDB } = await import('./database');
  const database = await getDB();
  const rows = await database.getAllAsync<{ table_name: string; entity_id: string }>(
    'SELECT table_name, entity_id FROM sync_regie_deletions ORDER BY created_at ASC'
  );
  const allowed = new Set<string>(INVENTORY_TABLE_NAMES);
  return rows
    .filter(r => allowed.has(r.table_name))
    .map(r => ({ table: r.table_name as InventoryDeletionTable, id: String(r.entity_id) }));
}

export async function clearPendingRegieDeletions(): Promise<void> {
  const { getDB } = await import('./database');
  const database = await getDB();
  const ph = REGIE_TABLE_NAMES.map(() => '?').join(',');
  await database.runAsync(`DELETE FROM sync_regie_deletions WHERE table_name IN (${ph})`, REGIE_TABLE_NAMES);
}

export async function clearPendingInventoryDeletions(): Promise<void> {
  const { getDB } = await import('./database');
  const database = await getDB();
  const ph = INVENTORY_TABLE_NAMES.map(() => '?').join(',');
  await database.runAsync(`DELETE FROM sync_regie_deletions WHERE table_name IN (${ph})`, INVENTORY_TABLE_NAMES);
}

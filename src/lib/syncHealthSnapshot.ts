import type * as SQLite from 'expo-sqlite';
import { getDB } from '../db/database';
import { loadPendingInventoryDeletions } from '../db/regieDeletionSyncDb';

export type SyncHealthSnapshot = {
  unsyncedMateriels: number;
  unsyncedConsommables: number;
  unsyncedPrets: number;
  pendingDeletions: number;
  localMateriels: number;
  localConsommables: number;
  hasPendingWork: boolean;
};

type CountRow = { n: number };

async function count(database: SQLite.SQLiteDatabase, sql: string): Promise<number> {
  const row = await database.getFirstAsync<CountRow>(sql);
  return row?.n ?? 0;
}

export async function loadSyncHealthSnapshot(database?: SQLite.SQLiteDatabase): Promise<SyncHealthSnapshot> {
  const db = database ?? (await getDB());
  const [
    unsyncedMateriels,
    unsyncedConsommables,
    unsyncedPrets,
    localMateriels,
    localConsommables,
    pendingDeletionsRows,
  ] = await Promise.all([
    count(db, 'SELECT COUNT(*) AS n FROM materiels WHERE synced = 0'),
    count(db, 'SELECT COUNT(*) AS n FROM consommables WHERE synced = 0'),
    count(db, 'SELECT COUNT(*) AS n FROM prets WHERE synced = 0'),
    count(db, 'SELECT COUNT(*) AS n FROM materiels'),
    count(db, 'SELECT COUNT(*) AS n FROM consommables'),
    loadPendingInventoryDeletions(),
  ]);

  const pendingDeletions = pendingDeletionsRows.length;
  const hasPendingWork =
    unsyncedMateriels > 0 ||
    unsyncedConsommables > 0 ||
    unsyncedPrets > 0 ||
    pendingDeletions > 0;

  return {
    unsyncedMateriels,
    unsyncedConsommables,
    unsyncedPrets,
    pendingDeletions,
    localMateriels,
    localConsommables,
    hasPendingWork,
  };
}

export function formatSyncHealthPendingDetail(snapshot: SyncHealthSnapshot): string {
  const parts: string[] = [];
  if (snapshot.unsyncedMateriels > 0) parts.push(`${snapshot.unsyncedMateriels} mat.`);
  if (snapshot.unsyncedConsommables > 0) parts.push(`${snapshot.unsyncedConsommables} cons.`);
  if (snapshot.unsyncedPrets > 0) parts.push(`${snapshot.unsyncedPrets} prêts`);
  if (snapshot.pendingDeletions > 0) parts.push(`${snapshot.pendingDeletions} suppr.`);
  return parts.join(', ') || '0';
}

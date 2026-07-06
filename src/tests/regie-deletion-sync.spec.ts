import assert from 'node:assert/strict';
import { logInventoryDeletion, type DeletionSyncDb } from '../db/regieDeletionSyncDb';

class FakeDeletionDb implements DeletionSyncDb {
  runs: { sql: string; params?: readonly unknown[] }[] = [];

  async runAsync(sql: string, params?: readonly unknown[]): Promise<void> {
    this.runs.push({ sql, params });
  }

  async getAllAsync<T>(): Promise<T[]> {
    return [];
  }
}

async function run() {
  const db = new FakeDeletionDb();
  await logInventoryDeletion('consommables', 'c-42', db);
  await logInventoryDeletion('materiels', 'm-7', db);

  const inserts = db.runs.filter(r => r.sql.includes('INSERT OR REPLACE INTO sync_regie_deletions'));
  assert.equal(inserts.length, 2);
  assert.equal(inserts[0]?.params?.[1], 'consommables');
  assert.equal(inserts[0]?.params?.[2], 'c-42');
  assert.equal(inserts[1]?.params?.[1], 'materiels');
  assert.equal(inserts[1]?.params?.[2], 'm-7');

  await logInventoryDeletion('consommables', '   ', db);
  assert.equal(db.runs.length, 2, 'empty entity id should be ignored');
}

void run()
  .then(() => console.log('regie-deletion-sync.spec: OK'))
  .catch(e => {
    console.error(e);
    process.exit(1);
  });

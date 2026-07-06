import assert from 'node:assert/strict';
import { reconcileInventoryFromSnapshot } from '../lib/inventorySnapshotReconcile';

type Call = { sql: string; params: unknown[] | undefined };

class FakeDb {
  calls: Call[] = [];
  private unsyncedMats = new Set<string>();
  private unsyncedConsos = new Set<string>();
  private localMats: { id: string; synced: number }[] = [];
  private localConsos: { id: string; synced: number }[] = [];

  setUnsyncedMats(ids: string[]) {
    this.unsyncedMats = new Set(ids);
  }

  setUnsyncedConsos(ids: string[]) {
    this.unsyncedConsos = new Set(ids);
  }

  setLocalMats(rows: { id: string; synced: number }[]) {
    this.localMats = rows;
  }

  setLocalConsos(rows: { id: string; synced: number }[]) {
    this.localConsos = rows;
  }

  async runAsync(sql: string, params?: unknown[]): Promise<void> {
    this.calls.push({ sql, params });
  }

  async getAllAsync<T>(sql: string, params?: unknown[]): Promise<T[]> {
    this.calls.push({ sql, params });
    if (sql.includes('FROM materiels WHERE synced = 0')) {
      return [...this.unsyncedMats].map(id => ({ id })) as T[];
    }
    if (sql.includes('FROM consommables WHERE synced = 0')) {
      return [...this.unsyncedConsos].map(id => ({ id })) as T[];
    }
    if (sql.includes('SELECT id, synced FROM materiels')) {
      return this.localMats as T[];
    }
    if (sql.includes('SELECT id, synced FROM consommables')) {
      return this.localConsos as T[];
    }
    return [];
  }
}

async function testReconcileRemovesSyncedRowsMissingFromRemote() {
  const db = new FakeDb();
  db.setLocalMats([
    { id: 'keep', synced: 1 },
    { id: 'gone', synced: 1 },
    { id: 'local-only', synced: 0 },
  ]);
  db.setLocalConsos([{ id: 'c-gone', synced: 1 }]);
  db.setUnsyncedMats(['local-only']);
  db.setUnsyncedConsos([]);

  await reconcileInventoryFromSnapshot(db as never, {
    materiels: [{ id: 'keep', nom: 'A' }],
    consommables: [],
  });

  assert.ok(
    db.calls.some(c => c.sql.includes('DELETE FROM materiels WHERE id = ?') && c.params?.[0] === 'gone'),
    'synced materiel absent from cloud should be deleted locally'
  );
  assert.ok(
    !db.calls.some(c => c.sql.includes('DELETE FROM materiels WHERE id = ?') && c.params?.[0] === 'keep'),
    'materiel still on cloud should remain'
  );
  assert.ok(
    !db.calls.some(c => c.sql.includes('DELETE FROM materiels WHERE id = ?') && c.params?.[0] === 'local-only'),
    'unsynced local materiel should be kept'
  );
  assert.ok(
    db.calls.some(c => c.sql.includes('DELETE FROM consommables WHERE id = ?') && c.params?.[0] === 'c-gone'),
    'synced consommable absent from cloud should be deleted'
  );
}

void testReconcileRemovesSyncedRowsMissingFromRemote()
  .then(() => {
    console.log('inventory-reconcile.spec: OK');
  })
  .catch(e => {
    console.error(e);
    process.exit(1);
  });

import assert from 'node:assert/strict';
import {
  ajusterStock,
  deleteConsommable,
  getMouvementsStockHistorique,
  setNfcTagMateriel,
} from '../db/inventoryOpsDb';

type Call = { sql: string; params: any[] | undefined };

class FakeInventoryDb {
  calls: Call[] = [];
  private allHandlers: Array<(sql: string, params: any[] | undefined) => any[]> = [];

  enqueueAll(handler: (sql: string, params: any[] | undefined) => any[]) {
    this.allHandlers.push(handler);
  }

  async runAsync(sql: string, params?: any[]): Promise<void> {
    this.calls.push({ sql, params });
  }

  async getFirstAsync<T>(): Promise<T | null> {
    return null;
  }

  async getAllAsync<T>(sql: string, params?: any[]): Promise<T[]> {
    this.calls.push({ sql, params });
    const h = this.allHandlers.shift();
    return h ? (h(sql, params) as T[]) : [];
  }

  async withTransactionAsync(fn: () => Promise<void>): Promise<void> {
    await fn();
  }
}

async function testAjusterStockWritesUpdateAndMouvement() {
  const db = new FakeInventoryDb();
  await ajusterStock('c-1', -3, 'scan sortie', db as any);
  assert.ok(
    db.calls.some(c => c.sql.includes('UPDATE consommables SET stock_actuel = MAX(0, stock_actuel + ?)')),
    'should update consumable stock'
  );
  assert.ok(
    db.calls.some(c => c.sql.includes('INSERT INTO mouvements_stock')),
    'should insert movement history row'
  );
}

async function testSetNfcTagMaterielClearsThenSets() {
  const db = new FakeInventoryDb();
  await setNfcTagMateriel('m-1', 'nfc-123', db as any);
  assert.equal(
    db.calls.filter(c => c.sql.includes('UPDATE materiels SET nfc_tag_id = NULL')).length,
    1,
    'should clear existing tag assignment first'
  );
  assert.equal(
    db.calls.filter(c => c.sql.includes('UPDATE materiels SET nfc_tag_id = ?, updated_at = ?, synced = 0 WHERE id = ?')).length,
    1,
    'should assign new tag to target material'
  );
}

async function testDeleteConsommableDeletesRow() {
  const db = new FakeInventoryDb();
  await deleteConsommable('c-9', db as any);
  assert.ok(
    db.calls.some(c => c.sql.includes('DELETE FROM consommables WHERE id = ?')),
    'should delete consumable by id'
  );
}

async function testGetMouvementsStockHistoriqueUsesBuiltQuery() {
  const db = new FakeInventoryDb();
  db.enqueueAll(() => []);
  await getMouvementsStockHistorique({ type: 'sortie', limit: 10, search: 'gel' }, db as any);
  const selectCall = db.calls.find(c => c.sql.includes('FROM mouvements_stock m'));
  assert.ok(selectCall, 'should run mouvements_stock select query');
  assert.equal(selectCall?.params?.[selectCall.params.length - 1], 10, 'should pass computed limit param');
}

async function run() {
  await testAjusterStockWritesUpdateAndMouvement();
  await testSetNfcTagMaterielClearsThenSets();
  await testDeleteConsommableDeletesRow();
  await testGetMouvementsStockHistoriqueUsesBuiltQuery();
  console.log('inventory-ops.integration.spec: OK');
}

void run();

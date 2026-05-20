import assert from 'node:assert/strict';
import { deletePret, insertPret, updatePret } from '../db/loanDb';
import type { Pret, PretMateriel } from '../types';

/**
 * Integration-style loanDb tests with injected fake DB.
 * Note: in plain Node environments, React Native module resolution can interfere
 * with deep imports from runtime DB modules. Keep this suite outside `test:core`.
 */
type Call = { sql: string; params: any[] | undefined };

class FakeLoanDb {
  calls: Call[] = [];
  private firstHandlers: Array<(sql: string, params: any[] | undefined) => any> = [];
  private allHandlers: Array<(sql: string, params: any[] | undefined) => any[]> = [];

  enqueueFirst(handler: (sql: string, params: any[] | undefined) => any) {
    this.firstHandlers.push(handler);
  }

  enqueueAll(handler: (sql: string, params: any[] | undefined) => any[]) {
    this.allHandlers.push(handler);
  }

  async runAsync(sql: string, params?: any[]): Promise<void> {
    this.calls.push({ sql, params });
  }

  async getFirstAsync<T>(sql: string, params?: any[]): Promise<T | null> {
    this.calls.push({ sql, params });
    const h = this.firstHandlers.shift();
    return h ? (h(sql, params) as T) : null;
  }

  async getAllAsync<T>(sql: string, params?: any[]): Promise<T[]> {
    this.calls.push({ sql, params });
    const h = this.allHandlers.shift();
    return h ? (h(sql, params) as T[]) : [];
  }

  async execAsync(sql: string): Promise<void> {
    this.calls.push({ sql, params: undefined });
  }
}

function samplePret(statut: Pret['statut'] = 'en cours'): Omit<Pret, 'id' | 'created_at' | 'updated_at' | 'synced'> {
  return {
    numero_feuille: 'F-123',
    statut,
    emprunteur: 'Alice',
    organisation: 'ENSATT',
    telephone: undefined,
    email: undefined,
    date_depart: '2026-04-20',
    retour_prevu: '2026-04-22',
    retour_reel: undefined,
    valeur_estimee: undefined,
    commentaire: undefined,
    signature_emprunteur_data: undefined,
    signed_at: undefined,
    emprunteur_user_id: undefined,
    rappel_jours_avant: 2,
  };
}

async function testInsertPretWritesExpectedSql() {
  const db = new FakeLoanDb();
  /** insertPret vérifie chaque matériel (en stock, pas en tournée) avant insertion. */
  db.enqueueFirst(() => ({ statut: 'en stock', nom: 'Projecteur 1', tracking_state: null, current_tour_id: null }));
  db.enqueueFirst(() => ({ statut: 'en stock', nom: 'Projecteur 2', tracking_state: null, current_tour_id: null }));
  const id = await insertPret(samplePret('en cours'), ['m-1', 'm-2'], db as any);
  assert.ok(id, 'insertPret should return generated id');
  assert.ok(db.calls.some(c => c.sql.includes('INSERT INTO prets')), 'should insert pret row');
  assert.equal(
    db.calls.filter(c => c.sql.includes('INSERT INTO pret_materiels')).length,
    2,
    'should insert one pret_materiels line per material'
  );
  assert.equal(
    db.calls.filter(c => c.sql.includes("UPDATE materiels SET statut = 'en prêt'")).length,
    2,
    'should mark each material as borrowed'
  );
  assert.ok(db.calls.some(c => c.sql.includes('BEGIN IMMEDIATE')), 'should run inside a transaction');
  assert.ok(db.calls.some(c => c.sql.includes('COMMIT')), 'should commit transaction on success');
}

async function testUpdatePretPromotesDemandeToEnCours() {
  const db = new FakeLoanDb();
  db.enqueueFirst(() => ({ statut: 'en demande' }));
  db.enqueueFirst(() => samplePret('en cours'));
  db.enqueueAll(() => [
    { materiel_id: 'm-1' } as PretMateriel,
    { materiel_id: 'm-2' } as PretMateriel,
  ]);
  db.enqueueFirst(() => ({ statut: 'en stock', nom: 'Projecteur 1' }));
  db.enqueueFirst(() => ({ statut: 'en stock', nom: 'Projecteur 2' }));

  await updatePret('pret-1', { statut: 'en cours' }, undefined, db as any);

  assert.ok(
    db.calls.some(c => c.sql.startsWith('UPDATE prets SET statut = ?')),
    'should update pret status first'
  );
  assert.equal(
    db.calls.filter(c => c.sql.includes("UPDATE materiels SET statut = 'en prêt'")).length,
    2,
    'should promote all requested materials to borrowed status'
  );
}

async function testDeletePretRestoresMaterials() {
  const db = new FakeLoanDb();
  db.enqueueAll(() => [
    { materiel_id: 'm-1' } as PretMateriel,
    { materiel_id: 'm-2' } as PretMateriel,
  ]);

  await deletePret('pret-2', db as any);

  assert.ok(
    db.calls.some(c => c.sql.includes('DELETE FROM materiel_emprunt_historique')),
    'should delete historical links first'
  );
  assert.equal(
    db.calls.filter(c => c.sql.includes("UPDATE materiels SET statut = 'en stock'")).length,
    2,
    'should restore each linked material to stock'
  );
  assert.ok(db.calls.some(c => c.sql.includes('DELETE FROM prets WHERE id = ?')), 'should delete pret row');
}

async function run() {
  await testInsertPretWritesExpectedSql();
  await testUpdatePretPromotesDemandeToEnCours();
  await testDeletePretRestoresMaterials();
  console.log('loan-db.integration.spec: OK');
}

void run();

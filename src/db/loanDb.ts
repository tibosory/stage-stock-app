import type { Pret, PretMateriel } from '../types';
import {
  clampRappelJoursAvant,
  resolveEtatRetour,
  resolveRetourReelDate,
  shouldCleanupDemandeOnCancel,
  shouldPromoteDemandeToEnCours,
} from './loanDbQuery';

type LoanDbExecutor = {
  runAsync: (sql: string, params?: any[]) => Promise<any>;
  getFirstAsync: <T>(sql: string, params?: any[]) => Promise<T | null>;
  getAllAsync: <T>(sql: string, params?: any[]) => Promise<T[]>;
  execAsync?: (sql: string) => Promise<void>;
};

async function withLoanTransaction<T>(db: LoanDbExecutor, fn: () => Promise<T>): Promise<T> {
  if (!db.execAsync) {
    return fn();
  }
  await db.execAsync('BEGIN IMMEDIATE;');
  try {
    const result = await fn();
    await db.execAsync('COMMIT;');
    return result;
  } catch (e) {
    try {
      await db.execAsync('ROLLBACK;');
    } catch {
      /* ignore */
    }
    throw e;
  }
}

function generateLoanId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function resolveLoanDb(database?: LoanDbExecutor): Promise<LoanDbExecutor> {
  if (database) return database;
  const { getDB } = await import('./coreDb');
  return (await getDB()) as unknown as LoanDbExecutor;
}

export async function getPrets(database?: LoanDbExecutor): Promise<Pret[]> {
  const db = await resolveLoanDb(database);
  const today = new Date().toISOString().split('T')[0];
  await db.runAsync(
    `UPDATE prets SET statut = 'en retard', updated_at = ?, synced = 0
     WHERE statut = 'en cours' AND retour_prevu IS NOT NULL AND retour_prevu < ?`,
    [new Date().toISOString(), today]
  );
  const rows = await db.getAllAsync<any>('SELECT * FROM prets ORDER BY created_at DESC');
  return rows.map(r => ({
    ...r,
    synced: !!r.synced,
    rappel_jours_avant: (() => {
      if (r.rappel_jours_avant == null || r.rappel_jours_avant === '') return null;
      const n = Math.floor(Number(r.rappel_jours_avant));
      return Number.isFinite(n) ? n : null;
    })(),
  }));
}

export async function getPretMateriel(pretId: string, database?: LoanDbExecutor): Promise<PretMateriel[]> {
  const db = await resolveLoanDb(database);
  return db.getAllAsync<PretMateriel>(
    `SELECT
      pm.*,
      m.nom AS materiel_nom,
      m.prix_unitaire AS materiel_prix_unitaire,
      m.poids_kg AS materiel_poids_kg
    FROM pret_materiels pm
    JOIN materiels m ON pm.materiel_id = m.id
    WHERE pm.pret_id = ?`,
    [pretId]
  );
}

export type UpdatePretOptions = {
  lignesEtatRetour?: { materiel_id: string; etat_au_retour: string }[];
};

async function promoteDemandeMaterielsToPret(pretId: string, database: LoanDbExecutor): Promise<void> {
  const now = new Date().toISOString();
  const pret = await database.getFirstAsync<any>('SELECT * FROM prets WHERE id = ?', [pretId]);
  if (!pret) throw new Error('Pret introuvable.');
  const items = await getPretMateriel(pretId, database);
  if (items.length === 0) {
    throw new Error('Aucun materiel sur la demande : ajoutez au moins un article avant validation.');
  }
  for (const line of items) {
    const mat = await database.getFirstAsync<{
      statut: string;
      nom: string;
      tracking_state: string | null;
      current_tour_id: string | null;
    }>(
      'SELECT statut, nom, tracking_state, current_tour_id FROM materiels WHERE id = ?',
      [line.materiel_id]
    );
    if (!mat || mat.statut !== 'en stock' || mat.tracking_state === 'in_tour') {
      throw new Error(
        `"${mat?.nom ?? line.materiel_id}" n'est pas disponible au pret (statut : ${mat?.statut ?? 'introuvable'}${mat?.tracking_state === 'in_tour' ? ', en tournee' : ''}).`
      );
    }
  }
  for (const line of items) {
    await database.runAsync(
      "UPDATE materiels SET statut = 'en prêt', updated_at = ?, synced = 0 WHERE id = ?",
      [now, line.materiel_id]
    );
    await database.runAsync(
      `INSERT INTO materiel_emprunt_historique (id, materiel_id, pret_id, emprunteur, organisation, date_depart, retour_prevu, retour_reel, etat_au_retour, statut_pret)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, 'en cours')`,
      [
        generateLoanId(),
        line.materiel_id,
        pretId,
        pret.emprunteur,
        pret.organisation ?? null,
        pret.date_depart,
        pret.retour_prevu ?? null,
      ]
    );
  }
}

/**
 * Bridge temporaire: la logique d'écriture des prêts reste centralisée
 * dans database.ts pendant la migration progressive vers loanDb.
 */
function pretInsertSqlAndParams(
  pret: Omit<Pret, 'id' | 'created_at' | 'updated_at' | 'synced'>,
  id: string,
  now: string
): { sql: string; params: (string | number | null)[] } {
  const rappel = clampRappelJoursAvant(pret.rappel_jours_avant);
  const params: (string | number | null)[] = [
    id,
    pret.numero_feuille ?? null,
    pret.statut,
    pret.emprunteur,
    pret.organisation ?? null,
    pret.telephone ?? null,
    pret.email ?? null,
    pret.date_depart,
    pret.retour_prevu ?? null,
    pret.retour_reel ?? null,
    pret.valeur_estimee ?? null,
    pret.commentaire ?? null,
    pret.signature_emprunteur_data ?? null,
    pret.signed_at ?? null,
    pret.emprunteur_user_id ?? null,
    rappel,
    now,
    now,
  ];
  const placeholders = Array(18).fill('?').join(', ');
  const sql = `
    INSERT INTO prets (id, numero_feuille, statut, emprunteur, organisation, telephone, email,
      date_depart, retour_prevu, retour_reel, valeur_estimee, commentaire,
      signature_emprunteur_data, signed_at, emprunteur_user_id, rappel_jours_avant,
      created_at, updated_at, synced)
    VALUES (${placeholders}, 0)`;
  return { sql, params };
}

export async function insertPret(
  pret: Omit<Pret, 'id' | 'created_at' | 'updated_at' | 'synced'>,
  materielIds: string[],
  database?: LoanDbExecutor
): Promise<string> {
  const db = await resolveLoanDb(database);
  return withLoanTransaction(db, async () => {
    const id = generateLoanId();
    const now = new Date().toISOString();
    for (const mid of materielIds) {
      const mat = await db.getFirstAsync<{
        statut: string;
        nom: string;
        tracking_state: string | null;
        current_tour_id: string | null;
      }>(
        'SELECT statut, nom, tracking_state, current_tour_id FROM materiels WHERE id = ?',
        [mid]
      );
      if (!mat || mat.statut !== 'en stock' || mat.tracking_state === 'in_tour') {
        throw new Error(
          `"${mat?.nom ?? mid}" n'est pas disponible au pret (statut : ${mat?.statut ?? 'introuvable'}${mat?.tracking_state === 'in_tour' ? ', en tournee' : ''}).`
        );
      }
    }
    const { sql: pretSql, params: pretParams } = pretInsertSqlAndParams(pret, id, now);
    await db.runAsync(pretSql, pretParams);

    for (const mid of materielIds) {
      await db.runAsync(
        'INSERT INTO pret_materiels (id, pret_id, materiel_id, quantite, retourne, etat_au_retour) VALUES (?, ?, ?, 1, 0, NULL)',
        [generateLoanId(), id, mid]
      );
      await db.runAsync(
        "UPDATE materiels SET statut = 'en prêt', updated_at = ?, synced = 0 WHERE id = ?",
        [now, mid]
      );
      await db.runAsync(
        `INSERT INTO materiel_emprunt_historique (id, materiel_id, pret_id, emprunteur, organisation, date_depart, retour_prevu, retour_reel, etat_au_retour, statut_pret)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, 'en cours')`,
        [generateLoanId(), mid, id, pret.emprunteur, pret.organisation ?? null, pret.date_depart, pret.retour_prevu ?? null]
      );
    }

    return id;
  });
}

export async function insertPretDemande(
  pret: Omit<Pret, 'id' | 'created_at' | 'updated_at' | 'synced'>,
  materielIds: string[],
  database?: LoanDbExecutor
): Promise<string> {
  if (pret.statut !== 'en demande') {
    throw new Error('Une demande de prêt doit avoir le statut "en demande".');
  }
  const db = await resolveLoanDb(database);
  return withLoanTransaction(db, async () => {
    const id = generateLoanId();
    const now = new Date().toISOString();
    const { sql: pretSql, params: pretParams } = pretInsertSqlAndParams(pret, id, now);
    await db.runAsync(pretSql, pretParams);
    for (const mid of materielIds) {
      await db.runAsync(
        'INSERT INTO pret_materiels (id, pret_id, materiel_id, quantite, retourne, etat_au_retour) VALUES (?, ?, ?, 1, 0, NULL)',
        [generateLoanId(), id, mid]
      );
    }
    return id;
  });
}

export async function replacePretDemandeMateriels(
  pretId: string,
  materielIds: string[],
  database?: LoanDbExecutor
): Promise<void> {
  const db = await resolveLoanDb(database);
  await withLoanTransaction(db, async () => {
    const row = await db.getFirstAsync<{ statut: string }>('SELECT statut FROM prets WHERE id = ?', [pretId]);
    if (row?.statut !== 'en demande') return;
    await db.runAsync('DELETE FROM pret_materiels WHERE pret_id = ?', [pretId]);
    for (const mid of materielIds) {
      await db.runAsync(
        'INSERT INTO pret_materiels (id, pret_id, materiel_id, quantite, retourne, etat_au_retour) VALUES (?, ?, ?, 1, 0, NULL)',
        [generateLoanId(), pretId, mid]
      );
    }
  });
}

export async function updatePret(
  id: string,
  data: Partial<Pret>,
  options?: UpdatePretOptions,
  database?: LoanDbExecutor
): Promise<void> {
  const db = await resolveLoanDb(database);
  await withLoanTransaction(db, async () => {
    const existingRow = await db.getFirstAsync<{ statut: string }>('SELECT statut FROM prets WHERE id = ?', [id]);
    const previousStatut = existingRow?.statut;
    const now = new Date().toISOString();
    const fields = Object.keys(data).filter(k => !['id', 'created_at', 'synced'].includes(k));
    const setClause = [...fields.map(f => `${f} = ?`), 'updated_at = ?', 'synced = 0'].join(', ');
    const values = [...fields.map(f => (data as any)[f]), now, id];
    await db.runAsync(`UPDATE prets SET ${setClause} WHERE id = ?`, values);

    if (shouldPromoteDemandeToEnCours(previousStatut, data.statut)) {
      await promoteDemandeMaterielsToPret(id, db);
    }
    if (shouldCleanupDemandeOnCancel(previousStatut, data.statut)) {
      await db.runAsync('DELETE FROM pret_materiels WHERE pret_id = ?', [id]);
    }

    if (data.statut === 'retourné') {
      const items = await getPretMateriel(id, db);
      const retourReelFinal = resolveRetourReelDate(data.retour_reel, now);
      for (const item of items) {
        const etat = resolveEtatRetour(
          options?.lignesEtatRetour?.find(x => x.materiel_id === item.materiel_id)?.etat_au_retour
        );
        await db.runAsync(
          'UPDATE pret_materiels SET etat_au_retour = ?, retourne = 1 WHERE pret_id = ? AND materiel_id = ?',
          [etat, id, item.materiel_id]
        );
        await db.runAsync(
          `UPDATE materiel_emprunt_historique SET retour_reel = ?, etat_au_retour = ?, statut_pret = 'retourné' WHERE pret_id = ? AND materiel_id = ?`,
          [retourReelFinal, etat, id, item.materiel_id]
        );
        await db.runAsync(
          "UPDATE materiels SET statut = 'en stock', updated_at = ?, synced = 0 WHERE id = ?",
          [now, item.materiel_id]
        );
      }
    }
  });
}

export async function deletePret(id: string, database?: LoanDbExecutor): Promise<void> {
  const db = await resolveLoanDb(database);
  await withLoanTransaction(db, async () => {
    await db.runAsync('DELETE FROM materiel_emprunt_historique WHERE pret_id = ?', [id]);
    const items = await getPretMateriel(id, db);
    const now = new Date().toISOString();
    for (const item of items) {
      await db.runAsync(
        "UPDATE materiels SET statut = 'en stock', updated_at = ?, synced = 0 WHERE id = ?",
        [now, item.materiel_id]
      );
    }
    await db.runAsync('DELETE FROM prets WHERE id = ?', [id]);
  });
}

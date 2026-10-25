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

export type PretMaterielLigneInput = { materielId: string; quantite?: number };

type PretLigneNorm = { materielId: string; quantite: number };

type MaterielLoanRow = {
  statut: string;
  nom: string;
  tracking_state: string | null;
  current_tour_id: string | null;
  gestion_lot: number | boolean | null;
  stock_actuel: number | null;
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

function isLotRow(m: Pick<MaterielLoanRow, 'gestion_lot'>): boolean {
  return m.gestion_lot === 1 || m.gestion_lot === true;
}

function stockOf(m: Pick<MaterielLoanRow, 'stock_actuel'>): number {
  const n = Number(m.stock_actuel ?? 0);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

/** Accepte l’ancien tableau d’IDs (qty 1) ou des lignes { materielId, quantite }. */
export function normalizePretLignes(
  input: string[] | PretMaterielLigneInput[]
): PretLigneNorm[] {
  if (!input.length) return [];
  if (typeof input[0] === 'string') {
    return (input as string[]).map(materielId => ({ materielId, quantite: 1 }));
  }
  return (input as PretMaterielLigneInput[]).map(l => ({
    materielId: l.materielId,
    quantite: Math.max(1, Math.floor(Number(l.quantite) || 1)),
  }));
}

/** Quantités déjà posées sur des demandes (stock pas encore décrémenté). */
export async function getQuantitesReserveesSurDemandes(
  excludePretId?: string | null,
  database?: LoanDbExecutor
): Promise<Record<string, number>> {
  const db = await resolveLoanDb(database);
  const rows = excludePretId
    ? await db.getAllAsync<{ materiel_id: string; q: number | string }>(
        `SELECT pm.materiel_id AS materiel_id, SUM(pm.quantite) AS q
         FROM pret_materiels pm
         JOIN prets p ON p.id = pm.pret_id
         WHERE p.statut = 'en demande' AND p.id != ?
         GROUP BY pm.materiel_id`,
        [excludePretId]
      )
    : await db.getAllAsync<{ materiel_id: string; q: number | string }>(
        `SELECT pm.materiel_id AS materiel_id, SUM(pm.quantite) AS q
         FROM pret_materiels pm
         JOIN prets p ON p.id = pm.pret_id
         WHERE p.statut = 'en demande'
         GROUP BY pm.materiel_id`
      );
  const out: Record<string, number> = {};
  for (const r of rows) {
    const q = Math.floor(Number(r.q) || 0);
    if (q > 0) out[r.materiel_id] = q;
  }
  return out;
}

async function fetchMaterielLoanRow(
  db: LoanDbExecutor,
  materielId: string
): Promise<MaterielLoanRow | null> {
  return db.getFirstAsync<MaterielLoanRow>(
    `SELECT statut, nom, tracking_state, current_tour_id, gestion_lot, stock_actuel
     FROM materiels WHERE id = ?`,
    [materielId]
  );
}

async function assertLigneDisponiblePourPret(
  db: LoanDbExecutor,
  line: PretLigneNorm,
  opts: { mode: 'pret' | 'demande'; excludePretId?: string | null }
): Promise<MaterielLoanRow> {
  const mat = await fetchMaterielLoanRow(db, line.materielId);
  if (!mat) {
    throw new Error(`Matériel introuvable (${line.materielId}).`);
  }
  if (mat.tracking_state === 'in_tour') {
    throw new Error(`"${mat.nom}" n'est pas disponible au pret (en tournee).`);
  }
  if (isLotRow(mat)) {
    const stock = stockOf(mat);
    if (mat.statut !== 'en stock') {
      throw new Error(
        `"${mat.nom}" n'est pas disponible au pret (statut : ${mat.statut}).`
      );
    }
    let reserved = 0;
    if (opts.mode === 'demande') {
      const map = await getQuantitesReserveesSurDemandes(opts.excludePretId, db);
      reserved = map[line.materielId] ?? 0;
    }
    const available = Math.max(0, stock - reserved);
    if (line.quantite > available) {
      throw new Error(
        `"${mat.nom}" : stock insuffisant (demandé ${line.quantite}, disponible ${available}).`
      );
    }
    return mat;
  }
  if (mat.statut !== 'en stock') {
    throw new Error(
      `"${mat.nom}" n'est pas disponible au pret (statut : ${mat.statut ?? 'introuvable'}).`
    );
  }
  if (line.quantite !== 1) {
    throw new Error(`"${mat.nom}" est une pièce unitaire : quantité 1 uniquement.`);
  }
  return mat;
}

/** Décrémente le stock lot / passe la pièce unitaire « en prêt » + historique. */
async function applyLendLine(
  db: LoanDbExecutor,
  line: PretLigneNorm,
  pretMeta: {
    pretId: string;
    emprunteur: string;
    organisation: string | null | undefined;
    date_depart: string;
    retour_prevu: string | null | undefined;
  },
  now: string
): Promise<void> {
  const mat = await assertLigneDisponiblePourPret(db, line, { mode: 'pret' });

  await db.runAsync(
    'INSERT INTO pret_materiels (id, pret_id, materiel_id, quantite, retourne, etat_au_retour) VALUES (?, ?, ?, ?, 0, NULL)',
    [generateLoanId(), pretMeta.pretId, line.materielId, line.quantite]
  );

  if (isLotRow(mat)) {
    const newStock = stockOf(mat) - line.quantite;
    await db.runAsync(
      `UPDATE materiels SET stock_actuel = ?, statut = ?, updated_at = ?, synced = 0 WHERE id = ?`,
      [newStock, newStock <= 0 ? 'en prêt' : 'en stock', now, line.materielId]
    );
  } else {
    await db.runAsync(
      "UPDATE materiels SET statut = 'en prêt', updated_at = ?, synced = 0 WHERE id = ?",
      [now, line.materielId]
    );
  }

  await db.runAsync(
    `INSERT INTO materiel_emprunt_historique (id, materiel_id, pret_id, emprunteur, organisation, date_depart, retour_prevu, retour_reel, etat_au_retour, statut_pret)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, 'en cours')`,
    [
      generateLoanId(),
      line.materielId,
      pretMeta.pretId,
      pretMeta.emprunteur,
      pretMeta.organisation ?? null,
      pretMeta.date_depart,
      pretMeta.retour_prevu ?? null,
    ]
  );
}

async function restoreLendLine(
  db: LoanDbExecutor,
  item: Pick<PretMateriel, 'materiel_id' | 'quantite'>,
  now: string
): Promise<void> {
  const mat = await fetchMaterielLoanRow(db, item.materiel_id);
  if (!mat) return;
  const qty = Math.max(1, Math.floor(Number(item.quantite) || 1));
  if (isLotRow(mat)) {
    const newStock = stockOf(mat) + qty;
    await db.runAsync(
      `UPDATE materiels SET stock_actuel = ?, statut = 'en stock', updated_at = ?, synced = 0 WHERE id = ?`,
      [newStock, now, item.materiel_id]
    );
  } else {
    await db.runAsync(
      "UPDATE materiels SET statut = 'en stock', updated_at = ?, synced = 0 WHERE id = ?",
      [now, item.materiel_id]
    );
  }
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
    const qty = Math.max(1, Math.floor(Number(line.quantite) || 1));
    const mat = await assertLigneDisponiblePourPret(
      database,
      { materielId: line.materiel_id, quantite: qty },
      { mode: 'pret' }
    );
    if (isLotRow(mat)) {
      const newStock = stockOf(mat) - qty;
      await database.runAsync(
        `UPDATE materiels SET stock_actuel = ?, statut = ?, updated_at = ?, synced = 0 WHERE id = ?`,
        [newStock, newStock <= 0 ? 'en prêt' : 'en stock', now, line.materiel_id]
      );
    } else {
      await database.runAsync(
        "UPDATE materiels SET statut = 'en prêt', updated_at = ?, synced = 0 WHERE id = ?",
        [now, line.materiel_id]
      );
    }
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
  materielIdsOrLignes: string[] | PretMaterielLigneInput[],
  database?: LoanDbExecutor
): Promise<string> {
  const lignes = normalizePretLignes(materielIdsOrLignes);
  const db = await resolveLoanDb(database);
  return withLoanTransaction(db, async () => {
    const id = generateLoanId();
    const now = new Date().toISOString();
    const { sql: pretSql, params: pretParams } = pretInsertSqlAndParams(pret, id, now);
    await db.runAsync(pretSql, pretParams);

    for (const line of lignes) {
      await applyLendLine(
        db,
        line,
        {
          pretId: id,
          emprunteur: pret.emprunteur,
          organisation: pret.organisation,
          date_depart: pret.date_depart,
          retour_prevu: pret.retour_prevu,
        },
        now
      );
    }

    return id;
  });
}

export async function insertPretDemande(
  pret: Omit<Pret, 'id' | 'created_at' | 'updated_at' | 'synced'>,
  materielIdsOrLignes: string[] | PretMaterielLigneInput[],
  database?: LoanDbExecutor
): Promise<string> {
  if (pret.statut !== 'en demande') {
    throw new Error('Une demande de prêt doit avoir le statut "en demande".');
  }
  const lignes = normalizePretLignes(materielIdsOrLignes);
  const db = await resolveLoanDb(database);
  return withLoanTransaction(db, async () => {
    const id = generateLoanId();
    const now = new Date().toISOString();
    for (const line of lignes) {
      await assertLigneDisponiblePourPret(db, line, { mode: 'demande' });
    }
    const { sql: pretSql, params: pretParams } = pretInsertSqlAndParams(pret, id, now);
    await db.runAsync(pretSql, pretParams);
    for (const line of lignes) {
      await db.runAsync(
        'INSERT INTO pret_materiels (id, pret_id, materiel_id, quantite, retourne, etat_au_retour) VALUES (?, ?, ?, ?, 0, NULL)',
        [generateLoanId(), id, line.materielId, line.quantite]
      );
    }
    return id;
  });
}

export async function replacePretDemandeMateriels(
  pretId: string,
  materielIdsOrLignes: string[] | PretMaterielLigneInput[],
  database?: LoanDbExecutor
): Promise<void> {
  const lignes = normalizePretLignes(materielIdsOrLignes);
  const db = await resolveLoanDb(database);
  await withLoanTransaction(db, async () => {
    const row = await db.getFirstAsync<{ statut: string }>('SELECT statut FROM prets WHERE id = ?', [pretId]);
    if (row?.statut !== 'en demande') return;
    for (const line of lignes) {
      await assertLigneDisponiblePourPret(db, line, { mode: 'demande', excludePretId: pretId });
    }
    await db.runAsync('DELETE FROM pret_materiels WHERE pret_id = ?', [pretId]);
    for (const line of lignes) {
      await db.runAsync(
        'INSERT INTO pret_materiels (id, pret_id, materiel_id, quantite, retourne, etat_au_retour) VALUES (?, ?, ?, ?, 0, NULL)',
        [generateLoanId(), pretId, line.materielId, line.quantite]
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
        await restoreLendLine(db, item, now);
      }
    }
  });
}

export async function deletePret(id: string, database?: LoanDbExecutor): Promise<void> {
  const db = await resolveLoanDb(database);
  await withLoanTransaction(db, async () => {
    await db.runAsync('DELETE FROM materiel_emprunt_historique WHERE pret_id = ?', [id]);
    const pret = await db.getFirstAsync<{ statut: string }>('SELECT statut FROM prets WHERE id = ?', [id]);
    const items = await getPretMateriel(id, db);
    const now = new Date().toISOString();
    const active = pret?.statut === 'en cours' || pret?.statut === 'en retard';
    if (active) {
      for (const item of items) {
        await restoreLendLine(db, item, now);
      }
    } else {
      // Demandes / retournés / annulés : pas de double restitution de stock lot.
      for (const item of items) {
        const mat = await fetchMaterielLoanRow(db, item.materiel_id);
        if (!mat || isLotRow(mat)) continue;
        if (mat.statut === 'en prêt') {
          await db.runAsync(
            "UPDATE materiels SET statut = 'en stock', updated_at = ?, synced = 0 WHERE id = ?",
            [now, item.materiel_id]
          );
        }
      }
    }
    await db.runAsync('DELETE FROM prets WHERE id = ?', [id]);
  });
}

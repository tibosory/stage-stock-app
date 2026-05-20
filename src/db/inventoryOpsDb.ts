import type {
  Consommable,
  Materiel,
  MaterielEmpruntHistorique,
  MouvementStockDetail,
} from '../types';
import {
  buildMouvementsStockHistoriqueQuery,
  categoryIdsMatchingPathQuery,
  type MouvementsStockHistoriqueOptions,
} from './inventoryOpsQuery';
export type { MouvementsStockHistoriqueOptions } from './inventoryOpsQuery';

type InventoryOpsDbExecutor = {
  runAsync: (sql: string, params?: any[]) => Promise<any>;
  getFirstAsync: <T>(sql: string, params?: any[]) => Promise<T | null>;
  getAllAsync: <T>(sql: string, params?: any[]) => Promise<T[]>;
  withTransactionAsync: (fn: () => Promise<void>) => Promise<void>;
};

function generateInventoryOpsId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function resolveInventoryDb(database?: InventoryOpsDbExecutor): Promise<InventoryOpsDbExecutor> {
  if (database) return database;
  const { getDB } = await import('./coreDb');
  return (await getDB()) as unknown as InventoryOpsDbExecutor;
}

async function resolveCatalogFns() {
  const mod = await import('./catalogDb');
  return {
    getCategories: mod.getCategories,
    categoryPathById: mod.categoryPathById,
  };
}

async function resolveInventoryFns() {
  const mod = await import('./inventoryDb');
  return {
    insertMateriel: mod.insertMateriel,
    insertConsommable: mod.insertConsommable,
  };
}

export async function getMaterielsVgpSuivi(database?: InventoryOpsDbExecutor): Promise<Materiel[]> {
  const db = await resolveInventoryDb(database);
  const { getCategories, categoryPathById } = await resolveCatalogFns();
  const cats = await getCategories();
  const rows = await db.getAllAsync<any>(`
    SELECT m.*, c.nom as categorie_nom, l.nom as localisation_nom
    FROM materiels m
    LEFT JOIN categories c ON m.categorie_id = c.id
    LEFT JOIN localisations l ON m.localisation_id = l.id
    WHERE COALESCE(m.vgp_actif, 0) = 1
    ORDER BY m.nom ASC
  `);
  return rows.map(r => ({
    ...r,
    synced: !!r.synced,
    categorie_nom: r.categorie_id ? categoryPathById(cats, r.categorie_id) : r.categorie_nom,
  }));
}

export async function getMaterielByQr(qr: string): Promise<Materiel | null> {
  const db = await resolveInventoryDb();
  const row = await db.getFirstAsync<any>(
    'SELECT * FROM materiels WHERE qr_code = ? OR numero_serie = ? OR id = ?',
    [qr, qr, qr]
  );
  return row ? { ...row, synced: !!row.synced } : null;
}

export async function getMaterielByNfc(nfcId: string): Promise<Materiel | null> {
  const db = await resolveInventoryDb();
  const row = await db.getFirstAsync<any>(
    'SELECT * FROM materiels WHERE nfc_tag_id = ?',
    [nfcId]
  );
  return row ? { ...row, synced: !!row.synced } : null;
}

/**
 * Résout une fiche matériel pour l’affectation tournée : id, QR, n° de série (égalité stricte),
 * ou NFC / QR avec comparaison insensible à la casse et aux espaces en bord.
 */
export async function findMaterielForTourScan(raw: string): Promise<Materiel | null> {
  const code = raw.trim();
  if (!code) return null;
  const db = await resolveInventoryDb();
  const row = await db.getFirstAsync<any>(
    `SELECT * FROM materiels WHERE
      id = ?
      OR qr_code = ?
      OR (numero_serie IS NOT NULL AND numero_serie = ?)
      OR (nfc_tag_id IS NOT NULL AND lower(trim(nfc_tag_id)) = lower(trim(?)))
      OR (qr_code IS NOT NULL AND lower(trim(qr_code)) = lower(trim(?)))
    LIMIT 1`,
    [code, code, code, code, code]
  );
  return row ? { ...row, synced: !!row.synced } : null;
}

export async function searchMateriels(query: string): Promise<Materiel[]> {
  const db = await resolveInventoryDb();
  const { getCategories, categoryPathById } = await resolveCatalogFns();
  const cats = await getCategories();
  const raw = query.trim();
  if (!raw) {
    const rows = await db.getAllAsync<any>('SELECT * FROM materiels ORDER BY created_at DESC LIMIT 5');
    return rows.map(r => ({
      ...r,
      synced: !!r.synced,
      categorie_nom: r.categorie_id ? categoryPathById(cats, r.categorie_id) : undefined,
    }));
  }
  const q = `%${raw}%`;
  const catIds = categoryIdsMatchingPathQuery(cats, raw);
  let sql = `
    SELECT * FROM materiels
    WHERE nom LIKE ? OR IFNULL(qr_code,'') LIKE ? OR IFNULL(numero_serie,'') LIKE ? OR IFNULL(type,'') LIKE ? OR IFNULL(marque,'') LIKE ?
      OR IFNULL(gel_code,'') LIKE ? OR IFNULL(gel_brand,'') LIKE ?
  `;
  const params: (string | number)[] = [q, q, q, q, q, q, q];
  if (catIds.length) {
    sql += ` OR categorie_id IN (${catIds.map(() => '?').join(',')})`;
    params.push(...catIds);
  }
  sql += ' ORDER BY created_at DESC LIMIT 50';
  const rows = await db.getAllAsync<any>(sql, params);
  return rows.map(r => ({
    ...r,
    synced: !!r.synced,
    categorie_nom: r.categorie_id ? categoryPathById(cats, r.categorie_id) : undefined,
  }));
}

export async function searchConsommables(query: string): Promise<Consommable[]> {
  const db = await resolveInventoryDb();
  const { getCategories, categoryPathById } = await resolveCatalogFns();
  const cats = await getCategories();
  const raw = query.trim();
  if (!raw) {
    const rows = await db.getAllAsync<any>('SELECT * FROM consommables ORDER BY nom ASC LIMIT 8');
    return rows.map(r => ({
      ...r,
      synced: !!r.synced,
      categorie_nom: r.categorie_id ? categoryPathById(cats, r.categorie_id) : undefined,
    }));
  }
  const q = `%${raw}%`;
  const catIds = categoryIdsMatchingPathQuery(cats, raw);
  let sql = `
    SELECT * FROM consommables
    WHERE nom LIKE ? OR IFNULL(reference,'') LIKE ? OR IFNULL(qr_code,'') LIKE ? OR IFNULL(nfc_tag_id,'') LIKE ?
      OR IFNULL(fournisseur,'') LIKE ?
  `;
  const params: (string | number)[] = [q, q, q, q, q];
  if (catIds.length) {
    sql += ` OR categorie_id IN (${catIds.map(() => '?').join(',')})`;
    params.push(...catIds);
  }
  sql += ' ORDER BY nom ASC LIMIT 50';
  const rows = await db.getAllAsync<any>(sql, params);
  return rows.map(r => ({
    ...r,
    synced: !!r.synced,
    categorie_nom: r.categorie_id ? categoryPathById(cats, r.categorie_id) : undefined,
  }));
}

export async function insertMaterielsSerieBatch(
  rows: Array<Omit<Materiel, 'id' | 'created_at' | 'updated_at' | 'synced'>>,
  database?: InventoryOpsDbExecutor
): Promise<number> {
  const db = await resolveInventoryDb(database);
  const { insertMateriel } = await resolveInventoryFns();
  let count = 0;
  await db.withTransactionAsync(async () => {
    for (const data of rows) {
      await insertMateriel(data);
      count++;
    }
  });
  return count;
}

export async function deleteMateriel(id: string, database?: InventoryOpsDbExecutor): Promise<void> {
  const { removeMaterielAttachmentsDir } = await import('../lib/materielAttachments');
  await removeMaterielAttachmentsDir(id);
  const db = await resolveInventoryDb(database);
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM pret_materiels WHERE materiel_id = ?', [id]);
    await db.runAsync('DELETE FROM materiel_emprunt_historique WHERE materiel_id = ?', [id]);
    await db.runAsync('DELETE FROM materiels WHERE id = ?', [id]);
  });
  try {
    const { removeMaterielNoticesFromRemoteStorage } = await import('../lib/supabase');
    await removeMaterielNoticesFromRemoteStorage(id);
  } catch {
    // best effort
  }
}

export async function setNfcTagMateriel(
  materielId: string,
  nfcTagId: string,
  database?: InventoryOpsDbExecutor
): Promise<void> {
  const db = await resolveInventoryDb(database);
  await db.runAsync('UPDATE materiels SET nfc_tag_id = NULL WHERE nfc_tag_id = ?', [nfcTagId]);
  await db.runAsync(
    'UPDATE materiels SET nfc_tag_id = ?, updated_at = ?, synced = 0 WHERE id = ?',
    [nfcTagId, new Date().toISOString(), materielId]
  );
}

export async function getConsommableByQr(qr: string): Promise<Consommable | null> {
  const db = await resolveInventoryDb();
  const row = await db.getFirstAsync<any>(
    'SELECT * FROM consommables WHERE qr_code = ? OR reference = ? OR id = ?',
    [qr, qr, qr]
  );
  return row ? { ...row, synced: !!row.synced } : null;
}

export async function createMaterielStubWithScannedCode(opts: {
  qrCode?: string;
  nfcTagId?: string;
}): Promise<string> {
  const q = opts.qrCode?.trim();
  const n = opts.nfcTagId?.trim();
  if (!q && !n) throw new Error('Code QR ou ID NFC requis');
  const { insertMateriel } = await resolveInventoryFns();
  return insertMateriel({
    nom: 'Nouveau matériel',
    etat: 'bon',
    statut: 'en stock',
    qr_code: q || undefined,
    nfc_tag_id: n || undefined,
  });
}

export async function createConsommableStubWithScannedCode(opts: {
  qrCode?: string;
  nfcTagId?: string;
}): Promise<string> {
  const q = opts.qrCode?.trim();
  const n = opts.nfcTagId?.trim();
  if (!q && !n) throw new Error('Code QR ou ID NFC requis');
  const { insertConsommable } = await resolveInventoryFns();
  return insertConsommable({
    nom: 'Nouveau consommable',
    unite: 'pièce',
    stock_actuel: 0,
    seuil_minimum: 1,
    qr_code: q || undefined,
    nfc_tag_id: n || undefined,
  });
}

export async function deleteConsommable(id: string, database?: InventoryOpsDbExecutor): Promise<void> {
  const db = await resolveInventoryDb(database);
  await db.runAsync('DELETE FROM consommables WHERE id = ?', [id]);
}

export async function ajusterStock(
  consommableId: string,
  delta: number,
  note?: string,
  database?: InventoryOpsDbExecutor
): Promise<void> {
  const db = await resolveInventoryDb(database);
  const mvtId = generateInventoryOpsId();
  const now = new Date().toISOString();
  await db.runAsync(
    'UPDATE consommables SET stock_actuel = MAX(0, stock_actuel + ?), updated_at = ?, synced = 0 WHERE id = ?',
    [delta, now, consommableId]
  );
  await db.runAsync(
    'INSERT INTO mouvements_stock (id, consommable_id, type, quantite, note, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [mvtId, consommableId, delta >= 0 ? 'entrée' : 'sortie', Math.abs(delta), note ?? null, now]
  );
}

export async function getMouvementsStockHistorique(
  options: MouvementsStockHistoriqueOptions | number = {},
  database?: InventoryOpsDbExecutor
): Promise<MouvementStockDetail[]> {
  const db = await resolveInventoryDb(database);
  const { sql, params } = buildMouvementsStockHistoriqueQuery(options);
  return db.getAllAsync<MouvementStockDetail>(sql, params);
}

export async function getHistoriqueEmpruntsMateriel(
  materielId: string,
  database?: InventoryOpsDbExecutor
): Promise<MaterielEmpruntHistorique[]> {
  const db = await resolveInventoryDb(database);
  const rows = await db.getAllAsync<any>(
    `SELECT h.*, p.numero_feuille AS numero_feuille
     FROM materiel_emprunt_historique h
     LEFT JOIN prets p ON p.id = h.pret_id
     WHERE h.materiel_id = ?
     ORDER BY h.date_depart DESC, h.created_at DESC`,
    [materielId]
  );
  return rows.map(r => ({
    id: r.id,
    materiel_id: r.materiel_id,
    pret_id: r.pret_id,
    emprunteur: r.emprunteur,
    organisation: r.organisation ?? undefined,
    date_depart: r.date_depart,
    retour_prevu: r.retour_prevu ?? undefined,
    retour_reel: r.retour_reel ?? undefined,
    etat_au_retour: r.etat_au_retour ?? undefined,
    statut_pret: r.statut_pret,
    created_at: r.created_at,
    numero_feuille: r.numero_feuille ?? undefined,
  }));
}

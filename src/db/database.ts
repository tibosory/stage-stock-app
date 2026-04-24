// src/db/database.ts
import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Materiel, Consommable, Pret, PretMateriel, Categorie, Localisation, AlerteEmail,
  AppUser, AppUserRole, MaterielEmpruntHistorique, Beneficiaire, MouvementStockDetail,
} from '../types';

const APP_SESSION_USER_ID_KEY = 'stagestock_session_user_id';
import { removeMaterielAttachmentsDir } from '../lib/materielAttachments';
import { shouldAlertVgp } from '../lib/vgp';

let db: SQLite.SQLiteDatabase;

export const getDB = async (): Promise<SQLite.SQLiteDatabase> => {
  if (!db) {
    db = await SQLite.openDatabaseAsync('stagestock.db');
  }
  return db;
};

async function runSchemaMigrations(database: SQLite.SQLiteDatabase): Promise<void> {
  const addCol = async (table: string, name: string, defSql: string) => {
    const rows = await database.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
    if (!rows.some(r => r.name === name)) {
      await database.execAsync(`ALTER TABLE ${table} ADD COLUMN ${name} ${defSql}`);
    }
  };
  await addCol('materiels', 'prochain_controle', 'TEXT');
  await addCol('materiels', 'intervalle_controle_jours', 'INTEGER');
  await addCol('prets', 'signature_emprunteur_data', 'TEXT');
  await addCol('prets', 'signed_at', 'TEXT');
  await addCol('prets', 'emprunteur_user_id', 'TEXT');
  await addCol('prets', 'rappel_jours_avant', 'INTEGER');
  await addCol('pret_materiels', 'etat_au_retour', 'TEXT');
  await addCol('materiels', 'notice_pdf_local', 'TEXT');
  await addCol('materiels', 'notice_photo_local', 'TEXT');
  await addCol('materiels', 'notice_pdf_url', 'TEXT');
  await addCol('materiels', 'notice_photo_url', 'TEXT');
  await addCol('materiels', 'vgp_actif', 'INTEGER DEFAULT 0');
  await addCol('materiels', 'vgp_periodicite_jours', 'INTEGER');
  await addCol('materiels', 'vgp_derniere_visite', 'TEXT');
  await addCol('materiels', 'vgp_libelle', 'TEXT');
  await addCol('materiels', 'vgp_epi', 'INTEGER DEFAULT 0');
  /** PDF feuille de prêt, sync API (aligné backend PostgreSQL) */
  await addCol('materiels', 'prix_unitaire', 'REAL');
  await addCol('materiels', 'gel_brand', 'TEXT');
  await addCol('materiels', 'gel_code', 'TEXT');
  await addCol('materiels', 'gel_instead_of_photo', 'INTEGER DEFAULT 0');
  await addCol('categories', 'parent_id', 'TEXT');
  await addCol('consommables', 'photo_local', 'TEXT');
  await addCol('consommables', 'photo_url', 'TEXT');
  await addCol('consommables', 'gel_brand', 'TEXT');
  await addCol('consommables', 'gel_code', 'TEXT');
  await addCol('consommables', 'gel_instead_of_photo', 'INTEGER DEFAULT 0');

  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS app_users (
      id TEXT PRIMARY KEY,
      nom TEXT NOT NULL,
      email TEXT,
      role TEXT NOT NULL DEFAULT 'technicien',
      pin_hash TEXT NOT NULL,
      actif INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS materiel_emprunt_historique (
      id TEXT PRIMARY KEY,
      materiel_id TEXT NOT NULL,
      pret_id TEXT NOT NULL,
      emprunteur TEXT NOT NULL,
      organisation TEXT,
      date_depart TEXT NOT NULL,
      retour_prevu TEXT,
      retour_reel TEXT,
      etat_au_retour TEXT,
      statut_pret TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  await addCol('app_users', 'expo_push_token', 'TEXT');
}

async function seedDefaultAdminIfNeeded(database: SQLite.SQLiteDatabase): Promise<void> {
  const row = await database.getFirstAsync<{ n: number }>('SELECT COUNT(*) as n FROM app_users');
  if ((row?.n ?? 0) > 0) return;
  const { hashPin } = await import('../lib/pinAuth');
  const h = await hashPin('1234');
  const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  await database.runAsync(
    `INSERT INTO app_users (id, nom, email, role, pin_hash, actif) VALUES (?, ?, ?, ?, ?, 1)`,
    [id, 'Administrateur', null, 'admin', h]
  );
}

export const initDB = async (): Promise<void> => {
  const database = await getDB();

  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      nom TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS localisations (
      id TEXT PRIMARY KEY,
      nom TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS alertes_email (
      id TEXT PRIMARY KEY,
      nom TEXT,
      email TEXT NOT NULL UNIQUE,
      role TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS beneficiaires (
      id TEXT PRIMARY KEY,
      nom TEXT NOT NULL,
      organisation TEXT,
      telephone TEXT,
      email TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS materiels (
      id TEXT PRIMARY KEY,
      nom TEXT NOT NULL,
      type TEXT,
      marque TEXT,
      numero_serie TEXT,
      poids_kg REAL,
      categorie_id TEXT REFERENCES categories(id),
      localisation_id TEXT REFERENCES localisations(id),
      etat TEXT DEFAULT 'bon',
      statut TEXT DEFAULT 'en stock',
      date_achat TEXT,
      date_validite TEXT,
      technicien TEXT,
      qr_code TEXT,
      nfc_tag_id TEXT,
      photo_url TEXT,
      photo_local TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      synced INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS consommables (
      id TEXT PRIMARY KEY,
      nom TEXT NOT NULL,
      reference TEXT,
      unite TEXT DEFAULT 'pièce',
      stock_actuel INTEGER DEFAULT 0,
      seuil_minimum INTEGER DEFAULT 5,
      categorie_id TEXT REFERENCES categories(id),
      localisation_id TEXT REFERENCES localisations(id),
      fournisseur TEXT,
      prix_unitaire REAL,
      qr_code TEXT,
      nfc_tag_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      synced INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS prets (
      id TEXT PRIMARY KEY,
      numero_feuille TEXT,
      statut TEXT DEFAULT 'en cours',
      emprunteur TEXT NOT NULL,
      organisation TEXT,
      telephone TEXT,
      email TEXT,
      date_depart TEXT NOT NULL,
      retour_prevu TEXT,
      retour_reel TEXT,
      valeur_estimee REAL,
      commentaire TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      synced INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS pret_materiels (
      id TEXT PRIMARY KEY,
      pret_id TEXT NOT NULL REFERENCES prets(id) ON DELETE CASCADE,
      materiel_id TEXT NOT NULL REFERENCES materiels(id),
      quantite INTEGER DEFAULT 1,
      retourne INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS mouvements_stock (
      id TEXT PRIMARY KEY,
      consommable_id TEXT NOT NULL REFERENCES consommables(id),
      type TEXT NOT NULL,
      quantite INTEGER NOT NULL,
      note TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  await runSchemaMigrations(database);
  await seedDefaultAdminIfNeeded(database);
};

// ── Génération d'ID unique ──────────────────────────────────────────────────
export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
};

/** INSERT matériel : colonnes hors synced — 33 placeholders + synced=0 littéral. */
function materielInsertSqlAndParams(
  data: Omit<Materiel, 'id' | 'created_at' | 'updated_at' | 'synced'>,
  id: string,
  now: string
): { sql: string; params: (string | number | null)[] } {
  const qrCode = data.qr_code?.trim() || id;
  const vgpEpi =
    data.vgp_epi === 1 || data.vgp_epi === true ? 1 : 0;
  const gelInstead =
    data.gel_instead_of_photo === 1 || data.gel_instead_of_photo === true ? 1 : 0;
  const gelBrand =
    data.gel_brand === 'lee' || data.gel_brand === 'rosco' ? data.gel_brand : null;
  const gelCode = gelBrand && data.gel_code?.trim() ? data.gel_code.trim() : null;
  const params: (string | number | null)[] = [
    id,
    data.nom,
    data.type ?? null,
    data.marque ?? null,
    data.numero_serie ?? null,
    data.poids_kg ?? null,
    data.categorie_id ?? null,
    data.localisation_id ?? null,
    data.etat,
    data.statut,
    data.date_achat ?? null,
    data.date_validite ?? null,
    data.prochain_controle ?? null,
    data.intervalle_controle_jours ?? null,
    data.technicien ?? null,
    qrCode,
    data.nfc_tag_id ?? null,
    data.photo_url ?? null,
    data.photo_local ?? null,
    data.notice_pdf_local ?? null,
    data.notice_photo_local ?? null,
    data.notice_pdf_url ?? null,
    data.notice_photo_url ?? null,
    data.vgp_actif != null && data.vgp_actif !== false ? 1 : 0,
    data.vgp_periodicite_jours ?? null,
    data.vgp_derniere_visite ?? null,
    data.vgp_libelle ?? null,
    vgpEpi,
    gelBrand,
    gelCode,
    gelInstead,
    now,
    now,
  ];
  if (params.length !== 33) {
    throw new Error(`insert materiel: 33 paramètres attendus, ${params.length} fournis`);
  }
  const placeholders = Array(33).fill('?').join(', ');
  const sql = `
    INSERT INTO materiels (id, nom, type, marque, numero_serie, poids_kg, categorie_id, localisation_id,
      etat, statut, date_achat, date_validite, prochain_controle, intervalle_controle_jours,
      technicien, qr_code, nfc_tag_id, photo_url, photo_local,
      notice_pdf_local, notice_photo_local, notice_pdf_url, notice_photo_url,
      vgp_actif, vgp_periodicite_jours, vgp_derniere_visite, vgp_libelle, vgp_epi,
      gel_brand, gel_code, gel_instead_of_photo,
      created_at, updated_at, synced)
    VALUES (${placeholders}, 0)`;
  return { sql, params };
}

/** INSERT consommable : synced=0 littéral — 19 placeholders. */
function consommableInsertSqlAndParams(
  data: Omit<Consommable, 'id' | 'created_at' | 'updated_at' | 'synced'>,
  id: string,
  now: string
): { sql: string; params: (string | number | null)[] } {
  const qrCode = data.qr_code?.trim() || id;
  const gelInstead =
    data.gel_instead_of_photo === 1 || data.gel_instead_of_photo === true ? 1 : 0;
  const gelBrand =
    data.gel_brand === 'lee' || data.gel_brand === 'rosco' ? data.gel_brand : null;
  const gelCode = gelBrand && data.gel_code?.trim() ? data.gel_code.trim() : null;
  const params: (string | number | null)[] = [
    id,
    data.nom,
    data.reference ?? null,
    data.unite,
    data.stock_actuel,
    data.seuil_minimum,
    data.categorie_id ?? null,
    data.localisation_id ?? null,
    data.fournisseur ?? null,
    data.prix_unitaire ?? null,
    qrCode,
    data.nfc_tag_id ?? null,
    data.photo_local ?? null,
    data.photo_url ?? null,
    gelBrand,
    gelCode,
    gelInstead,
    now,
    now,
  ];
  if (params.length !== 19) {
    throw new Error(`insert consommable: 19 paramètres attendus, ${params.length} fournis`);
  }
  const placeholders = Array(19).fill('?').join(', ');
  const sql = `
    INSERT INTO consommables (id, nom, reference, unite, stock_actuel, seuil_minimum,
      categorie_id, localisation_id, fournisseur, prix_unitaire, qr_code, nfc_tag_id,
      photo_local, photo_url, gel_brand, gel_code, gel_instead_of_photo,
      created_at, updated_at, synced)
    VALUES (${placeholders}, 0)`;
  return { sql, params };
}

/** INSERT prêt : synced=0 littéral — 18 placeholders. */
function pretInsertSqlAndParams(
  pret: Omit<Pret, 'id' | 'created_at' | 'updated_at' | 'synced'>,
  id: string,
  now: string
): { sql: string; params: (string | number | null)[] } {
  const rappel =
    pret.rappel_jours_avant != null && Number.isFinite(Number(pret.rappel_jours_avant))
      ? Math.min(365, Math.max(1, Math.floor(Number(pret.rappel_jours_avant))))
      : null;
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
  if (params.length !== 18) {
    throw new Error(`insert pret: 18 paramètres attendus, ${params.length} fournis`);
  }
  const placeholders = Array(18).fill('?').join(', ');
  const sql = `
    INSERT INTO prets (id, numero_feuille, statut, emprunteur, organisation, telephone, email,
      date_depart, retour_prevu, retour_reel, valeur_estimee, commentaire,
      signature_emprunteur_data, signed_at, emprunteur_user_id, rappel_jours_avant,
      created_at, updated_at, synced)
    VALUES (${placeholders}, 0)`;
  return { sql, params };
}

// ═══════════════════════════════════════════════════════════════════
// MATÉRIELS
// ═══════════════════════════════════════════════════════════════════

export const getMateriel = async (): Promise<Materiel[]> => {
  const database = await getDB();
  const cats = await getCategories();
  const rows = await database.getAllAsync<any>(`
    SELECT m.*, c.nom as categorie_nom, l.nom as localisation_nom
    FROM materiels m
    LEFT JOIN categories c ON m.categorie_id = c.id
    LEFT JOIN localisations l ON m.localisation_id = l.id
    ORDER BY m.created_at DESC
  `);
  return rows.map(r => ({
    ...r,
    synced: !!r.synced,
    categorie_nom: r.categorie_id ? categoryPathById(cats, r.categorie_id) : r.categorie_nom,
  }));
};

/** Matériels suivis pour les VGP (visites / contrôles périodiques obligatoires). */
export const getMaterielsVgpSuivi = async (): Promise<Materiel[]> => {
  const database = await getDB();
  const cats = await getCategories();
  const rows = await database.getAllAsync<any>(`
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
};

/** Alertes VGP : échéance passée, dans les N prochains jours, ou fiche incomplète. */
export const getMaterielsPourVgpAlertes = async (fenetreJours: number = 30): Promise<Materiel[]> => {
  const mats = await getMateriel();
  return mats.filter(m => shouldAlertVgp(m, fenetreJours));
};

export const getMaterielById = async (id: string): Promise<Materiel | null> => {
  const database = await getDB();
  const row = await database.getFirstAsync<any>(
    'SELECT * FROM materiels WHERE id = ?', [id]
  );
  return row ? { ...row, synced: !!row.synced } : null;
};

export const getMaterielByQr = async (qr: string): Promise<Materiel | null> => {
  const database = await getDB();
  const row = await database.getFirstAsync<any>(
    'SELECT * FROM materiels WHERE qr_code = ? OR numero_serie = ? OR id = ?', [qr, qr, qr]
  );
  return row ? { ...row, synced: !!row.synced } : null;
};

export const getMaterielByNfc = async (nfcId: string): Promise<Materiel | null> => {
  const database = await getDB();
  const row = await database.getFirstAsync<any>(
    'SELECT * FROM materiels WHERE nfc_tag_id = ?', [nfcId]
  );
  return row ? { ...row, synced: !!row.synced } : null;
};

export const searchMateriels = async (query: string): Promise<Materiel[]> => {
  const database = await getDB();
  const cats = await getCategories();
  const raw = query.trim();
  if (!raw) {
    const rows = await database.getAllAsync<any>(
      `SELECT * FROM materiels ORDER BY created_at DESC LIMIT 5`
    );
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
  sql += ` ORDER BY created_at DESC LIMIT 50`;
  const rows = await database.getAllAsync<any>(sql, params);
  return rows.map(r => ({
    ...r,
    synced: !!r.synced,
    categorie_nom: r.categorie_id ? categoryPathById(cats, r.categorie_id) : undefined,
  }));
};

/** Recherche texte sur consommables (nom, ref., QR, fournisseur) et sur le chemin de catégorie. */
export const searchConsommables = async (query: string): Promise<Consommable[]> => {
  const database = await getDB();
  const cats = await getCategories();
  const raw = query.trim();
  if (!raw) {
    const rows = await database.getAllAsync<any>(
      `SELECT * FROM consommables ORDER BY nom ASC LIMIT 8`
    );
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
  sql += ` ORDER BY nom ASC LIMIT 50`;
  const rows = await database.getAllAsync<any>(sql, params);
  return rows.map(r => ({
    ...r,
    synced: !!r.synced,
    categorie_nom: r.categorie_id ? categoryPathById(cats, r.categorie_id) : undefined,
  }));
};

export const insertMateriel = async (data: Omit<Materiel, 'id' | 'created_at' | 'updated_at' | 'synced'>): Promise<string> => {
  const database = await getDB();
  const id = generateId();
  const now = new Date().toISOString();
  const { sql, params } = materielInsertSqlAndParams(data, id, now);
  await database.runAsync(sql, params);
  return id;
};

/** Crée plusieurs matériels en une transaction (série même modèle, n° de série / QR distincts). */
export const insertMaterielsSerieBatch = async (
  rows: Array<Omit<Materiel, 'id' | 'created_at' | 'updated_at' | 'synced'>>
): Promise<number> => {
  const database = await getDB();
  let count = 0;
  await database.withTransactionAsync(async () => {
    for (const data of rows) {
      const id = generateId();
      const now = new Date().toISOString();
      const { sql, params } = materielInsertSqlAndParams(data, id, now);
      await database.runAsync(sql, params);
      count++;
    }
  });
  return count;
};

export const updateMateriel = async (id: string, data: Partial<Materiel>): Promise<void> => {
  const database = await getDB();
  const now = new Date().toISOString();
  const fields = Object.keys(data).filter(k => !['id', 'created_at', 'synced'].includes(k));
  const setClause = [...fields.map(f => `${f} = ?`), 'updated_at = ?', 'synced = 0'].join(', ');
  const values = [...fields.map(f => (data as any)[f]), now, id];
  await database.runAsync(`UPDATE materiels SET ${setClause} WHERE id = ?`, values);
};

export const deleteMateriel = async (id: string): Promise<void> => {
  await removeMaterielAttachmentsDir(id);
  const database = await getDB();
  /** Lier un prêt à un matériel crée une FK sans CASCADE : libérer les lignes avant la fiche. */
  await database.withTransactionAsync(async () => {
    await database.runAsync('DELETE FROM pret_materiels WHERE materiel_id = ?', [id]);
    await database.runAsync('DELETE FROM materiel_emprunt_historique WHERE materiel_id = ?', [id]);
    await database.runAsync('DELETE FROM materiels WHERE id = ?', [id]);
  });
  try {
    const { removeMaterielNoticesFromRemoteStorage } = await import('../lib/supabase');
    await removeMaterielNoticesFromRemoteStorage(id);
  } catch {
    /* pas de réseau / Supabase non configuré */
  }
};

export const setNfcTagMateriel = async (materielId: string, nfcTagId: string): Promise<void> => {
  const database = await getDB();
  // Supprimer l'ancien tag de tout autre matériel
  await database.runAsync('UPDATE materiels SET nfc_tag_id = NULL WHERE nfc_tag_id = ?', [nfcTagId]);
  await database.runAsync('UPDATE materiels SET nfc_tag_id = ?, updated_at = ?, synced = 0 WHERE id = ?',
    [nfcTagId, new Date().toISOString(), materielId]);
};

// ═══════════════════════════════════════════════════════════════════
// CONSOMMABLES
// ═══════════════════════════════════════════════════════════════════

export const getConsommableById = async (id: string): Promise<Consommable | null> => {
  const database = await getDB();
  const row = await database.getFirstAsync<any>('SELECT * FROM consommables WHERE id = ?', [id]);
  return row ? { ...row, synced: !!row.synced } : null;
};

export const getConsommableByQr = async (qr: string): Promise<Consommable | null> => {
  const database = await getDB();
  const row = await database.getFirstAsync<any>(
    'SELECT * FROM consommables WHERE qr_code = ? OR reference = ? OR id = ?',
    [qr, qr, qr]
  );
  return row ? { ...row, synced: !!row.synced } : null;
};

export const getConsommables = async (): Promise<Consommable[]> => {
  const database = await getDB();
  const cats = await getCategories();
  const rows = await database.getAllAsync<any>(`
    SELECT c.*, cat.nom as categorie_nom, l.nom as localisation_nom
    FROM consommables c
    LEFT JOIN categories cat ON c.categorie_id = cat.id
    LEFT JOIN localisations l ON c.localisation_id = l.id
    ORDER BY c.nom ASC
  `);
  return rows.map(r => ({
    ...r,
    synced: !!r.synced,
    categorie_nom: r.categorie_id ? categoryPathById(cats, r.categorie_id) : r.categorie_nom,
  }));
};

export const getConsommablesAlerte = async (): Promise<Consommable[]> => {
  const database = await getDB();
  const rows = await database.getAllAsync<any>(
    'SELECT * FROM consommables WHERE stock_actuel <= seuil_minimum ORDER BY stock_actuel ASC'
  );
  return rows.map(r => ({ ...r, synced: !!r.synced }));
};

export const insertConsommable = async (data: Omit<Consommable, 'id' | 'created_at' | 'updated_at' | 'synced'>): Promise<string> => {
  const database = await getDB();
  const id = generateId();
  const now = new Date().toISOString();
  const { sql, params } = consommableInsertSqlAndParams(data, id, now);
  await database.runAsync(sql, params);
  return id;
};

/** Fiche matériel minimale : le code scanné devient le QR (ou l’ID NFC le `nfc_tag_id`). */
export async function createMaterielStubWithScannedCode(opts: {
  qrCode?: string;
  nfcTagId?: string;
}): Promise<string> {
  const q = opts.qrCode?.trim();
  const n = opts.nfcTagId?.trim();
  if (!q && !n) throw new Error('Code QR ou ID NFC requis');
  return insertMateriel({
    nom: 'Nouveau matériel',
    etat: 'bon',
    statut: 'en stock',
    qr_code: q || undefined,
    nfc_tag_id: n || undefined,
  });
}

/** Fiche consommable minimale : le code scanné est enregistré sur la fiche. */
export async function createConsommableStubWithScannedCode(opts: {
  qrCode?: string;
  nfcTagId?: string;
}): Promise<string> {
  const q = opts.qrCode?.trim();
  const n = opts.nfcTagId?.trim();
  if (!q && !n) throw new Error('Code QR ou ID NFC requis');
  return insertConsommable({
    nom: 'Nouveau consommable',
    unite: 'pièce',
    stock_actuel: 0,
    seuil_minimum: 1,
    qr_code: q || undefined,
    nfc_tag_id: n || undefined,
  });
}

export const updateConsommable = async (id: string, data: Partial<Consommable>): Promise<void> => {
  const database = await getDB();
  const now = new Date().toISOString();
  const fields = Object.keys(data).filter(k => !['id', 'created_at', 'synced'].includes(k));
  const setClause = [...fields.map(f => `${f} = ?`), 'updated_at = ?', 'synced = 0'].join(', ');
  const values = [...fields.map(f => (data as any)[f]), now, id];
  await database.runAsync(`UPDATE consommables SET ${setClause} WHERE id = ?`, values);
};

export const deleteConsommable = async (id: string): Promise<void> => {
  const database = await getDB();
  await database.runAsync('DELETE FROM consommables WHERE id = ?', [id]);
};

export const ajusterStock = async (consommableId: string, delta: number, note?: string): Promise<void> => {
  const database = await getDB();
  const mvtId = generateId();
  const now = new Date().toISOString();
  await database.runAsync(
    'UPDATE consommables SET stock_actuel = MAX(0, stock_actuel + ?), updated_at = ?, synced = 0 WHERE id = ?',
    [delta, now, consommableId]
  );
  await database.runAsync(
    'INSERT INTO mouvements_stock (id, consommable_id, type, quantite, note, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [mvtId, consommableId, delta >= 0 ? 'entrée' : 'sortie', Math.abs(delta), note ?? null, now]
  );
};

export type MouvementsStockHistoriqueOptions = {
  limit?: number;
  type?: 'entrée' | 'sortie' | 'ajustement';
  /** ISO 8601 inclusif (ex. début de journée) */
  dateFrom?: string;
  /** ISO 8601 inclusif (ex. fin de journée) */
  dateTo?: string;
  /** Sous-chaîne sur nom consommable ou note (sans sensibilité à la casse côté app via lower + like) */
  search?: string;
};

/** Historique des mouvements de stock consommables (les plus récents en premier). `limit` seul reste supporté. */
export const getMouvementsStockHistorique = async (
  options: MouvementsStockHistoriqueOptions | number = {}
): Promise<MouvementStockDetail[]> => {
  const database = await getDB();
  let limit = 800;
  let filt: MouvementsStockHistoriqueOptions = {};
  if (typeof options === 'number') {
    limit = options;
  } else {
    filt = options;
    limit = options.limit ?? 800;
  }
  const lim = Math.min(Math.max(1, Math.floor(limit)), 5000);
  const clauses: string[] = [];
  const params: (string | number)[] = [];

  if (filt.type) {
    clauses.push('m.type = ?');
    params.push(filt.type);
  }
  if (filt.dateFrom?.trim()) {
    clauses.push('m.created_at >= ?');
    params.push(filt.dateFrom.trim());
  }
  if (filt.dateTo?.trim()) {
    clauses.push('m.created_at <= ?');
    params.push(filt.dateTo.trim());
  }
  const q = filt.search?.trim().replace(/%/g, '').replace(/'/g, '') ?? '';
  if (q.length > 0) {
    const like = `%${q.toLowerCase()}%`;
    clauses.push("(lower(coalesce(c.nom, '')) LIKE ? OR lower(coalesce(m.note, '')) LIKE ?)");
    params.push(like, like);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const sql = `
    SELECT m.id, m.consommable_id, m.type, m.quantite, m.note, m.created_at,
            coalesce(c.nom, '(consommable supprimé)') AS consommable_nom,
            coalesce(c.unite, 'pièce') AS consommable_unite
     FROM mouvements_stock m
     LEFT JOIN consommables c ON c.id = m.consommable_id
     ${where}
     ORDER BY datetime(m.created_at) DESC
     LIMIT ?`;
  params.push(lim);
  return database.getAllAsync<MouvementStockDetail>(sql, params);
};

// ═══════════════════════════════════════════════════════════════════
// PRÊTS
// ═══════════════════════════════════════════════════════════════════

export const getPrets = async (): Promise<Pret[]> => {
  const database = await getDB();
  const today = new Date().toISOString().split('T')[0];
  await database.runAsync(
    `UPDATE prets SET statut = 'en retard', updated_at = ?, synced = 0
     WHERE statut = 'en cours' AND retour_prevu IS NOT NULL AND retour_prevu < ?`,
    [new Date().toISOString(), today]
  );
  const rows = await database.getAllAsync<any>('SELECT * FROM prets ORDER BY created_at DESC');
  return rows.map(r => ({
    ...r,
    synced: !!r.synced,
    rappel_jours_avant: (() => {
      if (r.rappel_jours_avant == null || r.rappel_jours_avant === '') return null;
      const n = Math.floor(Number(r.rappel_jours_avant));
      return Number.isFinite(n) ? n : null;
    })(),
  }));
};

export const getPretMateriel = async (pretId: string): Promise<PretMateriel[]> => {
  const database = await getDB();
  return database.getAllAsync<PretMateriel>(`
    SELECT
      pm.*,
      m.nom AS materiel_nom,
      m.prix_unitaire AS materiel_prix_unitaire,
      m.poids_kg AS materiel_poids_kg
    FROM pret_materiels pm
    JOIN materiels m ON pm.materiel_id = m.id
    WHERE pm.pret_id = ?
  `, [pretId]);
};

export const insertPret = async (
  pret: Omit<Pret, 'id' | 'created_at' | 'updated_at' | 'synced'>,
  materielIds: string[]
): Promise<string> => {
  const database = await getDB();
  const id = generateId();
  const now = new Date().toISOString();

  const { sql: pretSql, params: pretParams } = pretInsertSqlAndParams(pret, id, now);
  await database.runAsync(pretSql, pretParams);

  for (const mid of materielIds) {
    await database.runAsync(
      'INSERT INTO pret_materiels (id, pret_id, materiel_id, quantite, retourne, etat_au_retour) VALUES (?, ?, ?, 1, 0, NULL)',
      [generateId(), id, mid]
    );
    await database.runAsync(
      "UPDATE materiels SET statut = 'en prêt', updated_at = ?, synced = 0 WHERE id = ?",
      [now, mid]
    );
    await database.runAsync(
      `INSERT INTO materiel_emprunt_historique (id, materiel_id, pret_id, emprunteur, organisation, date_depart, retour_prevu, retour_reel, etat_au_retour, statut_pret)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, 'en cours')`,
      [generateId(), mid, id, pret.emprunteur, pret.organisation ?? null, pret.date_depart, pret.retour_prevu ?? null]
    );
  }

  return id;
};

/** Demande emprunteur : lignes sans sortir le matériel du stock tant que l’admin n’a pas validé. */
export const insertPretDemande = async (
  pret: Omit<Pret, 'id' | 'created_at' | 'updated_at' | 'synced'>,
  materielIds: string[]
): Promise<string> => {
  if (pret.statut !== 'en demande') {
    throw new Error('Une demande de prêt doit avoir le statut « en demande ».');
  }
  const database = await getDB();
  const id = generateId();
  const now = new Date().toISOString();
  const { sql: pretSql, params: pretParams } = pretInsertSqlAndParams(pret, id, now);
  await database.runAsync(pretSql, pretParams);
  for (const mid of materielIds) {
    await database.runAsync(
      'INSERT INTO pret_materiels (id, pret_id, materiel_id, quantite, retourne, etat_au_retour) VALUES (?, ?, ?, 1, 0, NULL)',
      [generateId(), id, mid]
    );
  }
  return id;
};

/** Remplace les lignes matériel d’une demande (statut « en demande » uniquement). */
export const replacePretDemandeMateriels = async (pretId: string, materielIds: string[]): Promise<void> => {
  const database = await getDB();
  const row = await database.getFirstAsync<{ statut: string }>('SELECT statut FROM prets WHERE id = ?', [pretId]);
  if (row?.statut !== 'en demande') return;
  await database.runAsync('DELETE FROM pret_materiels WHERE pret_id = ?', [pretId]);
  for (const mid of materielIds) {
    await database.runAsync(
      'INSERT INTO pret_materiels (id, pret_id, materiel_id, quantite, retourne, etat_au_retour) VALUES (?, ?, ?, 1, 0, NULL)',
      [generateId(), pretId, mid]
    );
  }
};

async function promoteDemandeMaterielsToPret(pretId: string): Promise<void> {
  const database = await getDB();
  const now = new Date().toISOString();
  const pret = await database.getFirstAsync<any>('SELECT * FROM prets WHERE id = ?', [pretId]);
  if (!pret) throw new Error('Prêt introuvable.');
  const items = await getPretMateriel(pretId);
  if (items.length === 0) {
    throw new Error('Aucun matériel sur la demande : ajoutez au moins un article avant validation.');
  }
  for (const line of items) {
    const mat = await database.getFirstAsync<{ statut: string; nom: string }>(
      'SELECT statut, nom FROM materiels WHERE id = ?',
      [line.materiel_id]
    );
    if (!mat || mat.statut !== 'en stock') {
      throw new Error(
        `« ${mat?.nom ?? line.materiel_id} » n’est pas disponible au prêt (statut : ${mat?.statut ?? 'introuvable'}).`
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
        generateId(),
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

export type UpdatePretOptions = {
  lignesEtatRetour?: { materiel_id: string; etat_au_retour: string }[];
};

export const updatePret = async (id: string, data: Partial<Pret>, options?: UpdatePretOptions): Promise<void> => {
  const database = await getDB();
  const existingRow = await database.getFirstAsync<{ statut: string }>('SELECT statut FROM prets WHERE id = ?', [id]);
  const previousStatut = existingRow?.statut;
  const now = new Date().toISOString();
  const fields = Object.keys(data).filter(k => !['id', 'created_at', 'synced'].includes(k));
  const setClause = [...fields.map(f => `${f} = ?`), 'updated_at = ?', 'synced = 0'].join(', ');
  const values = [...fields.map(f => (data as any)[f]), now, id];
  await database.runAsync(`UPDATE prets SET ${setClause} WHERE id = ?`, values);

  if (previousStatut === 'en demande' && data.statut === 'en cours') {
    await promoteDemandeMaterielsToPret(id);
  }
  if (previousStatut === 'en demande' && data.statut === 'annulé') {
    await database.runAsync('DELETE FROM pret_materiels WHERE pret_id = ?', [id]);
  }

  if (data.statut === 'retourné') {
    const items = await getPretMateriel(id);
    const retourReelFinal = data.retour_reel ?? new Date().toISOString().split('T')[0];
    for (const item of items) {
      const etat =
        options?.lignesEtatRetour?.find(x => x.materiel_id === item.materiel_id)?.etat_au_retour ?? 'bon';
      await database.runAsync(
        'UPDATE pret_materiels SET etat_au_retour = ?, retourne = 1 WHERE pret_id = ? AND materiel_id = ?',
        [etat, id, item.materiel_id]
      );
      await database.runAsync(
        `UPDATE materiel_emprunt_historique SET retour_reel = ?, etat_au_retour = ?, statut_pret = 'retourné' WHERE pret_id = ? AND materiel_id = ?`,
        [retourReelFinal, etat, id, item.materiel_id]
      );
      await database.runAsync(
        "UPDATE materiels SET statut = 'en stock', updated_at = ?, synced = 0 WHERE id = ?",
        [now, item.materiel_id]
      );
    }
  }
};

export const deletePret = async (id: string): Promise<void> => {
  const database = await getDB();
  await database.runAsync('DELETE FROM materiel_emprunt_historique WHERE pret_id = ?', [id]);
  const items = await getPretMateriel(id);
  const now = new Date().toISOString();
  for (const item of items) {
    await database.runAsync(
      "UPDATE materiels SET statut = 'en stock', updated_at = ?, synced = 0 WHERE id = ?",
      [now, item.materiel_id]
    );
  }
  await database.runAsync('DELETE FROM prets WHERE id = ?', [id]);
};

// ═══════════════════════════════════════════════════════════════════
// CATÉGORIES & LOCALISATIONS
// ═══════════════════════════════════════════════════════════════════

/** Chaîne « parent › enfant › feuille » pour affichage / listes déroulantes. */
export function categoryPathById(categories: Categorie[], leafId: string | null | undefined): string {
  if (!leafId) return '';
  const byId = new Map(categories.map(c => [c.id, c]));
  const parts: string[] = [];
  let cur: Categorie | undefined = byId.get(leafId);
  let guard = 0;
  while (cur && guard++ < 64) {
    parts.unshift(cur.nom);
    const pid = cur.parent_id;
    cur = pid ? byId.get(pid) : undefined;
  }
  return parts.join(' › ');
}

/**
 * IDs de catégories pertinentes pour une recherche texte : nom de catégorie ou segment du chemin
 * (parent › enfant › feuille), pour filtrer matériels et consommables par catégorie / sous-catégorie.
 */
function categoryIdsMatchingPathQuery(categories: Categorie[], q: string): string[] {
  const qn = q.trim().toLowerCase();
  if (!qn) return [];
  const out = new Set<string>();
  for (const c of categories) {
    if (c.nom && c.nom.toLowerCase().includes(qn)) out.add(c.id);
    const path = categoryPathById(categories, c.id);
    if (path && path.toLowerCase().includes(qn)) out.add(c.id);
  }
  return [...out];
}

export const getCategories = async (): Promise<Categorie[]> => {
  const database = await getDB();
  const rows = await database.getAllAsync<Categorie>('SELECT * FROM categories ORDER BY nom ASC');
  return rows.map(r => ({
    ...r,
    parent_id: r.parent_id ?? null,
  }));
};

/** Nouvelle catégorie ; `parentId` optionnel pour une sous-catégorie. */
export const insertCategorie = async (nom: string, parentId?: string | null): Promise<string> => {
  const database = await getDB();
  const id = generateId();
  const parent = parentId?.trim() || null;
  if (parent) {
    const exists = await database.getFirstAsync<{ id: string }>('SELECT id FROM categories WHERE id = ?', [parent]);
    if (!exists) throw new Error('Catégorie parente introuvable.');
  }
  await database.runAsync(
    'INSERT INTO categories (id, nom, parent_id) VALUES (?, ?, ?)',
    [id, nom.trim(), parent]
  );
  return id;
};

export const deleteCategorie = async (id: string): Promise<void> => {
  const database = await getDB();
  const child = await database.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) as n FROM categories WHERE parent_id = ?',
    [id]
  );
  if ((child?.n ?? 0) > 0) {
    throw new Error('Impossible de supprimer : des sous-catégories existent. Supprimez-les d’abord.');
  }
  const m = await database.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) as n FROM materiels WHERE categorie_id = ?',
    [id]
  );
  if ((m?.n ?? 0) > 0) {
    throw new Error('Impossible de supprimer : des matériels utilisent cette catégorie.');
  }
  const c = await database.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) as n FROM consommables WHERE categorie_id = ?',
    [id]
  );
  if ((c?.n ?? 0) > 0) {
    throw new Error('Impossible de supprimer : des consommables utilisent cette catégorie.');
  }
  await database.runAsync('DELETE FROM categories WHERE id = ?', [id]);
};

export const getLocalisations = async (): Promise<Localisation[]> => {
  const database = await getDB();
  return database.getAllAsync<Localisation>('SELECT * FROM localisations ORDER BY nom ASC');
};

export const insertLocalisation = async (nom: string): Promise<string> => {
  const database = await getDB();
  const id = generateId();
  await database.runAsync(
    'INSERT INTO localisations (id, nom) VALUES (?, ?)', [id, nom]
  );
  return id;
};

export const deleteLocalisation = async (id: string): Promise<void> => {
  const database = await getDB();
  await database.runAsync('DELETE FROM localisations WHERE id = ?', [id]);
};

// ═══════════════════════════════════════════════════════════════════
// BÉNÉFICIAIRES (répertoire emprunteurs pour les prêts)
// ═══════════════════════════════════════════════════════════════════

export const getBeneficiaires = async (): Promise<Beneficiaire[]> => {
  const database = await getDB();
  return database.getAllAsync<Beneficiaire>(
    'SELECT * FROM beneficiaires ORDER BY nom COLLATE NOCASE ASC'
  );
};

export const insertBeneficiaire = async (data: {
  nom: string;
  organisation?: string | null;
  telephone?: string | null;
  email?: string | null;
}): Promise<string> => {
  const database = await getDB();
  const id = generateId();
  const now = new Date().toISOString();
  await database.runAsync(
    `INSERT INTO beneficiaires (id, nom, organisation, telephone, email, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.nom.trim(),
      data.organisation?.trim() || null,
      data.telephone?.trim() || null,
      data.email?.trim() || null,
      now,
      now,
    ]
  );
  return id;
};

export const updateBeneficiaire = async (
  id: string,
  patch: { nom?: string; organisation?: string | null; telephone?: string | null; email?: string | null }
): Promise<void> => {
  const database = await getDB();
  const row = await database.getFirstAsync<Beneficiaire>('SELECT * FROM beneficiaires WHERE id = ?', [id]);
  if (!row) throw new Error('Bénéficiaire introuvable');
  const nom = patch.nom !== undefined ? patch.nom.trim() : row.nom;
  const organisation =
    patch.organisation !== undefined ? (patch.organisation?.trim() || null) : (row.organisation ?? null);
  const telephone =
    patch.telephone !== undefined ? (patch.telephone?.trim() || null) : (row.telephone ?? null);
  const email = patch.email !== undefined ? (patch.email?.trim() || null) : (row.email ?? null);
  const now = new Date().toISOString();
  await database.runAsync(
    `UPDATE beneficiaires SET nom = ?, organisation = ?, telephone = ?, email = ?, updated_at = ? WHERE id = ?`,
    [nom, organisation, telephone, email, now, id]
  );
};

export const deleteBeneficiaire = async (id: string): Promise<void> => {
  const database = await getDB();
  await database.runAsync('DELETE FROM beneficiaires WHERE id = ?', [id]);
};

// ═══════════════════════════════════════════════════════════════════
// ALERTES EMAIL
// ═══════════════════════════════════════════════════════════════════

export const getAlertesEmail = async (): Promise<AlerteEmail[]> => {
  const database = await getDB();
  return database.getAllAsync<AlerteEmail>('SELECT * FROM alertes_email ORDER BY email ASC');
};

export const insertAlerteEmail = async (data: { nom?: string; email: string; role?: string }): Promise<string> => {
  const database = await getDB();
  const id = generateId();
  await database.runAsync(
    'INSERT OR REPLACE INTO alertes_email (id, nom, email, role) VALUES (?, ?, ?, ?)',
    [id, data.nom ?? null, data.email, data.role ?? null]
  );
  return id;
};

export const deleteAlerteEmail = async (id: string): Promise<void> => {
  const database = await getDB();
  await database.runAsync('DELETE FROM alertes_email WHERE id = ?', [id]);
};

// ═══════════════════════════════════════════════════════════════════
// UTILISATEURS APP (rôles locaux)
// ═══════════════════════════════════════════════════════════════════

/** Rôle de l’utilisateur actuellement connecté (PIN), pour la sync admin. */
export async function getSessionAppUserRole(): Promise<AppUserRole | null> {
  const id = await AsyncStorage.getItem(APP_SESSION_USER_ID_KEY);
  if (!id) return null;
  const database = await getDB();
  const row = await database.getFirstAsync<{ role: string }>(
    'SELECT role FROM app_users WHERE id = ? AND actif = 1',
    [id]
  );
  if (!row?.role) return null;
  return row.role as AppUserRole;
}

export const listAppUsersForLogin = async (): Promise<Pick<AppUser, 'id' | 'nom' | 'role'>[]> => {
  const database = await getDB();
  return database.getAllAsync<Pick<AppUser, 'id' | 'nom' | 'role'>>(
    'SELECT id, nom, role FROM app_users WHERE actif = 1 ORDER BY nom ASC'
  );
};

export const listAppUsersAll = async (): Promise<AppUser[]> => {
  const database = await getDB();
  const rows = await database.getAllAsync<any>('SELECT * FROM app_users ORDER BY nom ASC');
  return rows.map(r => ({ ...r, actif: !!r.actif, role: r.role as AppUserRole }));
};

export const insertAppUser = async (
  nom: string,
  role: AppUserRole,
  pin: string,
  email?: string
): Promise<string> => {
  const database = await getDB();
  const { hashPin } = await import('../lib/pinAuth');
  const uid = generateId();
  const h = await hashPin(pin);
  await database.runAsync(
    `INSERT INTO app_users (id, nom, email, role, pin_hash, actif) VALUES (?, ?, ?, ?, ?, 1)`,
    [uid, nom.trim(), email?.trim() ?? null, role, h]
  );
  return uid;
};

export const verifyAppUserPin = async (userId: string, pin: string): Promise<AppUser | null> => {
  const database = await getDB();
  const row = await database.getFirstAsync<any>('SELECT * FROM app_users WHERE id = ? AND actif = 1', [userId]);
  if (!row) return null;
  const { verifyPin } = await import('../lib/pinAuth');
  const ok = await verifyPin(pin, row.pin_hash);
  if (!ok) return null;
  return { ...row, actif: !!row.actif, role: row.role as AppUserRole };
};

export const updateAppUserExpoPushToken = async (userId: string, token: string | null): Promise<void> => {
  const database = await getDB();
  await database.runAsync('UPDATE app_users SET expo_push_token = ? WHERE id = ?', [token, userId]);
};

/** Jetons distincts des comptes admin / technicien (réception des notifications « retour matériel »). */
export const getStaffExpoPushTokens = async (): Promise<string[]> => {
  const database = await getDB();
  const rows = await database.getAllAsync<{ t: string }>(
    `SELECT DISTINCT trim(expo_push_token) AS t FROM app_users
     WHERE actif = 1 AND role IN ('admin', 'technicien')
       AND expo_push_token IS NOT NULL AND trim(expo_push_token) != ''`
  );
  return rows.map(r => r.t).filter(Boolean);
};

export const getAdminExpoPushTokens = async (): Promise<string[]> => {
  const database = await getDB();
  const rows = await database.getAllAsync<{ t: string }>(
    `SELECT DISTINCT trim(expo_push_token) AS t FROM app_users
     WHERE actif = 1 AND role = 'admin'
       AND expo_push_token IS NOT NULL AND trim(expo_push_token) != ''`
  );
  return rows.map(r => r.t).filter(Boolean);
};

export const getAdminNotificationEmails = async (): Promise<string[]> => {
  const database = await getDB();
  const fromUsers = await database.getAllAsync<{ email: string }>(
    `SELECT email FROM app_users
     WHERE actif = 1 AND role = 'admin'
       AND email IS NOT NULL AND trim(email) != ''`
  );
  const set = new Set<string>();
  for (const r of fromUsers) {
    const e = r.email?.trim().toLowerCase();
    if (e && e.includes('@')) set.add(e);
  }
  return [...set];
};

export const getExpoPushTokenForUserId = async (userId: string | undefined | null): Promise<string | null> => {
  if (!userId?.trim()) return null;
  const database = await getDB();
  const row = await database.getFirstAsync<{ t: string | null }>(
    `SELECT trim(expo_push_token) AS t FROM app_users WHERE id = ? AND actif = 1`,
    [userId.trim()]
  );
  const t = row?.t?.trim();
  return t || null;
};

/** Emails staff + liste alertes (repli courriel si aucun jeton push). */
export const getStaffNotificationEmails = async (): Promise<string[]> => {
  const database = await getDB();
  const fromAlertes = await database.getAllAsync<{ email: string }>(
    `SELECT email FROM alertes_email WHERE email IS NOT NULL AND trim(email) != ''`
  );
  const fromUsers = await database.getAllAsync<{ email: string }>(
    `SELECT email FROM app_users
     WHERE actif = 1 AND role IN ('admin', 'technicien')
       AND email IS NOT NULL AND trim(email) != ''`
  );
  const set = new Set<string>();
  for (const r of [...fromAlertes, ...fromUsers]) {
    const e = r.email?.trim().toLowerCase();
    if (e && e.includes('@')) set.add(e);
  }
  return [...set];
};

// ═══════════════════════════════════════════════════════════════════
// HISTORIQUE EMPRUNTS PAR MATÉRIEL
// ═══════════════════════════════════════════════════════════════════

export const getHistoriqueEmpruntsMateriel = async (materielId: string): Promise<MaterielEmpruntHistorique[]> => {
  const database = await getDB();
  const rows = await database.getAllAsync<any>(
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
};

export const getMaterielsPourMaintenanceAlertes = async (fenetreJours: number = 30): Promise<Materiel[]> => {
  const mats = await getMateriel();
  const limit = new Date();
  limit.setDate(limit.getDate() + fenetreJours);
  const limitStr = limit.toISOString().split('T')[0];
  return mats.filter(m => {
    const dv = m.date_validite;
    const pc = m.prochain_controle;
    if (dv && dv <= limitStr) return true;
    if (pc && pc <= limitStr) return true;
    return false;
  });
};

// ═══════════════════════════════════════════════════════════════════
// STATS DASHBOARD
// ═══════════════════════════════════════════════════════════════════

export const getStats = async () => {
  const database = await getDB();
  const totalMat = await database.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM materiels');
  const enPret = await database.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM materiels WHERE statut = 'en prêt'");
  const pretsCours = await database.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM prets WHERE statut = 'en cours'");
  const alertesConso = await database.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM consommables WHERE stock_actuel <= seuil_minimum');

  return {
    totalMateriels: totalMat?.count ?? 0,
    enPret: enPret?.count ?? 0,
    pretsEnCours: pretsCours?.count ?? 0,
    alertesConsommables: alertesConso?.count ?? 0,
  };
};

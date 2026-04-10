// src/db/database.ts
import * as SQLite from 'expo-sqlite';
import {
  Materiel, Consommable, Pret, PretMateriel, Categorie, Localisation, AlerteEmail,
  AppUser, AppUserRole, MaterielEmpruntHistorique,
} from '../types';

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
  await addCol('pret_materiels', 'etat_au_retour', 'TEXT');

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

// ═══════════════════════════════════════════════════════════════════
// MATÉRIELS
// ═══════════════════════════════════════════════════════════════════

export const getMateriel = async (): Promise<Materiel[]> => {
  const database = await getDB();
  const rows = await database.getAllAsync<any>(`
    SELECT m.*, c.nom as categorie_nom, l.nom as localisation_nom
    FROM materiels m
    LEFT JOIN categories c ON m.categorie_id = c.id
    LEFT JOIN localisations l ON m.localisation_id = l.id
    ORDER BY m.created_at DESC
  `);
  return rows.map(r => ({ ...r, synced: !!r.synced }));
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
  const q = `%${query}%`;
  const rows = await database.getAllAsync<any>(`
    SELECT * FROM materiels
    WHERE nom LIKE ? OR qr_code LIKE ? OR numero_serie LIKE ? OR type LIKE ? OR marque LIKE ?
    ORDER BY created_at DESC
    LIMIT 50
  `, [q, q, q, q, q]);
  return rows.map(r => ({ ...r, synced: !!r.synced }));
};

export const insertMateriel = async (data: Omit<Materiel, 'id' | 'created_at' | 'updated_at' | 'synced'>): Promise<string> => {
  const database = await getDB();
  const id = generateId();
  const now = new Date().toISOString();
  await database.runAsync(`
    INSERT INTO materiels (id, nom, type, marque, numero_serie, poids_kg, categorie_id, localisation_id,
      etat, statut, date_achat, date_validite, prochain_controle, intervalle_controle_jours,
      technicien, qr_code, nfc_tag_id, photo_url, photo_local,
      created_at, updated_at, synced)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `, [id, data.nom, data.type ?? null, data.marque ?? null, data.numero_serie ?? null,
      data.poids_kg ?? null, data.categorie_id ?? null, data.localisation_id ?? null,
      data.etat, data.statut, data.date_achat ?? null, data.date_validite ?? null,
      data.prochain_controle ?? null, data.intervalle_controle_jours ?? null,
      data.technicien ?? null, data.qr_code ?? null, data.nfc_tag_id ?? null,
      data.photo_url ?? null, data.photo_local ?? null, now, now]);
  return id;
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
  const database = await getDB();
  await database.runAsync('DELETE FROM materiels WHERE id = ?', [id]);
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
  const rows = await database.getAllAsync<any>(`
    SELECT c.*, cat.nom as categorie_nom, l.nom as localisation_nom
    FROM consommables c
    LEFT JOIN categories cat ON c.categorie_id = cat.id
    LEFT JOIN localisations l ON c.localisation_id = l.id
    ORDER BY c.nom ASC
  `);
  return rows.map(r => ({ ...r, synced: !!r.synced }));
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
  await database.runAsync(`
    INSERT INTO consommables (id, nom, reference, unite, stock_actuel, seuil_minimum,
      categorie_id, localisation_id, fournisseur, prix_unitaire, qr_code, nfc_tag_id,
      created_at, updated_at, synced)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `, [id, data.nom, data.reference ?? null, data.unite, data.stock_actuel, data.seuil_minimum,
      data.categorie_id ?? null, data.localisation_id ?? null, data.fournisseur ?? null,
      data.prix_unitaire ?? null, data.qr_code ?? null, data.nfc_tag_id ?? null, now, now]);
  return id;
};

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
  return rows.map(r => ({ ...r, synced: !!r.synced }));
};

export const getPretMateriel = async (pretId: string): Promise<PretMateriel[]> => {
  const database = await getDB();
  return database.getAllAsync<PretMateriel>(`
    SELECT pm.*, m.nom as materiel_nom
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

  await database.runAsync(`
    INSERT INTO prets (id, numero_feuille, statut, emprunteur, organisation, telephone, email,
      date_depart, retour_prevu, retour_reel, valeur_estimee, commentaire,
      signature_emprunteur_data, signed_at, emprunteur_user_id,
      created_at, updated_at, synced)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `, [id, pret.numero_feuille ?? null, pret.statut, pret.emprunteur,
      pret.organisation ?? null, pret.telephone ?? null, pret.email ?? null,
      pret.date_depart, pret.retour_prevu ?? null, pret.retour_reel ?? null,
      pret.valeur_estimee ?? null, pret.commentaire ?? null,
      pret.signature_emprunteur_data ?? null, pret.signed_at ?? null, pret.emprunteur_user_id ?? null,
      now, now]);

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

export type UpdatePretOptions = {
  lignesEtatRetour?: { materiel_id: string; etat_au_retour: string }[];
};

export const updatePret = async (id: string, data: Partial<Pret>, options?: UpdatePretOptions): Promise<void> => {
  const database = await getDB();
  const now = new Date().toISOString();
  const fields = Object.keys(data).filter(k => !['id', 'created_at', 'synced'].includes(k));
  const setClause = [...fields.map(f => `${f} = ?`), 'updated_at = ?', 'synced = 0'].join(', ');
  const values = [...fields.map(f => (data as any)[f]), now, id];
  await database.runAsync(`UPDATE prets SET ${setClause} WHERE id = ?`, values);

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

export const getCategories = async (): Promise<Categorie[]> => {
  const database = await getDB();
  return database.getAllAsync<Categorie>('SELECT * FROM categories ORDER BY nom ASC');
};

export const insertCategorie = async (nom: string): Promise<string> => {
  const database = await getDB();
  const id = generateId();
  await database.runAsync(
    'INSERT INTO categories (id, nom) VALUES (?, ?)', [id, nom]
  );
  return id;
};

export const deleteCategorie = async (id: string): Promise<void> => {
  const database = await getDB();
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

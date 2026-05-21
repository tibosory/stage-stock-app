// src/db/database.ts
import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Materiel, Consommable, Pret, PretMateriel, Categorie, Localisation, AlerteEmail,
  AppUser, AppUserRole, MaterielEmpruntHistorique, Beneficiaire, MouvementStockDetail,
  Profile, ProfileSchema, FieldDefinition, Tour, TourLocation, Assignment, ActivityLog,
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
  // Legacy installs may not have these tracking tables yet.
  // Ensure they exist before ALTER/INDEX migration steps that reference them.
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS tours (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'planned',
      start_date TEXT NOT NULL,
      end_date TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      synced INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS tour_locations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT,
      date_start TEXT,
      date_end TEXT,
      tour_id TEXT NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      synced INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS tour_flightcases (
      id TEXT PRIMARY KEY,
      tour_id TEXT NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
      case_number INTEGER NOT NULL,
      total_cases INTEGER NOT NULL,
      label TEXT NOT NULL,
      qr_code TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      synced INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS material_assignments (
      id TEXT PRIMARY KEY,
      material_id TEXT NOT NULL REFERENCES materiels(id),
      tour_id TEXT NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
      location_id TEXT REFERENCES tour_locations(id),
      flightcase_id TEXT REFERENCES tour_flightcases(id),
      packaging_photo_local TEXT,
      quantity INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'assigned',
      assigned_at TEXT NOT NULL,
      returned_at TEXT,
      assigned_to TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      synced INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      material_id TEXT NOT NULL REFERENCES materiels(id),
      tour_id TEXT,
      location_id TEXT,
      user_id TEXT,
      timestamp TEXT NOT NULL,
      note TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      synced INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS tour_documents (
      id TEXT PRIMARY KEY,
      tour_id TEXT NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      file_name TEXT NOT NULL,
      mime_type TEXT,
      file_size INTEGER,
      local_uri TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      synced INTEGER DEFAULT 0
    );
  `);

  const addCol = async (table: string, name: string, defSql: string) => {
    const rows = await database.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
    if (!rows.some(r => r.name === name)) {
      await database.execAsync(`ALTER TABLE ${table} ADD COLUMN ${name} ${defSql}`);
    }
  };
  await addCol('materiels', 'prochain_controle', 'TEXT');
  await addCol('materiels', 'intervalle_controle_jours', 'INTEGER');
  await addCol('materiels', 'maintenance_todo', 'TEXT');
  await addCol('materiels', 'maintenance_last_comment', 'TEXT');
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
  await addCol('materiels', 'technical_data', 'TEXT');
  await addCol('categories', 'parent_id', 'TEXT');
  await addCol('consommables', 'photo_local', 'TEXT');
  await addCol('consommables', 'photo_url', 'TEXT');
  await addCol('consommables', 'gel_brand', 'TEXT');
  await addCol('consommables', 'gel_code', 'TEXT');
  await addCol('consommables', 'gel_instead_of_photo', 'INTEGER DEFAULT 0');
  await addCol('materiels', 'profile_id', 'TEXT');
  await addCol('materiels', 'profile_version', 'INTEGER');
  await addCol('materiels', 'tracking_state', 'TEXT');
  await addCol('materiels', 'current_tour_id', 'TEXT');
  await addCol('materiels', 'current_location_id', 'TEXT');
  await addCol('material_assignments', 'flightcase_id', 'TEXT');
  await addCol('material_assignments', 'packaging_photo_local', 'TEXT');
  await addCol('tour_documents', 'mime_type', 'TEXT');
  await addCol('tour_documents', 'file_size', 'INTEGER');

  await database.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_materiels_nom ON materiels(nom);
    CREATE INDEX IF NOT EXISTS idx_materiels_statut ON materiels(statut);
    CREATE INDEX IF NOT EXISTS idx_materiels_categorie ON materiels(categorie_id);
    CREATE INDEX IF NOT EXISTS idx_materiels_qr ON materiels(qr_code);
    CREATE INDEX IF NOT EXISTS idx_consommables_nom ON consommables(nom);
    CREATE INDEX IF NOT EXISTS idx_consommables_categorie ON consommables(categorie_id);
    CREATE INDEX IF NOT EXISTS idx_tour_documents_tour ON tour_documents(tour_id);
    CREATE INDEX IF NOT EXISTS idx_tour_documents_title ON tour_documents(title);
  `);

  // Tables du moteur de synchronisation Caractère (@caractere/sync-engine).
  // Créées idempotemment au boot — inertes tant que l'adapter SQLite n'est
  // pas branché en production (cf. docs/SYNC_ENGINE_ARCHITECTURE.md §14, étapes S2.3+).
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS sync_outbox (
      id TEXT PRIMARY KEY,
      entity TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      payload TEXT NOT NULL,
      base_version TEXT,
      created_at TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      next_attempt_at TEXT,
      status TEXT NOT NULL DEFAULT 'pending'
    );
    CREATE INDEX IF NOT EXISTS idx_sync_outbox_status_due ON sync_outbox(status, next_attempt_at);
    CREATE INDEX IF NOT EXISTS idx_sync_outbox_entity ON sync_outbox(entity, entity_id);

    CREATE TABLE IF NOT EXISTS sync_cursor (
      entity TEXT PRIMARY KEY,
      last_pulled_at TEXT,
      etag TEXT,
      record_count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts TEXT NOT NULL,
      level TEXT NOT NULL,
      event TEXT NOT NULL,
      entity TEXT,
      entity_id TEXT,
      detail TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_sync_log_ts ON sync_log(ts);
  `);

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
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      current_version INTEGER DEFAULT 1,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS profile_schemas (
      profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      fields_json TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (profile_id, version)
    );
    CREATE TABLE IF NOT EXISTS tours (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'planned',
      start_date TEXT NOT NULL,
      end_date TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      synced INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS tour_locations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT,
      date_start TEXT,
      date_end TEXT,
      tour_id TEXT NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      synced INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS material_assignments (
      id TEXT PRIMARY KEY,
      material_id TEXT NOT NULL REFERENCES materiels(id),
      tour_id TEXT NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
      location_id TEXT REFERENCES tour_locations(id),
      flightcase_id TEXT REFERENCES tour_flightcases(id),
      packaging_photo_local TEXT,
      quantity INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'assigned',
      assigned_at TEXT NOT NULL,
      returned_at TEXT,
      assigned_to TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      synced INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS tour_flightcases (
      id TEXT PRIMARY KEY,
      tour_id TEXT NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
      case_number INTEGER NOT NULL,
      total_cases INTEGER NOT NULL,
      label TEXT NOT NULL,
      qr_code TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      synced INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      material_id TEXT NOT NULL REFERENCES materiels(id),
      tour_id TEXT,
      location_id TEXT,
      user_id TEXT,
      timestamp TEXT NOT NULL,
      note TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      synced INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS tour_documents (
      id TEXT PRIMARY KEY,
      tour_id TEXT NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      file_name TEXT NOT NULL,
      mime_type TEXT,
      file_size INTEGER,
      local_uri TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      synced INTEGER DEFAULT 0
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
      technical_data TEXT,
      profile_id TEXT,
      profile_version INTEGER,
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
  const acc = await import('./accueilProDb');
  await acc.ensureAccueilProSchema(database);
};

// ── Génération d'ID unique ──────────────────────────────────────────────────
export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
};

/** INSERT matériel : colonnes hors synced — 36 placeholders + synced=0 littéral. */
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
  const technicalData =
    typeof data.technical_data === 'string'
      ? data.technical_data
      : data.technical_data != null
        ? JSON.stringify(data.technical_data)
        : null;
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
    data.maintenance_todo ?? null,
    data.maintenance_last_comment ?? null,
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
    technicalData,
    data.profile_id ?? null,
    data.profile_version ?? null,
    now,
    now,
  ];
  if (params.length !== 38) {
    throw new Error(`insert materiel: 38 paramètres attendus, ${params.length} fournis`);
  }
  const placeholders = Array(38).fill('?').join(', ');
  const sql = `
    INSERT INTO materiels (id, nom, type, marque, numero_serie, poids_kg, categorie_id, localisation_id,
      etat, statut, date_achat, date_validite, prochain_controle, intervalle_controle_jours,
      maintenance_todo, maintenance_last_comment,
      technicien, qr_code, nfc_tag_id, photo_url, photo_local,
      notice_pdf_local, notice_photo_local, notice_pdf_url, notice_photo_url,
      vgp_actif, vgp_periodicite_jours, vgp_derniere_visite, vgp_libelle, vgp_epi,
      gel_brand, gel_code, gel_instead_of_photo,
      technical_data,
      profile_id, profile_version,
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

// ═══════════════════════════════════════════════════════════════════
// MATÉRIELS
// ═══════════════════════════════════════════════════════════════════

function buildCategoryPathResolver(categories: Categorie[]): (leafId: string | null | undefined) => string {
  const byId = new Map(categories.map(c => [c.id, c]));
  return (leafId: string | null | undefined): string => {
    if (!leafId) return '';
    const parts: string[] = [];
    let cur: Categorie | undefined = byId.get(leafId);
    let guard = 0;
    while (cur && guard++ < 64) {
      parts.unshift(cur.nom);
      const pid = cur.parent_id;
      cur = pid ? byId.get(pid) : undefined;
    }
    return parts.join(' › ');
  };
}

export const getMateriel = async (): Promise<Materiel[]> => {
  const database = await getDB();
  const cats = await getCategories();
  const pathFor = buildCategoryPathResolver(cats);
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
    categorie_nom: r.categorie_id ? pathFor(r.categorie_id) : r.categorie_nom,
  }));
};

/** Matériels suivis pour les VGP (visites / contrôles périodiques obligatoires). */
/** @deprecated Use `src/db/inventoryOpsDb.ts` */
export const getMaterielsVgpSuivi = async (): Promise<Materiel[]> => {
  const mod = await import('./inventoryOpsDb');
  return mod.getMaterielsVgpSuivi();
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

/** @deprecated Use `src/db/inventoryOpsDb.ts` */
export const getMaterielByQr = async (qr: string): Promise<Materiel | null> => {
  const mod = await import('./inventoryOpsDb');
  return mod.getMaterielByQr(qr);
};

/** @deprecated Use `src/db/inventoryOpsDb.ts` */
export const getMaterielByNfc = async (nfcId: string): Promise<Materiel | null> => {
  const mod = await import('./inventoryOpsDb');
  return mod.getMaterielByNfc(nfcId);
};

/** @deprecated Use `src/db/inventoryOpsDb.ts` */
export const searchMateriels = async (query: string): Promise<Materiel[]> => {
  const mod = await import('./inventoryOpsDb');
  return mod.searchMateriels(query);
};

/** Recherche texte sur consommables (nom, ref., QR, fournisseur) et sur le chemin de catégorie. */
/** @deprecated Use `src/db/inventoryOpsDb.ts` */
export const searchConsommables = async (query: string): Promise<Consommable[]> => {
  const mod = await import('./inventoryOpsDb');
  return mod.searchConsommables(query);
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
/** @deprecated Use `src/db/inventoryOpsDb.ts` */
export const insertMaterielsSerieBatch = async (
  rows: Array<Omit<Materiel, 'id' | 'created_at' | 'updated_at' | 'synced'>>
): Promise<number> => {
  const mod = await import('./inventoryOpsDb');
  return mod.insertMaterielsSerieBatch(rows);
};

export const updateMateriel = async (id: string, data: Partial<Materiel>): Promise<void> => {
  const database = await getDB();
  const now = new Date().toISOString();
  const fields = Object.keys(data).filter(k => !['id', 'created_at', 'synced'].includes(k));
  const setClause = [...fields.map(f => `${f} = ?`), 'updated_at = ?', 'synced = 0'].join(', ');
  const values = [
    ...fields.map(f => {
      const v = (data as any)[f];
      if (f === 'technical_data' && v && typeof v === 'object') {
        return JSON.stringify(v);
      }
      return v;
    }),
    now,
    id,
  ];
  await database.runAsync(`UPDATE materiels SET ${setClause} WHERE id = ?`, values);
};

/** @deprecated Use `src/db/inventoryOpsDb.ts` */
export const deleteMateriel = async (id: string): Promise<void> => {
  const mod = await import('./inventoryOpsDb');
  return mod.deleteMateriel(id);
};

/** @deprecated Use `src/db/inventoryOpsDb.ts` */
export const setNfcTagMateriel = async (materielId: string, nfcTagId: string): Promise<void> => {
  const mod = await import('./inventoryOpsDb');
  return mod.setNfcTagMateriel(materielId, nfcTagId);
};

// ═══════════════════════════════════════════════════════════════════
// CONSOMMABLES
// ═══════════════════════════════════════════════════════════════════

export const getConsommableById = async (id: string): Promise<Consommable | null> => {
  const database = await getDB();
  const row = await database.getFirstAsync<any>('SELECT * FROM consommables WHERE id = ?', [id]);
  return row ? { ...row, synced: !!row.synced } : null;
};

/** @deprecated Use `src/db/inventoryOpsDb.ts` */
export const getConsommableByQr = async (qr: string): Promise<Consommable | null> => {
  const mod = await import('./inventoryOpsDb');
  return mod.getConsommableByQr(qr);
};

export const getConsommables = async (): Promise<Consommable[]> => {
  const database = await getDB();
  const cats = await getCategories();
  const pathFor = buildCategoryPathResolver(cats);
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
    categorie_nom: r.categorie_id ? pathFor(r.categorie_id) : r.categorie_nom,
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
/** @deprecated Use `src/db/inventoryOpsDb.ts` */
export async function createMaterielStubWithScannedCode(opts: {
  qrCode?: string;
  nfcTagId?: string;
}): Promise<string> {
  const mod = await import('./inventoryOpsDb');
  return mod.createMaterielStubWithScannedCode(opts);
}

/** Fiche consommable minimale : le code scanné est enregistré sur la fiche. */
/** @deprecated Use `src/db/inventoryOpsDb.ts` */
export async function createConsommableStubWithScannedCode(opts: {
  qrCode?: string;
  nfcTagId?: string;
}): Promise<string> {
  const mod = await import('./inventoryOpsDb');
  return mod.createConsommableStubWithScannedCode(opts);
}

export const updateConsommable = async (id: string, data: Partial<Consommable>): Promise<void> => {
  const database = await getDB();
  const now = new Date().toISOString();
  const fields = Object.keys(data).filter(k => !['id', 'created_at', 'synced'].includes(k));
  const setClause = [...fields.map(f => `${f} = ?`), 'updated_at = ?', 'synced = 0'].join(', ');
  const values = [...fields.map(f => (data as any)[f]), now, id];
  await database.runAsync(`UPDATE consommables SET ${setClause} WHERE id = ?`, values);
};

/** @deprecated Use `src/db/inventoryOpsDb.ts` */
export const deleteConsommable = async (id: string): Promise<void> => {
  const mod = await import('./inventoryOpsDb');
  return mod.deleteConsommable(id);
};

/** @deprecated Use `src/db/inventoryOpsDb.ts` */
export const ajusterStock = async (consommableId: string, delta: number, note?: string): Promise<void> => {
  const mod = await import('./inventoryOpsDb');
  return mod.ajusterStock(consommableId, delta, note);
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
/** @deprecated Use `src/db/inventoryOpsDb.ts` */
export const getMouvementsStockHistorique = async (
  options: MouvementsStockHistoriqueOptions | number = {}
): Promise<MouvementStockDetail[]> => {
  const mod = await import('./inventoryOpsDb');
  return mod.getMouvementsStockHistorique(options);
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

/** @deprecated Migre vers `src/db/loanDb.ts` (`getPretMateriel`). */
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

/** @deprecated Migre vers `src/db/loanDb.ts` (`insertPret`). */
export { insertPret, insertPretDemande, replacePretDemandeMateriels, updatePret, deletePret } from './loanDb';
export type { UpdatePretOptions } from './loanDb';

// ═══════════════════════════════════════════════════════════════════
// CATÉGORIES & LOCALISATIONS
// ═══════════════════════════════════════════════════════════════════

/** Chaîne « parent › enfant › feuille » pour affichage / listes déroulantes. */
/** @deprecated Use `src/db/catalogDb.ts` */
export function categoryPathById(categories: Categorie[], leafId: string | null | undefined): string {
  return buildCategoryPathResolver(categories)(leafId);
}

/**
 * IDs de catégories pertinentes pour une recherche texte : nom de catégorie ou segment du chemin
 * (parent › enfant › feuille), pour filtrer matériels et consommables par catégorie / sous-catégorie.
 */
function categoryIdsMatchingPathQuery(categories: Categorie[], q: string): string[] {
  const qn = q.trim().toLowerCase();
  if (!qn) return [];
  const pathFor = buildCategoryPathResolver(categories);
  const out = new Set<string>();
  for (const c of categories) {
    if (c.nom && c.nom.toLowerCase().includes(qn)) out.add(c.id);
    const path = pathFor(c.id);
    if (path && path.toLowerCase().includes(qn)) out.add(c.id);
  }
  return [...out];
}

/** @deprecated Use `src/db/catalogDb.ts` */
export const getCategories = async (): Promise<Categorie[]> => {
  const mod = await import('./catalogDb');
  return mod.getCategories();
};

/** Nouvelle catégorie ; `parentId` optionnel pour une sous-catégorie. */
/** @deprecated Use `src/db/catalogDb.ts` */
export const insertCategorie = async (nom: string, parentId?: string | null): Promise<string> => {
  const mod = await import('./catalogDb');
  return mod.insertCategorie(nom, parentId);
};

/** @deprecated Use `src/db/catalogDb.ts` */
export const deleteCategorie = async (id: string): Promise<void> => {
  const mod = await import('./catalogDb');
  return mod.deleteCategorie(id);
};

/** @deprecated Use `src/db/catalogDb.ts` */
export const getLocalisations = async (): Promise<Localisation[]> => {
  const mod = await import('./catalogDb');
  return mod.getLocalisations();
};

/** @deprecated Use `src/db/catalogDb.ts` */
export const insertLocalisation = async (nom: string): Promise<string> => {
  const mod = await import('./catalogDb');
  return mod.insertLocalisation(nom);
};

/** @deprecated Use `src/db/catalogDb.ts` */
export const deleteLocalisation = async (id: string): Promise<void> => {
  const mod = await import('./catalogDb');
  return mod.deleteLocalisation(id);
};

// ═══════════════════════════════════════════════════════════════════
// BÉNÉFICIAIRES (répertoire emprunteurs pour les prêts)
// ═══════════════════════════════════════════════════════════════════

/** @deprecated Use `src/db/metadataDb.ts` */
export const getBeneficiaires = async (): Promise<Beneficiaire[]> => {
  const mod = await import('./metadataDb');
  return mod.getBeneficiaires();
};

/** @deprecated Use `src/db/metadataDb.ts` */
export const insertBeneficiaire = async (data: {
  nom: string;
  organisation?: string | null;
  telephone?: string | null;
  email?: string | null;
}): Promise<string> => {
  const mod = await import('./metadataDb');
  return mod.insertBeneficiaire(data);
};

/** @deprecated Use `src/db/metadataDb.ts` */
export const updateBeneficiaire = async (
  id: string,
  patch: { nom?: string; organisation?: string | null; telephone?: string | null; email?: string | null }
): Promise<void> => {
  const mod = await import('./metadataDb');
  return mod.updateBeneficiaire(id, patch);
};

/** @deprecated Use `src/db/metadataDb.ts` */
export const deleteBeneficiaire = async (id: string): Promise<void> => {
  const mod = await import('./metadataDb');
  return mod.deleteBeneficiaire(id);
};

// ═══════════════════════════════════════════════════════════════════
// ALERTES EMAIL
// ═══════════════════════════════════════════════════════════════════

/** @deprecated Use `src/db/metadataDb.ts` */
export const getAlertesEmail = async (): Promise<AlerteEmail[]> => {
  const mod = await import('./metadataDb');
  return mod.getAlertesEmail();
};

/** @deprecated Use `src/db/metadataDb.ts` */
export const insertAlerteEmail = async (data: { nom?: string; email: string; role?: string }): Promise<string> => {
  const mod = await import('./metadataDb');
  return mod.insertAlerteEmail(data);
};

/** @deprecated Use `src/db/metadataDb.ts` */
export const deleteAlerteEmail = async (id: string): Promise<void> => {
  const mod = await import('./metadataDb');
  return mod.deleteAlerteEmail(id);
};

// ═══════════════════════════════════════════════════════════════════
// UTILISATEURS APP (rôles locaux)
// ═══════════════════════════════════════════════════════════════════

/** Rôle de l’utilisateur actuellement connecté (PIN), pour la sync admin. */
/** @deprecated Use `src/db/userDb.ts` */
export async function getSessionAppUserRole(): Promise<AppUserRole | null> {
  const mod = await import('./userDb');
  return mod.getSessionAppUserRole();
}

/** @deprecated Use `src/db/userDb.ts` */
export const listAppUsersForLogin = async (): Promise<Pick<AppUser, 'id' | 'nom' | 'role'>[]> => {
  const mod = await import('./userDb');
  return mod.listAppUsersForLogin();
};

/** @deprecated Use `src/db/userDb.ts` */
export const listAppUsersAll = async (): Promise<AppUser[]> => {
  const mod = await import('./userDb');
  return mod.listAppUsersAll();
};

/** @deprecated Use `src/db/userDb.ts` */
export const insertAppUser = async (
  nom: string,
  role: AppUserRole,
  pin: string,
  email?: string
): Promise<string> => {
  const mod = await import('./userDb');
  return mod.insertAppUser(nom, role, pin, email);
};

/** @deprecated Use `src/db/userDb.ts` */
export const verifyAppUserPin = async (userId: string, pin: string): Promise<AppUser | null> => {
  const mod = await import('./userDb');
  return mod.verifyAppUserPin(userId, pin);
};

/** @deprecated Use `src/db/userDb.ts` */
export const updateAppUserExpoPushToken = async (userId: string, token: string | null): Promise<void> => {
  const mod = await import('./userDb');
  return mod.updateAppUserExpoPushToken(userId, token);
};

/** Jetons distincts des comptes admin / technicien (réception des notifications « retour matériel »). */
/** @deprecated Use `src/db/userDb.ts` */
export const getStaffExpoPushTokens = async (): Promise<string[]> => {
  const mod = await import('./userDb');
  return mod.getStaffExpoPushTokens();
};

/** @deprecated Use `src/db/userDb.ts` */
export const getAdminExpoPushTokens = async (): Promise<string[]> => {
  const mod = await import('./userDb');
  return mod.getAdminExpoPushTokens();
};

/** @deprecated Use `src/db/userDb.ts` */
export const getAdminNotificationEmails = async (): Promise<string[]> => {
  const mod = await import('./userDb');
  return mod.getAdminNotificationEmails();
};

/** @deprecated Use `src/db/userDb.ts` */
export const getExpoPushTokenForUserId = async (userId: string | undefined | null): Promise<string | null> => {
  const mod = await import('./userDb');
  return mod.getExpoPushTokenForUserId(userId);
};

/** Emails staff + liste alertes (repli courriel si aucun jeton push). */
/** @deprecated Use `src/db/userDb.ts` */
export const getStaffNotificationEmails = async (): Promise<string[]> => {
  const mod = await import('./userDb');
  return mod.getStaffNotificationEmails();
};

// ═══════════════════════════════════════════════════════════════════
// HISTORIQUE EMPRUNTS PAR MATÉRIEL
// ═══════════════════════════════════════════════════════════════════

/** @deprecated Use `src/db/inventoryOpsDb.ts` */
export const getHistoriqueEmpruntsMateriel = async (materielId: string): Promise<MaterielEmpruntHistorique[]> => {
  const mod = await import('./inventoryOpsDb');
  return mod.getHistoriqueEmpruntsMateriel(materielId);
};

export const getMaterielsPourMaintenanceAlertes = async (fenetreJours: number = 30): Promise<Materiel[]> => {
  const mats = await getMateriel();
  const limit = new Date();
  limit.setDate(limit.getDate() + fenetreJours);
  const limitStr = limit.toISOString().split('T')[0];
  return mats.filter(m => {
    const intervalle = Number(m.intervalle_controle_jours ?? 0);
    if (!Number.isFinite(intervalle) || intervalle <= 0) return false;
    const last = (m.prochain_controle ?? '').trim();
    // Fréquence définie mais aucune maintenance horodatée : à signaler immédiatement.
    if (!last) return true;
    const base = new Date(`${last}T12:00:00`);
    if (Number.isNaN(base.getTime())) return true;
    base.setDate(base.getDate() + intervalle);
    const dueStr = base.toISOString().split('T')[0];
    return dueStr <= limitStr;
  });
};

// ═══════════════════════════════════════════════════════════════════
// STATS DASHBOARD
// ═══════════════════════════════════════════════════════════════════

/** @deprecated Use `src/db/metadataDb.ts` */
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

// ═══════════════════════════════════════════════════════════════════
// PROFILS MÉTIER DYNAMIQUES (SCHEMAS VERSIONNÉS)
// ═══════════════════════════════════════════════════════════════════

function sanitizeFieldsForSchema(fields: FieldDefinition[]): FieldDefinition[] {
  const seen = new Set<string>();
  return fields.map(f => {
    const id = String(f.id || '').trim();
    if (!id) throw new Error('Chaque champ doit avoir un id.');
    if (seen.has(id)) throw new Error(`ID de champ dupliqué: ${id}`);
    seen.add(id);
    return {
      ...f,
      id,
      label: String(f.label || '').trim(),
      type: f.type,
      required: !!f.required,
      unit: f.unit ?? null,
      defaultValue: f.defaultValue ?? null,
      options: Array.isArray(f.options) ? f.options.map(o => String(o).trim()).filter(Boolean) : [],
      min: f.min ?? null,
      max: f.max ?? null,
      isDeleted: !!f.isDeleted,
    };
  });
}

function mapProfileRow(r: any): Profile {
  return {
    id: r.id,
    name: r.name,
    version: Number(r.current_version ?? 1),
    isActive: !!r.is_active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export const getProfiles = async (): Promise<Profile[]> => {
  const database = await getDB();
  const rows = await database.getAllAsync<any>(
    'SELECT * FROM profiles ORDER BY is_active DESC, updated_at DESC'
  );
  return rows.map(mapProfileRow);
};

export const createProfile = async (name: string): Promise<Profile> => {
  const database = await getDB();
  const id = generateId();
  const now = new Date().toISOString();
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Nom de profil requis.');

  await database.runAsync(
    `INSERT INTO profiles (id, name, current_version, is_active, created_at, updated_at)
     VALUES (?, ?, 1, 1, ?, ?)`,
    [id, trimmed, now, now]
  );
  await database.runAsync(
    `INSERT INTO profile_schemas (profile_id, version, fields_json, created_at, updated_at)
     VALUES (?, 1, ?, ?, ?)`,
    [id, JSON.stringify([]), now, now]
  );
  const row = await database.getFirstAsync<any>('SELECT * FROM profiles WHERE id = ?', [id]);
  return mapProfileRow(row);
};

export const setProfileActive = async (profileId: string, isActive: boolean): Promise<void> => {
  const database = await getDB();
  await database.runAsync(
    'UPDATE profiles SET is_active = ?, updated_at = ? WHERE id = ?',
    [isActive ? 1 : 0, new Date().toISOString(), profileId]
  );
};

export const getProfileVersionHistory = async (profileId: string): Promise<ProfileSchema[]> => {
  const database = await getDB();
  const rows = await database.getAllAsync<any>(
    'SELECT * FROM profile_schemas WHERE profile_id = ? ORDER BY version DESC',
    [profileId]
  );
  return rows.map(r => ({
    profileId: r.profile_id,
    version: Number(r.version),
    fields: JSON.parse(r.fields_json || '[]'),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
};

export const getProfileSchema = async (
  profileId: string,
  version?: number
): Promise<ProfileSchema | null> => {
  const database = await getDB();
  let row: any;
  if (version != null) {
    row = await database.getFirstAsync<any>(
      'SELECT * FROM profile_schemas WHERE profile_id = ? AND version = ?',
      [profileId, version]
    );
  } else {
    row = await database.getFirstAsync<any>(
      `SELECT s.* FROM profile_schemas s
       JOIN profiles p ON p.id = s.profile_id AND p.current_version = s.version
       WHERE s.profile_id = ?`,
      [profileId]
    );
  }
  if (!row) return null;
  return {
    profileId: row.profile_id,
    version: Number(row.version),
    fields: JSON.parse(row.fields_json || '[]'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export const saveProfileSchemaNewVersion = async (
  profileId: string,
  fields: FieldDefinition[],
  nextName?: string
): Promise<ProfileSchema> => {
  const database = await getDB();
  const now = new Date().toISOString();
  const sanitized = sanitizeFieldsForSchema(fields);
  const profile = await database.getFirstAsync<any>('SELECT * FROM profiles WHERE id = ?', [profileId]);
  if (!profile) throw new Error('Profil introuvable.');
  const nextVersion = Number(profile.current_version ?? 1) + 1;

  await database.runAsync(
    `INSERT INTO profile_schemas (profile_id, version, fields_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [profileId, nextVersion, JSON.stringify(sanitized), now, now]
  );
  await database.runAsync(
    `UPDATE profiles
     SET current_version = ?, updated_at = ?, name = COALESCE(?, name)
     WHERE id = ?`,
    [nextVersion, now, nextName?.trim() || null, profileId]
  );

  return {
    profileId,
    version: nextVersion,
    fields: sanitized,
    createdAt: now,
    updatedAt: now,
  };
};

// ═══════════════════════════════════════════════════════════════════
// TOUR MODE / TRACKING
// ═══════════════════════════════════════════════════════════════════

function mapTourRow(r: any): Tour {
  return {
    id: r.id,
    name: r.name,
    status: r.status,
    startDate: r.start_date,
    endDate: r.end_date ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    synced: !!r.synced,
  };
}

function mapLocationRow(r: any): TourLocation {
  return {
    id: r.id,
    name: r.name,
    address: r.address ?? null,
    dateStart: r.date_start ?? null,
    dateEnd: r.date_end ?? null,
    tourId: r.tour_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    synced: !!r.synced,
  };
}

function mapAssignmentRow(r: any): Assignment {
  return {
    id: r.id,
    materialId: r.material_id,
    tourId: r.tour_id,
    locationId: r.location_id ?? null,
    quantity: Number(r.quantity ?? 0),
    status: r.status,
    assignedAt: r.assigned_at,
    returnedAt: r.returned_at ?? null,
    assignedTo: r.assigned_to ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    synced: !!r.synced,
  };
}

function mapLogRow(r: any): ActivityLog {
  return {
    id: r.id,
    type: r.type,
    materialId: r.material_id,
    tourId: r.tour_id ?? null,
    locationId: r.location_id ?? null,
    userId: r.user_id ?? null,
    timestamp: r.timestamp,
    note: r.note ?? null,
    createdAt: r.created_at,
    synced: !!r.synced,
    materialName: r.material_name ?? null,
    tourName: r.tour_name ?? null,
    locationName: r.location_name ?? null,
  };
}

export async function listTours(): Promise<Tour[]> {
  const database = await getDB();
  const rows = await database.getAllAsync<any>('SELECT * FROM tours ORDER BY start_date DESC, created_at DESC');
  return rows.map(mapTourRow);
}

export async function createTour(input: {
  name: string;
  status?: Tour['status'];
  startDate: string;
  endDate?: string | null;
}): Promise<Tour> {
  const database = await getDB();
  const now = new Date().toISOString();
  const id = generateId();
  await database.runAsync(
    `INSERT INTO tours (id, name, status, start_date, end_date, created_at, updated_at, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
    [id, input.name.trim(), input.status ?? 'planned', input.startDate, input.endDate ?? null, now, now]
  );
  const row = await database.getFirstAsync<any>('SELECT * FROM tours WHERE id = ?', [id]);
  return mapTourRow(row);
}

export async function listTourLocations(tourId: string): Promise<TourLocation[]> {
  const database = await getDB();
  const rows = await database.getAllAsync<any>(
    'SELECT * FROM tour_locations WHERE tour_id = ? ORDER BY date_start ASC, created_at ASC',
    [tourId]
  );
  return rows.map(mapLocationRow);
}

export async function createTourLocation(input: {
  name: string;
  address?: string | null;
  dateStart?: string | null;
  dateEnd?: string | null;
  tourId: string;
}): Promise<TourLocation> {
  const database = await getDB();
  const now = new Date().toISOString();
  const id = generateId();
  await database.runAsync(
    `INSERT INTO tour_locations (id, name, address, date_start, date_end, tour_id, created_at, updated_at, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [id, input.name.trim(), input.address ?? null, input.dateStart ?? null, input.dateEnd ?? null, input.tourId, now, now]
  );
  const row = await database.getFirstAsync<any>('SELECT * FROM tour_locations WHERE id = ?', [id]);
  return mapLocationRow(row);
}

export async function listAssignmentsByTour(tourId: string): Promise<Assignment[]> {
  const database = await getDB();
  const rows = await database.getAllAsync<any>(
    'SELECT * FROM material_assignments WHERE tour_id = ? ORDER BY assigned_at DESC',
    [tourId]
  );
  return rows.map(mapAssignmentRow);
}

export async function listAssignmentsByMaterial(materialId: string): Promise<Assignment[]> {
  const database = await getDB();
  const rows = await database.getAllAsync<any>(
    'SELECT * FROM material_assignments WHERE material_id = ? ORDER BY assigned_at DESC',
    [materialId]
  );
  return rows.map(mapAssignmentRow);
}

export async function getAssignmentById(assignmentId: string): Promise<Assignment | null> {
  const database = await getDB();
  const row = await database.getFirstAsync<any>(
    'SELECT * FROM material_assignments WHERE id = ?',
    [assignmentId]
  );
  return row ? mapAssignmentRow(row) : null;
}

export async function createAssignment(input: {
  materialId: string;
  tourId: string;
  locationId?: string | null;
  quantity: number;
  status?: Assignment['status'];
  assignedAt: string;
  assignedTo?: string | null;
}): Promise<Assignment> {
  const database = await getDB();
  const now = new Date().toISOString();
  const id = generateId();
  await database.runAsync(
    `INSERT INTO material_assignments (
      id, material_id, tour_id, location_id, quantity, status, assigned_at, assigned_to, created_at, updated_at, synced
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      id,
      input.materialId,
      input.tourId,
      input.locationId ?? null,
      input.quantity,
      input.status ?? 'assigned',
      input.assignedAt,
      input.assignedTo ?? null,
      now,
      now,
    ]
  );
  await database.runAsync(
    `UPDATE materiels
     SET tracking_state = 'in_tour', statut = 'en tournée', current_tour_id = ?, current_location_id = ?, updated_at = ?, synced = 0
     WHERE id = ?`,
    [input.tourId, input.locationId ?? null, now, input.materialId]
  );
  const row = await database.getFirstAsync<any>('SELECT * FROM material_assignments WHERE id = ?', [id]);
  return mapAssignmentRow(row);
}

export async function updateAssignmentStatus(
  assignmentId: string,
  input: { status: Assignment['status']; returnedAt?: string | null; locationId?: string | null }
): Promise<void> {
  const database = await getDB();
  const now = new Date().toISOString();
  await database.runAsync(
    `UPDATE material_assignments
     SET status = ?, returned_at = COALESCE(?, returned_at), location_id = COALESCE(?, location_id), updated_at = ?, synced = 0
     WHERE id = ?`,
    [input.status, input.returnedAt ?? null, input.locationId ?? null, now, assignmentId]
  );

  const row = await database.getFirstAsync<any>('SELECT * FROM material_assignments WHERE id = ?', [assignmentId]);
  if (!row) return;

  const trackingState =
    input.status === 'returned'
      ? 'available'
      : input.status === 'lost'
        ? 'lost'
        : input.status === 'damaged'
          ? 'damaged'
          : 'in_tour';

  await database.runAsync(
    `UPDATE materiels
     SET tracking_state = ?, statut = ?, current_tour_id = ?, current_location_id = ?, updated_at = ?, synced = 0
     WHERE id = ?`,
    [
      trackingState,
      trackingState === 'available' ? 'en stock' : trackingState === 'lost' ? 'perdu' : 'en tournée',
      trackingState === 'available' ? null : row.tour_id,
      input.locationId ?? row.location_id ?? null,
      now,
      row.material_id,
    ]
  );
}

export async function moveAssignment(assignmentId: string, locationId: string): Promise<void> {
  const database = await getDB();
  const now = new Date().toISOString();
  await database.runAsync(
    `UPDATE material_assignments SET location_id = ?, updated_at = ?, synced = 0 WHERE id = ?`,
    [locationId, now, assignmentId]
  );
  const row = await database.getFirstAsync<any>('SELECT material_id FROM material_assignments WHERE id = ?', [assignmentId]);
  if (row?.material_id) {
    await database.runAsync(
      `UPDATE materiels SET current_location_id = ?, updated_at = ?, synced = 0 WHERE id = ?`,
      [locationId, now, row.material_id]
    );
  }
}

export async function logActivity(input: {
  type: ActivityLog['type'];
  materialId: string;
  tourId?: string | null;
  locationId?: string | null;
  userId?: string | null;
  timestamp: string;
  note?: string | null;
}): Promise<ActivityLog> {
  const database = await getDB();
  const id = generateId();
  const now = new Date().toISOString();
  await database.runAsync(
    `INSERT INTO activity_logs (
      id, type, material_id, tour_id, location_id, user_id, timestamp, note, created_at, synced
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      id,
      input.type,
      input.materialId,
      input.tourId ?? null,
      input.locationId ?? null,
      input.userId ?? null,
      input.timestamp,
      input.note ?? null,
      now,
    ]
  );
  const row = await database.getFirstAsync<any>('SELECT * FROM activity_logs WHERE id = ?', [id]);
  return mapLogRow(row);
}

export async function listActivityLogs(filters?: {
  materialId?: string;
  tourId?: string;
}): Promise<ActivityLog[]> {
  const { listActivityLogs: list } = await import('./trackingDb');
  return list(filters);
}

export async function getTrackingSnapshot(statusFilter?: string | null): Promise<
  Array<{
    materialId: string;
    materialName: string;
    assignmentQuantity: number;
    assignmentStatus: string;
    tourName: string | null;
    locationName: string | null;
    assignedTo: string | null;
    assignedAt: string;
  }>
> {
  const { getTrackingSnapshot: snap } = await import('./trackingDb');
  return snap(statusFilter);
}

export async function listUnsyncedTourEntities(): Promise<{
  tours: Tour[];
  locations: TourLocation[];
  assignments: Assignment[];
  logs: ActivityLog[];
}> {
  const database = await getDB();
  const [toursRows, locRows, asgRows, logRows] = await Promise.all([
    database.getAllAsync<any>('SELECT * FROM tours WHERE synced = 0'),
    database.getAllAsync<any>('SELECT * FROM tour_locations WHERE synced = 0'),
    database.getAllAsync<any>('SELECT * FROM material_assignments WHERE synced = 0'),
    database.getAllAsync<any>('SELECT * FROM activity_logs WHERE synced = 0'),
  ]);
  return {
    tours: toursRows.map(mapTourRow),
    locations: locRows.map(mapLocationRow),
    assignments: asgRows.map(mapAssignmentRow),
    logs: logRows.map(mapLogRow),
  };
}

export async function markTourEntitiesSynced(input: {
  tourIds?: string[];
  locationIds?: string[];
  assignmentIds?: string[];
  logIds?: string[];
}): Promise<void> {
  const database = await getDB();
  const mark = async (table: string, ids: string[]) => {
    if (!ids.length) return;
    const placeholders = ids.map(() => '?').join(', ');
    await database.runAsync(`UPDATE ${table} SET synced = 1 WHERE id IN (${placeholders})`, ids);
  };
  await mark('tours', input.tourIds ?? []);
  await mark('tour_locations', input.locationIds ?? []);
  await mark('material_assignments', input.assignmentIds ?? []);
  await mark('activity_logs', input.logIds ?? []);
}

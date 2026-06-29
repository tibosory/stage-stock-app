import type { Consommable, Materiel } from '../types';
import { generateId, getDB } from './database';
import { categoryPathById, getCategories } from './catalogDb';
import { shouldAlertVgp } from '../lib/vgp';

function materielInsertSqlAndParams(
  data: Omit<Materiel, 'id' | 'created_at' | 'updated_at' | 'synced'>,
  id: string,
  now: string
): { sql: string; params: (string | number | null)[] } {
  const qrCode = data.qr_code?.trim() || id;
  const vgpEpi = data.vgp_epi === 1 || data.vgp_epi === true ? 1 : 0;
  const gelInstead = data.gel_instead_of_photo === 1 || data.gel_instead_of_photo === true ? 1 : 0;
  const gelBrand = data.gel_brand === 'lee' || data.gel_brand === 'rosco' ? data.gel_brand : null;
  const gelCode = gelBrand && data.gel_code?.trim() ? data.gel_code.trim() : null;
  const technicalData =
    typeof data.technical_data === 'string'
      ? data.technical_data
      : data.technical_data != null
        ? JSON.stringify(data.technical_data)
        : null;
  const gestionLot = data.gestion_lot === 1 || data.gestion_lot === true ? 1 : 0;
  const stockActuel =
    data.stock_actuel != null && Number.isFinite(Number(data.stock_actuel))
      ? Math.max(0, Math.floor(Number(data.stock_actuel)))
      : gestionLot
        ? 0
        : 1;
  const unite = data.unite?.trim() || 'pièce';
  const seuilMin =
    data.seuil_minimum != null && Number.isFinite(Number(data.seuil_minimum))
      ? Math.max(0, Math.floor(Number(data.seuil_minimum)))
      : 0;
  const params: (string | number | null)[] = [
    id,
    data.nom,
    data.type ?? null,
    data.marque ?? null,
    data.numero_serie ?? null,
    data.poids_kg ?? null,
    data.categorie_id ?? null,
    data.localisation_id ?? null,
    data.flightcase?.trim() || null,
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
    gestionLot,
    stockActuel,
    unite,
    seuilMin,
    now,
    now,
  ];
  if (params.length !== 43) {
    throw new Error(`insert materiel: 43 parametres attendus, ${params.length} fournis`);
  }
  const placeholders = Array(43).fill('?').join(', ');
  const sql = `
    INSERT INTO materiels (id, nom, type, marque, numero_serie, poids_kg, categorie_id, localisation_id, flightcase,
      etat, statut, date_achat, date_validite, prochain_controle, intervalle_controle_jours,
      maintenance_todo, maintenance_last_comment,
      technicien, qr_code, nfc_tag_id, photo_url, photo_local,
      notice_pdf_local, notice_photo_local, notice_pdf_url, notice_photo_url,
      vgp_actif, vgp_periodicite_jours, vgp_derniere_visite, vgp_libelle, vgp_epi,
      gel_brand, gel_code, gel_instead_of_photo,
      technical_data,
      profile_id, profile_version,
      gestion_lot, stock_actuel, unite, seuil_minimum,
      created_at, updated_at, synced)
    VALUES (${placeholders}, 0)`;
  return { sql, params };
}

function consommableInsertSqlAndParams(
  data: Omit<Consommable, 'id' | 'created_at' | 'updated_at' | 'synced'>,
  id: string,
  now: string
): { sql: string; params: (string | number | null)[] } {
  const qrCode = data.qr_code?.trim() || id;
  const gelInstead = data.gel_instead_of_photo === 1 || data.gel_instead_of_photo === true ? 1 : 0;
  const gelBrand = data.gel_brand === 'lee' || data.gel_brand === 'rosco' ? data.gel_brand : null;
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
    throw new Error(`insert consommable: 19 parametres attendus, ${params.length} fournis`);
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

export async function getMateriel(): Promise<Materiel[]> {
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
}

export async function getMaterielById(id: string): Promise<Materiel | null> {
  const database = await getDB();
  const row = await database.getFirstAsync<any>(
    'SELECT * FROM materiels WHERE id = ?',
    [id]
  );
  return row ? { ...row, synced: !!row.synced } : null;
}

export async function getConsommables(): Promise<Consommable[]> {
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
}

export async function getConsommableById(id: string): Promise<Consommable | null> {
  const database = await getDB();
  const row = await database.getFirstAsync<any>('SELECT * FROM consommables WHERE id = ?', [id]);
  return row ? { ...row, synced: !!row.synced } : null;
}

export async function getConsommablesAlerte(): Promise<Consommable[]> {
  const database = await getDB();
  const rows = await database.getAllAsync<any>(
    'SELECT * FROM consommables WHERE stock_actuel <= seuil_minimum ORDER BY stock_actuel ASC'
  );
  return rows.map(r => ({ ...r, synced: !!r.synced }));
}

export async function getMaterielsPourVgpAlertes(fenetreJours: number = 30): Promise<Materiel[]> {
  const mats = await getMateriel();
  return mats.filter(m => shouldAlertVgp(m, fenetreJours));
}

export async function getMaterielsPourMaintenanceAlertes(fenetreJours: number = 30): Promise<Materiel[]> {
  const mats = await getMateriel();
  const limit = new Date();
  limit.setDate(limit.getDate() + fenetreJours);
  const limitStr = limit.toISOString().split('T')[0];
  return mats.filter(m => {
    const intervalle = Number(m.intervalle_controle_jours ?? 0);
    if (!Number.isFinite(intervalle) || intervalle <= 0) return false;
    const last = (m.prochain_controle ?? '').trim();
    if (!last) return true;
    const base = new Date(`${last}T12:00:00`);
    if (Number.isNaN(base.getTime())) return true;
    base.setDate(base.getDate() + intervalle);
    const dueStr = base.toISOString().split('T')[0];
    return dueStr <= limitStr;
  });
}

export async function insertMateriel(
  data: Omit<Materiel, 'id' | 'created_at' | 'updated_at' | 'synced'>
): Promise<string> {
  const database = await getDB();
  const id = generateId();
  const now = new Date().toISOString();
  const { sql, params } = materielInsertSqlAndParams(data, id, now);
  await database.runAsync(sql, params);
  return id;
}

export async function insertConsommable(
  data: Omit<Consommable, 'id' | 'created_at' | 'updated_at' | 'synced'>
): Promise<string> {
  const database = await getDB();
  const id = generateId();
  const now = new Date().toISOString();
  const { sql, params } = consommableInsertSqlAndParams(data, id, now);
  await database.runAsync(sql, params);
  return id;
}

export async function updateMateriel(id: string, data: Partial<Materiel>): Promise<void> {
  const database = await getDB();
  const now = new Date().toISOString();
  const existing = await database.getFirstAsync<{
    statut: string | null;
    tracking_state: string | null;
    current_tour_id: string | null;
  }>('SELECT statut, tracking_state, current_tour_id FROM materiels WHERE id = ?', [id]);
  if (!existing) return;

  const sanitized: Partial<Materiel> = { ...data };
  /**
   * Règle métier : quand un objet est rattaché à une tournée, le statut ne doit pas
   * être modifié hors flux tournée.
   */
  if (
    existing.tracking_state === 'in_tour' &&
    sanitized.statut !== undefined &&
    sanitized.statut !== (existing.statut as Materiel['statut'])
  ) {
    delete sanitized.statut;
  }

  const fields = Object.keys(sanitized).filter(k => !['id', 'created_at', 'synced'].includes(k));
  if (fields.length === 0) return;
  const setClause = [...fields.map(f => `${f} = ?`), 'updated_at = ?', 'synced = 0'].join(', ');
  const values = [
    ...fields.map(f => {
      const v = (sanitized as any)[f];
      if (f === 'technical_data' && v && typeof v === 'object') {
        return JSON.stringify(v);
      }
      return v;
    }),
    now,
    id,
  ];
  await database.runAsync(`UPDATE materiels SET ${setClause} WHERE id = ?`, values);
}

export async function updateConsommable(id: string, data: Partial<Consommable>): Promise<void> {
  const database = await getDB();
  const now = new Date().toISOString();
  const fields = Object.keys(data).filter(k => !['id', 'created_at', 'synced'].includes(k));
  const setClause = [...fields.map(f => `${f} = ?`), 'updated_at = ?', 'synced = 0'].join(', ');
  const values = [...fields.map(f => (data as any)[f]), now, id];
  await database.runAsync(`UPDATE consommables SET ${setClause} WHERE id = ?`, values);
}

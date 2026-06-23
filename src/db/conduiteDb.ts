import type { Conduite, DepartementConduite, LocalisationTop, Top, TypeTop } from '../types';
import { generateId, getDB } from './database';

// ── Mappers SQL → modèle ─────────────────────────────────────

function mapConduiteRow(r: any): Conduite {
  return {
    id: r.id,
    nomSpectacle: r.nom_spectacle,
    tourId: r.tour_id ?? null,
    titre: r.titre,
    departement: r.departement as DepartementConduite,
    notes: r.notes ?? null,
    topsCount: r.tops_count != null ? Number(r.tops_count) : undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    synced: !!r.synced,
  };
}

function mapTopRow(r: any): Top {
  return {
    id: r.id,
    conduiteId: r.conduite_id,
    numero: Number(r.numero ?? 0),
    minutage: r.minutage ?? null,
    minutageSecondes: r.minutage_secondes != null ? Number(r.minutage_secondes) : null,
    departement: r.departement as TypeTop,
    description: r.description,
    detail: r.detail ?? null,
    localisation: (r.localisation as LocalisationTop | null) ?? null,
    action: r.action ?? null,
    repere: r.repere ?? null,
    effectue: !!r.effectue,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    synced: !!r.synced,
  };
}

// ── Minutage ─────────────────────────────────────────────────

/** Convertit « mm:ss » en secondes (null si format invalide). */
export function minutageEnSecondes(minutage: string): number | null {
  const match = minutage.trim().match(/^(\d{1,3}):([0-5]?\d)$/);
  if (!match) return null;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

/** Convertit des secondes en « mm:ss » pour l’affichage. */
export function secondesEnMinutage(secondes: number): string {
  const total = Math.max(0, Math.floor(secondes));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ── Conduites ────────────────────────────────────────────────

export async function listConduites(departement?: DepartementConduite): Promise<Conduite[]> {
  const database = await getDB();
  const base = `
    SELECT c.*, (SELECT COUNT(*) FROM tops t WHERE t.conduite_id = c.id) AS tops_count
    FROM conduites c`;
  if (departement) {
    const rows = await database.getAllAsync<any>(
      `${base} WHERE c.departement = ? ORDER BY c.created_at DESC`,
      [departement]
    );
    return rows.map(mapConduiteRow);
  }
  const rows = await database.getAllAsync<any>(`${base} ORDER BY c.created_at DESC`);
  return rows.map(mapConduiteRow);
}

export async function getConduite(id: string): Promise<Conduite | null> {
  const database = await getDB();
  const row = await database.getFirstAsync<any>('SELECT * FROM conduites WHERE id = ?', [id]);
  return row ? mapConduiteRow(row) : null;
}

export async function createConduite(input: {
  nomSpectacle: string;
  titre: string;
  departement: DepartementConduite;
  tourId?: string | null;
  notes?: string | null;
}): Promise<Conduite> {
  const database = await getDB();
  const now = new Date().toISOString();
  const id = generateId();
  await database.runAsync(
    `INSERT INTO conduites (id, nom_spectacle, tour_id, titre, departement, notes, created_at, updated_at, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      id,
      input.nomSpectacle.trim(),
      input.tourId ?? null,
      input.titre.trim(),
      input.departement,
      input.notes?.trim() || null,
      now,
      now,
    ]
  );
  const row = await database.getFirstAsync<any>('SELECT * FROM conduites WHERE id = ?', [id]);
  return mapConduiteRow(row);
}

export async function updateConduite(
  id: string,
  input: {
    nomSpectacle?: string;
    titre?: string;
    departement?: DepartementConduite;
    notes?: string | null;
  }
): Promise<Conduite> {
  const database = await getDB();
  const existing = await getConduite(id);
  if (!existing) throw new Error('Conduite introuvable.');
  const now = new Date().toISOString();
  const nomSpectacle = input.nomSpectacle !== undefined ? input.nomSpectacle.trim() : existing.nomSpectacle;
  const titre = input.titre !== undefined ? input.titre.trim() : existing.titre;
  if (!nomSpectacle || !titre) throw new Error('Le spectacle et le titre sont obligatoires.');
  const departement = input.departement ?? existing.departement;
  const notes = input.notes !== undefined ? input.notes?.trim() || null : existing.notes;
  await database.runAsync(
    `UPDATE conduites SET nom_spectacle = ?, titre = ?, departement = ?, notes = ?, updated_at = ?, synced = 0 WHERE id = ?`,
    [nomSpectacle, titre, departement, notes, now, id]
  );
  const row = await database.getFirstAsync<any>('SELECT * FROM conduites WHERE id = ?', [id]);
  return mapConduiteRow(row);
}

export async function deleteConduite(id: string): Promise<void> {
  const database = await getDB();
  await database.runAsync('DELETE FROM conduites WHERE id = ?', [id]);
}

/** Duplique une conduite entière (tops inclus, remis à « non effectué ») comme modèle. */
export async function dupliquerConduite(input: {
  conduiteId: string;
  nouveauTitre: string;
  nouveauSpectacle: string;
}): Promise<Conduite> {
  const database = await getDB();
  const source = await getConduite(input.conduiteId);
  if (!source) throw new Error('Conduite source introuvable.');
  const now = new Date().toISOString();
  const newId = generateId();
  await database.runAsync(
    `INSERT INTO conduites (id, nom_spectacle, tour_id, titre, departement, notes, created_at, updated_at, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      newId,
      input.nouveauSpectacle.trim() || source.nomSpectacle,
      source.tourId,
      input.nouveauTitre.trim() || `${source.titre} (copie)`,
      source.departement,
      source.notes,
      now,
      now,
    ]
  );
  const tops = await listTops(input.conduiteId);
  for (const t of tops) {
    const topId = generateId();
    await database.runAsync(
      `INSERT INTO tops (id, conduite_id, numero, minutage, minutage_secondes, departement, description, detail, localisation, action, repere, effectue, created_at, updated_at, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 0)`,
      [
        topId,
        newId,
        t.numero,
        t.minutage,
        t.minutageSecondes,
        t.departement,
        t.description,
        t.detail,
        t.localisation,
        t.action,
        t.repere,
        now,
        now,
      ]
    );
  }
  const row = await database.getFirstAsync<any>('SELECT * FROM conduites WHERE id = ?', [newId]);
  return mapConduiteRow(row);
}

// ── Tops ─────────────────────────────────────────────────────

export async function listTops(conduiteId: string): Promise<Top[]> {
  const database = await getDB();
  const rows = await database.getAllAsync<any>(
    'SELECT * FROM tops WHERE conduite_id = ? ORDER BY numero ASC, created_at ASC',
    [conduiteId]
  );
  return rows.map(mapTopRow);
}

/** Prochain numéro libre pour un nouveau top. */
export async function nextTopNumero(conduiteId: string): Promise<number> {
  const database = await getDB();
  const row = await database.getFirstAsync<{ m: number | null }>(
    'SELECT MAX(numero) AS m FROM tops WHERE conduite_id = ?',
    [conduiteId]
  );
  return Number(row?.m ?? 0) + 1;
}

export async function addTop(input: {
  conduiteId: string;
  numero: number;
  minutage?: string | null;
  departement: TypeTop;
  description: string;
  detail?: string | null;
  localisation?: LocalisationTop | null;
  action?: string | null;
  repere?: string | null;
}): Promise<Top> {
  const database = await getDB();
  const now = new Date().toISOString();
  const id = generateId();
  const minutage = input.minutage?.trim() || null;
  const minutageSecondes = minutage ? minutageEnSecondes(minutage) : null;
  await database.runAsync(
    `INSERT INTO tops (id, conduite_id, numero, minutage, minutage_secondes, departement, description, detail, localisation, action, repere, effectue, created_at, updated_at, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 0)`,
    [
      id,
      input.conduiteId,
      input.numero,
      minutage,
      minutageSecondes,
      input.departement,
      input.description.trim(),
      input.detail?.trim() || null,
      input.localisation ?? null,
      input.action?.trim() || null,
      input.repere?.trim() || null,
      now,
      now,
    ]
  );
  const row = await database.getFirstAsync<any>('SELECT * FROM tops WHERE id = ?', [id]);
  return mapTopRow(row);
}

export async function updateTop(
  id: string,
  input: {
    numero?: number;
    minutage?: string | null;
    departement?: TypeTop;
    description?: string;
    detail?: string | null;
    localisation?: LocalisationTop | null;
    action?: string | null;
    repere?: string | null;
  }
): Promise<Top> {
  const database = await getDB();
  const row0 = await database.getFirstAsync<any>('SELECT * FROM tops WHERE id = ?', [id]);
  if (!row0) throw new Error('Top introuvable.');
  const existing = mapTopRow(row0);
  const now = new Date().toISOString();
  const numero = input.numero ?? existing.numero;
  const minutage = input.minutage !== undefined ? input.minutage?.trim() || null : existing.minutage;
  const minutageSecondes = minutage ? minutageEnSecondes(minutage) : null;
  const departement = input.departement ?? existing.departement;
  const description = input.description !== undefined ? input.description.trim() : existing.description;
  if (!description) throw new Error('La description est obligatoire.');
  const detail = input.detail !== undefined ? input.detail?.trim() || null : existing.detail;
  const localisation = input.localisation !== undefined ? input.localisation : existing.localisation;
  const action = input.action !== undefined ? input.action?.trim() || null : existing.action;
  const repere = input.repere !== undefined ? input.repere?.trim() || null : existing.repere;
  await database.runAsync(
    `UPDATE tops SET numero = ?, minutage = ?, minutage_secondes = ?, departement = ?, description = ?, detail = ?, localisation = ?, action = ?, repere = ?, updated_at = ?, synced = 0 WHERE id = ?`,
    [numero, minutage, minutageSecondes, departement, description, detail, localisation, action, repere, now, id]
  );
  const row = await database.getFirstAsync<any>('SELECT * FROM tops WHERE id = ?', [id]);
  return mapTopRow(row);
}

export async function deleteTop(id: string): Promise<void> {
  const database = await getDB();
  await database.runAsync('DELETE FROM tops WHERE id = ?', [id]);
}

/** Marque un top effectué ou non (mode live, sauvegarde immédiate). */
export async function toggleTopEffectue(id: string, effectue: boolean): Promise<void> {
  const database = await getDB();
  const now = new Date().toISOString();
  await database.runAsync('UPDATE tops SET effectue = ?, updated_at = ?, synced = 0 WHERE id = ?', [
    effectue ? 1 : 0,
    now,
    id,
  ]);
}

/** Réinitialise tous les tops d’une conduite avant un nouveau live. */
export async function resetTopsEffectues(conduiteId: string): Promise<void> {
  const database = await getDB();
  const now = new Date().toISOString();
  await database.runAsync(
    'UPDATE tops SET effectue = 0, updated_at = ?, synced = 0 WHERE conduite_id = ?',
    [now, conduiteId]
  );
}

/** Renumérote les tops après réorganisation. */
export async function renumeroterTops(tops: { id: string; numero: number }[]): Promise<void> {
  const database = await getDB();
  const now = new Date().toISOString();
  for (const t of tops) {
    await database.runAsync('UPDATE tops SET numero = ?, updated_at = ?, synced = 0 WHERE id = ?', [
      t.numero,
      now,
      t.id,
    ]);
  }
}

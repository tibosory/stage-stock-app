import type { Etape, MiseTechnique, Position, PositionPhoto, ZoneScene } from '../types';
import { generateId, getDB } from './database';
import { removePositionPhotoLocal } from '../lib/miseTechniquePhotoStorage';

// ── Mappers SQL → modèle ─────────────────────────────────────

function mapMiseRow(r: any): MiseTechnique {
  return {
    id: r.id,
    nomSpectacle: r.nom_spectacle,
    tourId: r.tour_id ?? null,
    titre: r.titre,
    notes: r.notes ?? null,
    etapesCount: r.etapes_count != null ? Number(r.etapes_count) : undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    synced: !!r.synced,
  };
}

function mapEtapeRow(r: any): Etape {
  return {
    id: r.id,
    miseTechniqueId: r.mise_technique_id,
    ordre: Number(r.ordre ?? 0),
    nom: r.nom,
    description: r.description ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    synced: !!r.synced,
  };
}

function mapPositionRow(r: any): Position {
  return {
    id: r.id,
    etapeId: r.etape_id,
    materielId: r.materiel_id ?? null,
    nomObjet: r.nom_objet,
    descriptionEmplacement: r.description_emplacement,
    zone: (r.zone ?? 'non_definie') as ZoneScene,
    notes: r.notes ?? null,
    ordre: Number(r.ordre ?? 0),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    synced: !!r.synced,
  };
}

function mapPhotoRow(r: any): PositionPhoto {
  return {
    id: r.id,
    positionId: r.position_id,
    localUri: r.local_uri,
    ordre: Number(r.ordre ?? 0),
    createdAt: r.created_at,
  };
}

// ── Mises techniques ─────────────────────────────────────────

export async function listMisesTechniques(): Promise<MiseTechnique[]> {
  const database = await getDB();
  const rows = await database.getAllAsync<any>(
    `SELECT m.*, (SELECT COUNT(*) FROM etapes e WHERE e.mise_technique_id = m.id) AS etapes_count
     FROM mises_techniques m ORDER BY m.created_at DESC`
  );
  return rows.map(mapMiseRow);
}

export async function getMiseTechnique(id: string): Promise<MiseTechnique | null> {
  const database = await getDB();
  const row = await database.getFirstAsync<any>('SELECT * FROM mises_techniques WHERE id = ?', [id]);
  return row ? mapMiseRow(row) : null;
}

export async function createMiseTechnique(input: {
  nomSpectacle: string;
  titre: string;
  tourId?: string | null;
  notes?: string | null;
}): Promise<MiseTechnique> {
  const database = await getDB();
  const now = new Date().toISOString();
  const id = generateId();
  await database.runAsync(
    `INSERT INTO mises_techniques (id, nom_spectacle, tour_id, titre, notes, created_at, updated_at, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
    [id, input.nomSpectacle.trim(), input.tourId ?? null, input.titre.trim(), input.notes?.trim() || null, now, now]
  );
  const row = await database.getFirstAsync<any>('SELECT * FROM mises_techniques WHERE id = ?', [id]);
  return mapMiseRow(row);
}

export async function updateMiseTechnique(
  id: string,
  input: { nomSpectacle?: string; titre?: string; notes?: string | null }
): Promise<MiseTechnique> {
  const database = await getDB();
  const existing = await getMiseTechnique(id);
  if (!existing) throw new Error('Mise technique introuvable.');
  const now = new Date().toISOString();
  const nomSpectacle = input.nomSpectacle !== undefined ? input.nomSpectacle.trim() : existing.nomSpectacle;
  const titre = input.titre !== undefined ? input.titre.trim() : existing.titre;
  if (!nomSpectacle || !titre) throw new Error('Le spectacle et le titre sont obligatoires.');
  const notes = input.notes !== undefined ? input.notes?.trim() || null : existing.notes;
  await database.runAsync(
    `UPDATE mises_techniques SET nom_spectacle = ?, titre = ?, notes = ?, updated_at = ?, synced = 0 WHERE id = ?`,
    [nomSpectacle, titre, notes, now, id]
  );
  const row = await database.getFirstAsync<any>('SELECT * FROM mises_techniques WHERE id = ?', [id]);
  return mapMiseRow(row);
}

/** Supprime une mise technique, ses étapes/positions (cascade SQL) et les fichiers photos locaux. */
export async function deleteMiseTechnique(id: string): Promise<void> {
  const database = await getDB();
  const photos = await database.getAllAsync<{ local_uri: string | null }>(
    `SELECT pp.local_uri FROM position_photos pp
     JOIN positions p ON p.id = pp.position_id
     JOIN etapes e ON e.id = p.etape_id
     WHERE e.mise_technique_id = ?`,
    [id]
  );
  await database.runAsync('DELETE FROM mises_techniques WHERE id = ?', [id]);
  for (const p of photos) await removePositionPhotoLocal(p.local_uri);
}

// ── Étapes ───────────────────────────────────────────────────

export async function listEtapes(miseTechniqueId: string): Promise<Etape[]> {
  const database = await getDB();
  const rows = await database.getAllAsync<any>(
    'SELECT * FROM etapes WHERE mise_technique_id = ? ORDER BY ordre ASC, created_at ASC',
    [miseTechniqueId]
  );
  return rows.map(mapEtapeRow);
}

async function nextEtapeOrdre(miseTechniqueId: string): Promise<number> {
  const database = await getDB();
  const row = await database.getFirstAsync<{ m: number | null }>(
    'SELECT MAX(ordre) AS m FROM etapes WHERE mise_technique_id = ?',
    [miseTechniqueId]
  );
  return Number(row?.m ?? 0) + 1;
}

export async function createEtape(input: {
  miseTechniqueId: string;
  nom: string;
  description?: string | null;
  ordre?: number;
}): Promise<Etape> {
  const database = await getDB();
  const now = new Date().toISOString();
  const id = generateId();
  const ordre = input.ordre ?? (await nextEtapeOrdre(input.miseTechniqueId));
  await database.runAsync(
    `INSERT INTO etapes (id, mise_technique_id, ordre, nom, description, created_at, updated_at, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
    [id, input.miseTechniqueId, ordre, input.nom.trim(), input.description?.trim() || null, now, now]
  );
  const row = await database.getFirstAsync<any>('SELECT * FROM etapes WHERE id = ?', [id]);
  return mapEtapeRow(row);
}

export async function updateEtape(
  id: string,
  input: { nom?: string; description?: string | null; ordre?: number }
): Promise<Etape> {
  const database = await getDB();
  const row0 = await database.getFirstAsync<any>('SELECT * FROM etapes WHERE id = ?', [id]);
  if (!row0) throw new Error('Étape introuvable.');
  const existing = mapEtapeRow(row0);
  const now = new Date().toISOString();
  const nom = input.nom !== undefined ? input.nom.trim() : existing.nom;
  if (!nom) throw new Error('Le nom de l’étape est obligatoire.');
  const description = input.description !== undefined ? input.description?.trim() || null : existing.description;
  const ordre = input.ordre ?? existing.ordre;
  await database.runAsync(
    `UPDATE etapes SET nom = ?, description = ?, ordre = ?, updated_at = ?, synced = 0 WHERE id = ?`,
    [nom, description, ordre, now, id]
  );
  const row = await database.getFirstAsync<any>('SELECT * FROM etapes WHERE id = ?', [id]);
  return mapEtapeRow(row);
}

export async function deleteEtape(id: string): Promise<void> {
  const database = await getDB();
  const photos = await database.getAllAsync<{ local_uri: string | null }>(
    `SELECT pp.local_uri FROM position_photos pp
     JOIN positions p ON p.id = pp.position_id
     WHERE p.etape_id = ?`,
    [id]
  );
  await database.runAsync('DELETE FROM etapes WHERE id = ?', [id]);
  for (const p of photos) await removePositionPhotoLocal(p.local_uri);
}

/** Duplique une étape avec ses positions (sans les photos). */
export async function dupliquerEtape(input: { etapeId: string; nouveauNom: string }): Promise<Etape> {
  const database = await getDB();
  const row0 = await database.getFirstAsync<any>('SELECT * FROM etapes WHERE id = ?', [input.etapeId]);
  if (!row0) throw new Error('Étape source introuvable.');
  const source = mapEtapeRow(row0);
  const newEtape = await createEtape({
    miseTechniqueId: source.miseTechniqueId,
    nom: input.nouveauNom.trim() || `${source.nom} (copie)`,
    description: source.description,
  });
  const positions = await listPositions(source.id);
  for (const p of positions) {
    await createPosition({
      etapeId: newEtape.id,
      materielId: p.materielId,
      nomObjet: p.nomObjet,
      descriptionEmplacement: p.descriptionEmplacement,
      zone: p.zone,
      notes: p.notes,
      ordre: p.ordre,
    });
  }
  return newEtape;
}

// ── Positions ────────────────────────────────────────────────

export async function listPositions(etapeId: string): Promise<Position[]> {
  const database = await getDB();
  const rows = await database.getAllAsync<any>(
    'SELECT * FROM positions WHERE etape_id = ? ORDER BY ordre ASC, created_at ASC',
    [etapeId]
  );
  const positions = rows.map(mapPositionRow);
  for (const pos of positions) {
    pos.photos = await listPositionPhotos(pos.id);
  }
  return positions;
}

export async function createPosition(input: {
  etapeId: string;
  materielId?: string | null;
  nomObjet: string;
  descriptionEmplacement: string;
  zone?: ZoneScene;
  notes?: string | null;
  ordre?: number;
}): Promise<Position> {
  const database = await getDB();
  const now = new Date().toISOString();
  const id = generateId();
  await database.runAsync(
    `INSERT INTO positions (id, etape_id, materiel_id, nom_objet, description_emplacement, zone, notes, ordre, created_at, updated_at, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      id,
      input.etapeId,
      input.materielId ?? null,
      input.nomObjet.trim(),
      input.descriptionEmplacement.trim(),
      input.zone ?? 'non_definie',
      input.notes?.trim() || null,
      input.ordre ?? 0,
      now,
      now,
    ]
  );
  const row = await database.getFirstAsync<any>('SELECT * FROM positions WHERE id = ?', [id]);
  return mapPositionRow(row);
}

export async function updatePosition(
  id: string,
  input: {
    materielId?: string | null;
    nomObjet?: string;
    descriptionEmplacement?: string;
    zone?: ZoneScene;
    notes?: string | null;
  }
): Promise<Position> {
  const database = await getDB();
  const row0 = await database.getFirstAsync<any>('SELECT * FROM positions WHERE id = ?', [id]);
  if (!row0) throw new Error('Position introuvable.');
  const existing = mapPositionRow(row0);
  const now = new Date().toISOString();
  const materielId = input.materielId !== undefined ? input.materielId : existing.materielId;
  const nomObjet = input.nomObjet !== undefined ? input.nomObjet.trim() : existing.nomObjet;
  const descriptionEmplacement =
    input.descriptionEmplacement !== undefined ? input.descriptionEmplacement.trim() : existing.descriptionEmplacement;
  if (!nomObjet || !descriptionEmplacement) {
    throw new Error('L’objet et l’emplacement sont obligatoires.');
  }
  const zone = input.zone ?? existing.zone;
  const notes = input.notes !== undefined ? input.notes?.trim() || null : existing.notes;
  await database.runAsync(
    `UPDATE positions SET materiel_id = ?, nom_objet = ?, description_emplacement = ?, zone = ?, notes = ?, updated_at = ?, synced = 0 WHERE id = ?`,
    [materielId, nomObjet, descriptionEmplacement, zone, notes, now, id]
  );
  const row = await database.getFirstAsync<any>('SELECT * FROM positions WHERE id = ?', [id]);
  return mapPositionRow(row);
}

export async function deletePosition(id: string): Promise<void> {
  const database = await getDB();
  const photos = await listPositionPhotos(id);
  await database.runAsync('DELETE FROM positions WHERE id = ?', [id]);
  for (const p of photos) await removePositionPhotoLocal(p.localUri);
}

/** Matériels du stock pour le sélecteur de liaison (id + nom). */
export async function getMaterielsPourLiaison(): Promise<{ id: string; nom: string }[]> {
  const database = await getDB();
  const rows = await database.getAllAsync<{ id: string; nom: string }>(
    'SELECT id, nom FROM materiels ORDER BY nom ASC LIMIT 1000'
  );
  return rows ?? [];
}

// ── Photos ───────────────────────────────────────────────────

export async function listPositionPhotos(positionId: string): Promise<PositionPhoto[]> {
  const database = await getDB();
  const rows = await database.getAllAsync<any>(
    'SELECT * FROM position_photos WHERE position_id = ? ORDER BY ordre ASC, created_at ASC',
    [positionId]
  );
  return rows.map(mapPhotoRow);
}

export async function addPositionPhoto(positionId: string, localUri: string): Promise<PositionPhoto> {
  const database = await getDB();
  const now = new Date().toISOString();
  const id = generateId();
  await database.runAsync(
    `INSERT INTO position_photos (id, position_id, local_uri, ordre, created_at) VALUES (?, ?, ?, 0, ?)`,
    [id, positionId, localUri, now]
  );
  const row = await database.getFirstAsync<any>('SELECT * FROM position_photos WHERE id = ?', [id]);
  return mapPhotoRow(row);
}

export async function deletePositionPhoto(photoId: string): Promise<void> {
  const database = await getDB();
  const row = await database.getFirstAsync<any>('SELECT * FROM position_photos WHERE id = ?', [photoId]);
  if (!row) return;
  await database.runAsync('DELETE FROM position_photos WHERE id = ?', [photoId]);
  await removePositionPhotoLocal(row.local_uri);
}

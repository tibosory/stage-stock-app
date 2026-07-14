import type { Categorie, Lieu, Localisation } from '../types';
import { materializeCapiLieuxIntoInventoryCatalog } from '../lib/capiLieuxCatalog';
import { generateId, getDB } from './database';

/** Chaine "parent › enfant › feuille" pour affichage / listes deroulantes. */
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

export async function getCategories(): Promise<Categorie[]> {
  const database = await getDB();
  const rows = await database.getAllAsync<Categorie>('SELECT * FROM categories ORDER BY nom ASC');
  return rows.map(r => ({
    ...r,
    parent_id: r.parent_id ?? null,
  }));
}

/** Nouvelle categorie ; `parentId` optionnel pour une sous-categorie. */
export async function insertCategorie(nom: string, parentId?: string | null): Promise<string> {
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
}

export async function deleteCategorie(id: string): Promise<void> {
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
}

export async function getLieux(): Promise<Lieu[]> {
  const database = await getDB();
  await materializeCapiLieuxIntoInventoryCatalog(database);
  return database.getAllAsync<Lieu>('SELECT * FROM lieux ORDER BY nom COLLATE NOCASE ASC');
}

export async function getLocalisations(lieuId?: string | null): Promise<Localisation[]> {
  const database = await getDB();
  if (lieuId?.trim()) {
    return database.getAllAsync<Localisation>(
      'SELECT * FROM localisations WHERE lieu_id = ? ORDER BY nom ASC',
      [lieuId.trim()]
    );
  }
  return database.getAllAsync<Localisation>('SELECT * FROM localisations ORDER BY nom ASC');
}

/** Localisation fine dans un lieu (réserve, rack, atelier…). */
export async function insertLocalisation(nom: string, lieuId?: string | null): Promise<string> {
  const database = await getDB();
  const id = generateId();
  const now = new Date().toISOString();
  const lieu = lieuId?.trim() || null;
  if (lieu) {
    const exists = await database.getFirstAsync<{ id: string }>('SELECT id FROM lieux WHERE id = ?', [lieu]);
    if (!exists) throw new Error('Lieu introuvable.');
  }
  await database.runAsync(
    'INSERT INTO localisations (id, nom, lieu_id, created_at) VALUES (?, ?, ?, ?)',
    [id, nom.trim(), lieu, now]
  );
  return id;
}

export async function deleteLocalisation(id: string): Promise<void> {
  const database = await getDB();
  await database.runAsync('DELETE FROM localisations WHERE id = ?', [id]);
}

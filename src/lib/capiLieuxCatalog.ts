import type { Lieu } from '../types';

/** Libellé court du type de lieu CAPI (d’après l’identifiant stable). */
export function capiLieuKindLabel(lieuId: string): string | null {
  if (lieuId.startsWith('capi-lieu-salle:')) return 'Salle';
  if (lieuId.startsWith('capi-lieu-ext:')) return 'Extérieur';
  if (lieuId.startsWith('capi-adr-rec:')) return 'Adresse';
  if (lieuId.startsWith('capi-veh:')) return 'Véhicule';
  return null;
}

/** Libellé pour listes déroulantes stock / consommables. */
export function formatLieuPickerLabel(lieu: Pick<Lieu, 'id' | 'nom' | 'source'>): string {
  const kind = capiLieuKindLabel(lieu.id);
  const parts = [lieu.nom.trim()];
  if (kind) parts.push(kind);
  if (lieu.source === 'capi') parts.push('CAPI');
  return parts.join(' · ');
}

import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Alimente la table inventaire `lieux` depuis les catalogues CAPI synchronisés
 * (`ap_capi_lieu_refs`, `tour_lieu_refs`) pour que stock, consommables et paramètres
 * proposent les mêmes lieux que tournées et Accueil Pro.
 */
export async function materializeCapiLieuxIntoInventoryCatalog(database: SQLiteDatabase): Promise<number> {
  const nowIso = new Date().toISOString();
  let n = 0;

  const apRows = await database.getAllAsync<{
    id: string;
    nom: string;
    capi_ref: string;
    created_at?: string | null;
    updated_at?: string | null;
  }>(
    `SELECT id, nom, capi_ref, created_at, updated_at FROM ap_capi_lieu_refs WHERE nom IS NOT NULL AND TRIM(nom) != ''`,
  );

  for (const row of apRows) {
    await database.runAsync(
      `INSERT OR REPLACE INTO lieux (id, nom, source, capi_ref, created_at, updated_at)
       VALUES (?, ?, 'capi', ?, COALESCE((SELECT created_at FROM lieux WHERE id = ?), ?), ?)`,
      [row.id, row.nom.trim(), row.capi_ref, row.id, row.created_at ?? nowIso, row.updated_at ?? nowIso],
    );
    n += 1;
  }

  const tourRows = await database.getAllAsync<{
    id: string;
    nom: string;
    capi_ref: string;
    created_at?: string | null;
    updated_at?: string | null;
  }>(
    `SELECT id, nom, capi_ref, created_at, updated_at FROM tour_lieu_refs
     WHERE nom IS NOT NULL AND TRIM(nom) != ''
       AND id NOT IN (SELECT id FROM ap_capi_lieu_refs)`,
  );

  for (const row of tourRows) {
    await database.runAsync(
      `INSERT OR REPLACE INTO lieux (id, nom, source, capi_ref, created_at, updated_at)
       VALUES (?, ?, 'capi', ?, COALESCE((SELECT created_at FROM lieux WHERE id = ?), ?), ?)`,
      [row.id, row.nom.trim(), row.capi_ref, row.id, row.created_at ?? nowIso, row.updated_at ?? nowIso],
    );
    n += 1;
  }

  return n;
}

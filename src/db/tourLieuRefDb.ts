import type { TourLieuRef } from '../types';
import { getDB } from './database';

function mapRow(r: Record<string, unknown>): TourLieuRef {
  return {
    id: String(r.id),
    kind: r.kind as TourLieuRef['kind'],
    nom: String(r.nom),
    adresse: r.adresse != null ? String(r.adresse) : null,
    capiRef: String(r.capi_ref),
    createdAt: String(r.created_at ?? ''),
    updatedAt: String(r.updated_at ?? ''),
  };
}

export async function listTourLieuRefs(): Promise<TourLieuRef[]> {
  const database = await getDB();
  const rows = await database.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM tour_lieu_refs ORDER BY kind ASC, nom COLLATE NOCASE ASC',
  );
  return rows.map(mapRow);
}

export async function replaceTourLieuRefs(rows: TourLieuRef[]): Promise<void> {
  const database = await getDB();
  await database.runAsync('DELETE FROM tour_lieu_refs');
  for (const row of rows) {
    await database.runAsync(
      `INSERT OR REPLACE INTO tour_lieu_refs (id, kind, nom, adresse, capi_ref, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.kind,
        row.nom,
        row.adresse ?? null,
        row.capiRef,
        row.createdAt || new Date().toISOString(),
        row.updatedAt || new Date().toISOString(),
      ],
    );
  }
}

export async function getTourLieuRefById(id: string): Promise<TourLieuRef | null> {
  const database = await getDB();
  const row = await database.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM tour_lieu_refs WHERE id = ?',
    [id],
  );
  return row ? mapRow(row) : null;
}

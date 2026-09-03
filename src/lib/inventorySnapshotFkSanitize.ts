/**
 * Assainit les FK inventaire avant INSERT OR REPLACE (pull snapshot),
 * pour rester valide même si PRAGMA foreign_keys=ON.
 */
import type { InventoryReconcileDb } from './inventorySnapshotReconcile';

export function collectNonEmptyIds(rows: Record<string, unknown>[], col: string): Set<string> {
  const out = new Set<string>();
  for (const row of rows) {
    const v = row[col];
    if (v == null) continue;
    const s = String(v).trim();
    if (s) out.add(s);
  }
  return out;
}

export function nullifyOrphanRowFks(
  row: Record<string, unknown>,
  validCategoryIds: Set<string>,
  validLocalisationIds: Set<string>
): Record<string, unknown> {
  const next = { ...row };
  const cat = row.categorie_id != null ? String(row.categorie_id).trim() : '';
  const loc = row.localisation_id != null ? String(row.localisation_id).trim() : '';
  if (cat && !validCategoryIds.has(cat)) next.categorie_id = null;
  if (loc && !validLocalisationIds.has(loc)) next.localisation_id = null;
  return next;
}

export async function loadExistingIdSet(
  database: InventoryReconcileDb,
  table: 'categories' | 'localisations' | 'materiels' | 'prets'
): Promise<Set<string>> {
  const rows = await database.getAllAsync<{ id: string }>(`SELECT id FROM ${table}`);
  return new Set(rows.map(r => String(r.id)));
}

export function filterPretMaterielsByParents(
  rows: Record<string, unknown>[],
  validPretIds: Set<string>,
  validMaterielIds: Set<string>
): Record<string, unknown>[] {
  return rows.filter(pm => {
    const pretId = pm.pret_id != null ? String(pm.pret_id).trim() : '';
    const materielId = pm.materiel_id != null ? String(pm.materiel_id).trim() : '';
    return Boolean(pretId && materielId && validPretIds.has(pretId) && validMaterielIds.has(materielId));
  });
}

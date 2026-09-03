import type { Materiel } from '../types';

/** Même intitulé (hors casse / espaces) : on regroupe, sans tenir compte du n° de série, QR ou catégorie. */
export function normPretMaterielName(n: string): string {
  return n.trim().toLowerCase();
}

export type PretMaterielNameGroup = {
  key: string;
  displayName: string;
  ids: string[];
};

export function buildPretMaterielNameGroups(materiels: Materiel[]): PretMaterielNameGroup[] {
  const acc = new Map<string, { displayName: string; ids: string[] }>();
  for (const mat of materiels) {
    const key = normPretMaterielName(mat.nom);
    if (!key) continue;
    let e = acc.get(key);
    if (!e) {
      e = { displayName: (mat.nom || '').trim() || mat.nom, ids: [] };
      acc.set(key, e);
    }
    e.ids.push(mat.id);
  }
  for (const e of acc.values()) {
    e.ids.sort((a, b) => a.localeCompare(b));
  }
  return Array.from(acc.entries())
    .map(([key, v]) => ({ key, displayName: v.displayName, ids: v.ids }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'fr', { sensitivity: 'base' }));
}

export function expandPretNameQtyToIds(
  groups: PretMaterielNameGroup[],
  qty: Record<string, number>
): string[] {
  const out: string[] = [];
  for (const g of groups) {
    const n = Math.min(g.ids.length, Math.max(0, Math.floor(qty[g.key] ?? 0)));
    out.push(...g.ids.slice(0, n));
  }
  return out;
}

/** Pré-sélection par IDs scannés → quantités par nom normalisé (PretModal). */
export function buildQtyByNameKeyFromMaterielIds(
  materiels: Materiel[],
  ids: string[]
): Record<string, number> {
  const idSet = new Set(ids);
  const qty: Record<string, number> = {};
  for (const mat of materiels) {
    if (!idSet.has(mat.id)) continue;
    const key = normPretMaterielName(mat.nom);
    if (!key) continue;
    qty[key] = (qty[key] ?? 0) + 1;
  }
  return qty;
}

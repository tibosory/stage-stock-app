import type { Materiel } from '../types';
import { isMaterielGestionLot, materielLotUnite, materielStockActuel } from './materielLot';

/** Même intitulé (hors casse / espaces) : on regroupe, sans tenir compte du n° de série, QR ou catégorie. */
export function normPretMaterielName(n: string): string {
  return n.trim().toLowerCase();
}

export type PretMaterielNameGroup = {
  key: string;
  displayName: string;
  /** Unités : plusieurs fiches ; lot : un seul id. */
  ids: string[];
  /** Quantité max sélectionnable (nb de fiches unitaires ou stock lot − réservations). */
  available: number;
  isLot: boolean;
  unite?: string;
};

export type PretLigneQty = { materielId: string; quantite: number };

export function lotPretGroupKey(materielId: string): string {
  return `lot:${materielId}`;
}

/**
 * @param reservedByMaterielId quantités déjà posées sur d’autres demandes (« en demande »)
 *   — pour les lots uniquement ; les prêts en cours ont déjà décrémenté stock_actuel.
 */
export function buildPretMaterielNameGroups(
  materiels: Materiel[],
  reservedByMaterielId: Record<string, number> = {}
): PretMaterielNameGroup[] {
  const unitAcc = new Map<string, { displayName: string; ids: string[] }>();
  const lotGroups: PretMaterielNameGroup[] = [];

  for (const mat of materiels) {
    if (isMaterielGestionLot(mat)) {
      const stock = materielStockActuel(mat);
      const reserved = Math.max(0, Math.floor(Number(reservedByMaterielId[mat.id]) || 0));
      const available = Math.max(0, stock - reserved);
      if (available <= 0) continue;
      lotGroups.push({
        key: lotPretGroupKey(mat.id),
        displayName: (mat.nom || '').trim() || mat.nom,
        ids: [mat.id],
        available,
        isLot: true,
        unite: materielLotUnite(mat),
      });
      continue;
    }
    const key = normPretMaterielName(mat.nom);
    if (!key) continue;
    let e = unitAcc.get(key);
    if (!e) {
      e = { displayName: (mat.nom || '').trim() || mat.nom, ids: [] };
      unitAcc.set(key, e);
    }
    e.ids.push(mat.id);
  }

  for (const e of unitAcc.values()) {
    e.ids.sort((a, b) => a.localeCompare(b));
  }

  const unitGroups: PretMaterielNameGroup[] = Array.from(unitAcc.entries()).map(([key, v]) => ({
    key,
    displayName: v.displayName,
    ids: v.ids,
    available: v.ids.length,
    isLot: false,
  }));

  return [...unitGroups, ...lotGroups].sort((a, b) =>
    a.displayName.localeCompare(b.displayName, 'fr', { sensitivity: 'base' })
  );
}

/** @deprecated Préférer `expandPretNameQtyToLignes` (gère les lots à quantité > 1). */
export function expandPretNameQtyToIds(
  groups: PretMaterielNameGroup[],
  qty: Record<string, number>
): string[] {
  return expandPretNameQtyToLignes(groups, qty).flatMap(l =>
    Array.from({ length: l.quantite }, () => l.materielId)
  );
}

export function expandPretNameQtyToLignes(
  groups: PretMaterielNameGroup[],
  qty: Record<string, number>
): PretLigneQty[] {
  const out: PretLigneQty[] = [];
  for (const g of groups) {
    const n = Math.min(g.available, Math.max(0, Math.floor(qty[g.key] ?? 0)));
    if (n <= 0) continue;
    if (g.isLot) {
      out.push({ materielId: g.ids[0], quantite: n });
    } else {
      for (const id of g.ids.slice(0, n)) {
        out.push({ materielId: id, quantite: 1 });
      }
    }
  }
  return out;
}

/** Pré-sélection par IDs scannés → quantités par clé de groupe (PretModal). */
export function buildQtyByNameKeyFromMaterielIds(
  materiels: Materiel[],
  ids: string[]
): Record<string, number> {
  const idSet = new Set(ids);
  const qty: Record<string, number> = {};
  for (const mat of materiels) {
    if (!idSet.has(mat.id)) continue;
    if (isMaterielGestionLot(mat)) {
      const key = lotPretGroupKey(mat.id);
      qty[key] = Math.max(qty[key] ?? 0, 1);
      continue;
    }
    const key = normPretMaterielName(mat.nom);
    if (!key) continue;
    qty[key] = (qty[key] ?? 0) + 1;
  }
  return qty;
}

/** Quantités déjà sur une demande (lignes pret_materiels) → état du stepper. */
export function buildQtyByNameKeyFromPretLignes(
  groups: PretMaterielNameGroup[],
  lignes: { materiel_id: string; quantite?: number | null; materiel_nom?: string }[]
): Record<string, number> {
  const qty: Record<string, number> = {};
  for (const l of lignes) {
    const g = groups.find(x => x.ids.includes(l.materiel_id));
    if (!g) continue;
    const q = Math.max(1, Math.floor(Number(l.quantite) || 1));
    qty[g.key] = (qty[g.key] ?? 0) + q;
  }
  return qty;
}

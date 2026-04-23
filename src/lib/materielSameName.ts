import { Materiel } from '../types';

/** Clé de regroupement par libellé (casse / espaces en bord). */
export function normMaterielName(n: string): string {
  return n.trim().toLowerCase();
}

/**
 * Nombre de fiches « en stock » partageant le même nom affiché (S/N, QR, catégorie non pris en compte).
 */
export function countMaterielSameNameEnStock(materiels: Materiel[], ref: Materiel): number {
  const k = normMaterielName(ref.nom);
  if (!k) return 0;
  return materiels.filter(
    m => normMaterielName(m.nom) === k && m.statut === 'en stock'
  ).length;
}

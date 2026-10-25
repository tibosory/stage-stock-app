import type { Materiel } from '../types';
import { isMaterielGestionLot, materielStockActuel } from './materielLot';

export function isMaterielEligibleForPretScan(
  mat: Pick<Materiel, 'statut' | 'tracking_state' | 'gestion_lot' | 'stock_actuel' | 'nom'>
): boolean {
  const st = (mat.statut ?? '').trim().toLowerCase();
  if (st !== 'en stock') return false;
  if (mat.tracking_state === 'in_tour') return false;
  if (isMaterielGestionLot(mat) && materielStockActuel(mat) <= 0) return false;
  return true;
}

export function pretScanIneligibleReason(
  mat: Pick<Materiel, 'nom' | 'statut' | 'tracking_state' | 'gestion_lot' | 'stock_actuel'>
): string {
  if (mat.tracking_state === 'in_tour') {
    return `"${mat.nom}" est en tournée et ne peut pas être ajouté au prêt.`;
  }
  const st = (mat.statut ?? '').trim().toLowerCase();
  if (st !== 'en stock') {
    return `"${mat.nom}" n'est pas disponible (statut : ${mat.statut ?? 'inconnu'}).`;
  }
  if (isMaterielGestionLot(mat) && materielStockActuel(mat) <= 0) {
    return `"${mat.nom}" : stock à 0 — rien à prêter.`;
  }
  return `"${mat.nom}" ne peut pas être ajouté au prêt.`;
}

/** Quantité max prêtabile pour un scan (1 pour pièce unitaire, stock pour lot). */
export function pretScanMaxQuantite(
  mat: Pick<Materiel, 'gestion_lot' | 'stock_actuel'>
): number {
  if (isMaterielGestionLot(mat)) {
    return Math.max(0, materielStockActuel(mat));
  }
  return 1;
}

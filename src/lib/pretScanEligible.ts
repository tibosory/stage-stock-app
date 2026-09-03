import type { Materiel } from '../types';

export function isMaterielEligibleForPretScan(mat: Pick<Materiel, 'statut' | 'tracking_state'>): boolean {
  const st = (mat.statut ?? '').trim().toLowerCase();
  if (st !== 'en stock') return false;
  if (mat.tracking_state === 'in_tour') return false;
  return true;
}

export function pretScanIneligibleReason(
  mat: Pick<Materiel, 'nom' | 'statut' | 'tracking_state'>
): string {
  if (mat.tracking_state === 'in_tour') {
    return `"${mat.nom}" est en tournée et ne peut pas être ajouté au prêt.`;
  }
  const st = (mat.statut ?? '').trim().toLowerCase();
  if (st !== 'en stock') {
    return `"${mat.nom}" n'est pas disponible (statut : ${mat.statut ?? 'inconnu'}).`;
  }
  return `"${mat.nom}" ne peut pas être ajouté au prêt.`;
}

import type { Materiel } from '../types';

/** Matériel géré en lot (un QR, stock ajustable comme un consommable). */
export function isMaterielGestionLot(m: Pick<Materiel, 'gestion_lot'>): boolean {
  return m.gestion_lot === 1 || m.gestion_lot === true;
}

export function materielLotUnite(m: Pick<Materiel, 'unite'>): string {
  const u = m.unite?.trim();
  return u || 'pièce';
}

export function materielStockActuel(m: Pick<Materiel, 'stock_actuel' | 'gestion_lot'>): number {
  if (isMaterielGestionLot(m)) {
    const n = Number(m.stock_actuel ?? 0);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }
  return 1;
}

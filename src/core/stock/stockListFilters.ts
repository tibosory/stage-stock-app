import type { Materiel, StatutMateriel } from '../../types';

export type StockStatusFilter = 'tous' | StatutMateriel;

export function matchesStockSearch(m: Materiel, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    m.nom.toLowerCase().includes(q) ||
    m.qr_code?.toLowerCase().includes(q) ||
    m.numero_serie?.toLowerCase().includes(q) ||
    m.marque?.toLowerCase().includes(q) ||
    (m as Materiel & { categorie_nom?: string }).categorie_nom?.toLowerCase().includes(q) === true
  );
}

export function filterStockList(
  list: Materiel[],
  statusFilter: StockStatusFilter,
  query: string
): Materiel[] {
  let out = list;
  if (statusFilter !== 'tous') {
    out = out.filter(m => m.statut === statusFilter);
  }
  if (!query.trim()) return out;
  return out.filter(m => matchesStockSearch(m, query));
}

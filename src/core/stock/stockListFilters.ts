import type { Consommable, Materiel, StatutMateriel } from '../../types';

export type StockStatusFilter = 'tous' | StatutMateriel;

export function matchesStockSearch(m: Materiel, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const extra = m as Materiel & { categorie_nom?: string; localisation_nom?: string; lieu_nom?: string };
  return (
    m.nom.toLowerCase().includes(q) ||
    m.qr_code?.toLowerCase().includes(q) ||
    m.numero_serie?.toLowerCase().includes(q) ||
    m.marque?.toLowerCase().includes(q) ||
    m.flightcase?.toLowerCase().includes(q) === true ||
    extra.categorie_nom?.toLowerCase().includes(q) === true ||
    extra.lieu_nom?.toLowerCase().includes(q) === true ||
    extra.localisation_nom?.toLowerCase().includes(q) === true
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

export function matchesConsommableSearch(c: Consommable, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const extra = c as Consommable & { categorie_nom?: string; localisation_nom?: string; lieu_nom?: string };
  return (
    c.nom.toLowerCase().includes(q) ||
    c.reference?.toLowerCase().includes(q) ||
    c.qr_code?.toLowerCase().includes(q) ||
    c.nfc_tag_id?.toLowerCase().includes(q) ||
    c.fournisseur?.toLowerCase().includes(q) ||
    extra.categorie_nom?.toLowerCase().includes(q) === true ||
    extra.lieu_nom?.toLowerCase().includes(q) === true ||
    extra.localisation_nom?.toLowerCase().includes(q) === true
  );
}

export function filterConsommableList(
  list: Consommable[],
  query: string,
  lowStockOnly = false
): Consommable[] {
  let out = list;
  if (lowStockOnly) {
    out = out.filter(c => c.stock_actuel <= c.seuil_minimum);
  }
  if (!query.trim()) return out;
  return out.filter(c => matchesConsommableSearch(c, query));
}

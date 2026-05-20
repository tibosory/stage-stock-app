import type { Consommable, Materiel } from '../../types';

export type QuerySort =
  | 'relevance'
  | 'name_asc'
  | 'name_desc'
  | 'power_desc'
  | 'stock_desc';

export type StructuredQuery = {
  text?: string;
  category?: 'sound' | 'light' | 'video' | 'stage' | 'costume' | 'props' | 'energy';
  available?: boolean;
  status?: 'ok' | 'maintenance' | 'broken';
  minPower?: number;
  capacity?: number;
  sort?: QuerySort;
  recommended_setup?: boolean;
  optimized_list?: boolean;
};

export type SearchRow =
  | { kind: 'mat'; id: string; label: string; sub?: string; raw: Materiel; score: number }
  | { kind: 'conso'; id: string; label: string; sub?: string; raw: Consommable; score: number };

function parseTechnicalData(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
}

function scoreByText(blob: string, text?: string): number {
  if (!text?.trim()) return 1;
  const t = text.trim().toLowerCase();
  if (!blob.includes(t)) return 0;
  if (blob.startsWith(t)) return 6;
  return 3;
}

function materialCategoryHit(m: Materiel, category?: StructuredQuery['category']): boolean {
  if (!category) return true;
  const blob = `${m.type ?? ''} ${m.categorie_nom ?? ''} ${m.nom}`.toLowerCase();
  return blob.includes(category);
}

function materialStatusHit(m: Materiel, status?: StructuredQuery['status']): boolean {
  if (!status) return true;
  if (status === 'maintenance') return m.statut === 'en réparation';
  if (status === 'broken') return m.etat === 'hors service' || m.statut === 'perdu';
  return m.etat === 'bon' || m.statut === 'en stock';
}

export function searchMaterial(mats: Materiel[], query: StructuredQuery): SearchRow[] {
  const out: SearchRow[] = [];
  for (const m of mats) {
    if (!materialCategoryHit(m, query.category)) continue;
    if (!materialStatusHit(m, query.status)) continue;
    if (query.available && m.statut !== 'en stock') continue;

    const tech = parseTechnicalData(m.technical_data);
    const power = Number(tech.power ?? 0);
    if (query.minPower != null && Number.isFinite(query.minPower) && power < query.minPower) continue;

    const blob =
      `${m.nom} ${m.qr_code ?? ''} ${m.numero_serie ?? ''} ${m.marque ?? ''} ` +
      `${m.categorie_nom ?? ''} ${m.type ?? ''} ${JSON.stringify(tech)}`.toLowerCase();
    const score = scoreByText(blob, query.text);
    if (score <= 0) continue;
    out.push({
      kind: 'mat',
      id: m.id,
      label: m.nom,
      sub: [m.marque, m.numero_serie].filter(Boolean).join(' · '),
      raw: m,
      score,
    });
  }
  return out;
}

export function filterMaterial(rows: SearchRow[], query: StructuredQuery): SearchRow[] {
  const next = [...rows];
  switch (query.sort) {
    case 'name_asc':
      next.sort((a, b) => a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' }));
      break;
    case 'name_desc':
      next.sort((a, b) => b.label.localeCompare(a.label, 'fr', { sensitivity: 'base' }));
      break;
    case 'power_desc':
      next.sort((a, b) => {
        const ta = a.kind === 'mat' ? Number(parseTechnicalData(a.raw.technical_data).power ?? 0) : 0;
        const tb = b.kind === 'mat' ? Number(parseTechnicalData(b.raw.technical_data).power ?? 0) : 0;
        return tb - ta;
      });
      break;
    default:
      next.sort((a, b) => b.score - a.score);
      break;
  }
  return next;
}

export function generateLists(
  mats: Materiel[],
  cons: Consommable[],
  query: StructuredQuery
): SearchRow[] {
  const matRows = searchMaterial(mats, query);
  const consoRows: SearchRow[] = [];
  const q = query.text?.trim().toLowerCase();
  for (const c of cons) {
    if (query.available && c.stock_actuel <= 0) continue;
    const blob = `${c.nom} ${c.reference ?? ''} ${c.categorie_nom ?? ''}`.toLowerCase();
    const score = scoreByText(blob, q);
    if (score <= 0) continue;
    consoRows.push({
      kind: 'conso',
      id: c.id,
      label: c.nom,
      sub: [c.unite, String(c.stock_actuel ?? '')].filter(Boolean).join(' · '),
      raw: c,
      score,
    });
  }
  return filterMaterial([...matRows, ...consoRows], query).slice(0, 200);
}

export function getStats(rows: SearchRow[]) {
  let mats = 0;
  let cons = 0;
  for (const r of rows) {
    if (r.kind === 'mat') mats++;
    else cons++;
  }
  return { total: rows.length, materiels: mats, consommables: cons };
}

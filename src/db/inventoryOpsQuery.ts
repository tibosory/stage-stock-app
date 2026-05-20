import type { Categorie } from '../types';

export type MouvementsStockHistoriqueOptions = {
  limit?: number;
  type?: 'entrée' | 'sortie' | 'ajustement';
  dateFrom?: string;
  dateTo?: string;
  search?: string;
};

function categoryPathByIdForSearch(categories: Categorie[], leafId: string | null | undefined): string {
  if (!leafId) return '';
  const byId = new Map(categories.map(c => [c.id, c]));
  const parts: string[] = [];
  let cur: Categorie | undefined = byId.get(leafId);
  let guard = 0;
  while (cur && guard++ < 64) {
    parts.unshift(cur.nom);
    const pid = cur.parent_id;
    cur = pid ? byId.get(pid) : undefined;
  }
  return parts.join(' › ');
}

export function categoryIdsMatchingPathQuery(categories: Categorie[], q: string): string[] {
  const qn = q.trim().toLowerCase();
  if (!qn) return [];
  const out = new Set<string>();
  for (const c of categories) {
    if (c.nom && c.nom.toLowerCase().includes(qn)) out.add(c.id);
    const path = categoryPathByIdForSearch(categories, c.id);
    if (path && path.toLowerCase().includes(qn)) out.add(c.id);
  }
  return [...out];
}

export function buildMouvementsStockHistoriqueQuery(
  options: MouvementsStockHistoriqueOptions | number = {}
): { sql: string; params: (string | number)[] } {
  let limit = 800;
  let filt: MouvementsStockHistoriqueOptions = {};
  if (typeof options === 'number') limit = options;
  else {
    filt = options;
    limit = options.limit ?? 800;
  }
  const lim = Math.min(Math.max(1, Math.floor(limit)), 5000);
  const clauses: string[] = [];
  const params: (string | number)[] = [];

  if (filt.type) {
    clauses.push('m.type = ?');
    params.push(filt.type);
  }
  if (filt.dateFrom?.trim()) {
    clauses.push('m.created_at >= ?');
    params.push(filt.dateFrom.trim());
  }
  if (filt.dateTo?.trim()) {
    clauses.push('m.created_at <= ?');
    params.push(filt.dateTo.trim());
  }
  const q = filt.search?.trim().replace(/%/g, '').replace(/'/g, '') ?? '';
  if (q.length > 0) {
    const like = `%${q.toLowerCase()}%`;
    clauses.push("(lower(coalesce(c.nom, '')) LIKE ? OR lower(coalesce(m.note, '')) LIKE ?)");
    params.push(like, like);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const sql = `
    SELECT m.id, m.consommable_id, m.type, m.quantite, m.note, m.created_at,
            coalesce(c.nom, '(consommable supprimé)') AS consommable_nom,
            coalesce(c.unite, 'pièce') AS consommable_unite
     FROM mouvements_stock m
     LEFT JOIN consommables c ON c.id = m.consommable_id
     ${where}
     ORDER BY datetime(m.created_at) DESC
     LIMIT ?`;
  params.push(lim);
  return { sql, params };
}

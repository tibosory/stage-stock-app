import { getResolvedApiBase, stageStockApiHeadersAsync } from '../config/stageStockApi';
import { stripStageStockServerRootSuffix } from './apiEndpointStorage';
import { fetchWithTimeout } from './fetchWithTimeout';

export type ApPrepStaffNeed = {
  role: string;
  quantity: number;
  mission?: string;
  source?: string;
};

export type ApPrepBudgetLineDto = {
  role: string;
  quantity: number;
  hours: number;
  rate_eur: number;
  notes?: string;
};

export type ApPrepShoppingItemDto = {
  label: string;
  quantity: number;
  unit?: string;
  category: 'catering' | 'fournitures' | 'autre';
  notes?: string;
};

export type ApPrepProposalDto = {
  summary: string;
  staff_needs: ApPrepStaffNeed[];
  budget_lines: ApPrepBudgetLineDto[];
  shopping_list: ApPrepShoppingItemDto[];
  caveats: string[];
  provider: string;
  model: string;
};

export type ApPrepContextDto = {
  event_name?: string;
  event_dates?: string;
  participants?: number | null;
  personnel_accueil?: string | null;
  equipe?: Array<{ nom?: string; role?: string; structure?: string }>;
  planning_personnel?: Array<{
    nom?: string;
    role?: string;
    creneaux?: Array<{ date?: string; debut?: string; fin?: string; titre?: string; poste?: string }>;
  }>;
  repas?: Array<{ creneau?: string; lieu?: string; nbPersonnes?: number; notes?: string }>;
  besoins_technique?: Array<{ pole?: string; label?: string; value?: string }>;
  document_titles?: string[];
  notes?: string | null;
};

const PREP_FETCH_TIMEOUT_MS = 150_000;

export async function postAccueilProAiPrep(
  context: ApPrepContextDto
): Promise<
  | { ok: true; proposal: ApPrepProposalDto }
  | { ok: false; status: number; error: string }
> {
  const baseRaw = await getResolvedApiBase();
  const base = stripStageStockServerRootSuffix(baseRaw.trim());
  if (!base || base.length < 8 || !/^https?:\/\//i.test(base)) {
    return {
      ok: false,
      status: 0,
      error:
        'Aucune URL serveur. Ouvrez Réseau et jumellez le PC (l’IA tourne sur le serveur Stage Stock).',
    };
  }
  const headers = await stageStockApiHeadersAsync();
  headers['Content-Type'] = 'application/json';
  const url = `${base.replace(/\/+$/, '')}/api/accueilpro/ai-prep`;
  try {
    const res = await fetchWithTimeout(
      url,
      { method: 'POST', headers, body: JSON.stringify(context) },
      PREP_FETCH_TIMEOUT_MS
    );
    const text = await res.text();
    let json: { proposal?: ApPrepProposalDto; error?: string; detail?: string } = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      return { ok: false, status: res.status, error: text.slice(0, 200) || `HTTP ${res.status}` };
    }
    if (!res.ok || !json.proposal) {
      return {
        ok: false,
        status: res.status,
        error: json.error || json.detail || `HTTP ${res.status}`,
      };
    }
    return { ok: true, proposal: json.proposal };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

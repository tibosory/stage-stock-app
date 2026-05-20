import { checkServerReachableQuick } from '../../config/stageStockApi';
import { postAssistantAsk } from '../../lib/assistantApi';
import type { StructuredQuery } from '../../core/stock/stockEngine';

export type EnhancedResult = {
  query: StructuredQuery;
  reason: string;
};

function safeParseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export class AIService {
  isAIAvailable(): boolean {
    // L'IA locale légère (règles + heuristiques) est toujours dispo.
    return true;
  }

  async parseQuery(input: string): Promise<StructuredQuery> {
    const text = input.trim();
    if (!text) return {};
    // Fallback local ultra rapide : conserve le texte pour le moteur de règles.
    return { text };
  }

  async enhanceQueryAsync(input: string, baseQuery: StructuredQuery): Promise<EnhancedResult | null> {
    const text = input.trim();
    if (!text) return null;

    // Cas 1: "IA légère locale" -> enrichissement heuristique non bloquant
    const localHint = this.buildLocalHint(text, baseQuery);
    if (localHint) return localHint;

    // Cas 2: serveur local IA (Ollama via backend) si joignable
    const canReach = await checkServerReachableQuick();
    if (!canReach) return null;

    const prompt =
      'Convertis la requête utilisateur en JSON strict pour recherche inventaire. ' +
      'Réponds UNIQUEMENT en JSON avec clés possibles: category, available, status, minPower, capacity, sort, recommended_setup, optimized_list. ' +
      `Requête: "${text}"`;
    const res = await postAssistantAsk(prompt);
    if (!res.ok) return null;
    const json = safeParseJson<StructuredQuery>(res.data.response.summary ?? '');
    if (!json || typeof json !== 'object') return null;
    return {
      query: { ...baseQuery, ...json },
      reason: 'Enrichi via IA serveur local',
    };
  }

  private buildLocalHint(input: string, baseQuery: StructuredQuery): EnhancedResult | null {
    const q = input.toLowerCase();
    const next: StructuredQuery = { ...baseQuery };
    let touched = false;
    if (/\b(kit|setup|config|pack)\b/.test(q)) {
      next.recommended_setup = true;
      touched = true;
    }
    const cap = q.match(/\b(\d{2,5})\s*(pers|personnes|pax)\b/);
    if (cap) {
      next.capacity = Number(cap[1]);
      touched = true;
    }
    if (/\b(puissant|puissants|forte puissance)\b/.test(q)) {
      next.sort = 'power_desc';
      touched = true;
    }
    if (!touched) return null;
    return { query: next, reason: 'Enrichi localement (heuristique)' };
  }
}

export const aiService = new AIService();

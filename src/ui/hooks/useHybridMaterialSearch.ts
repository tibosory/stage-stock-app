import { useEffect, useMemo, useRef, useState } from 'react';
import { getInventorySnapshot, type InventorySnapshot } from '../../db/materialRepository';
import { aiService, type EnhancedResult } from '../../services/ai/AIService';
import { AIWorkerQueue } from '../../services/ai/aiWorker';
import {
  generateLists,
  getStats,
  type SearchRow,
  type StructuredQuery,
} from '../../core/stock/stockEngine';
import { parseNaturalQueryWithRules } from '../../core/rules/queryRuleEngine';

type HybridSearchState = {
  loading: boolean;
  rows: SearchRow[];
  stats: { total: number; materiels: number; consommables: number };
  aiPending: boolean;
  aiReason: string | null;
};

const DEFAULT_STATE: HybridSearchState = {
  loading: true,
  rows: [],
  stats: { total: 0, materiels: 0, consommables: 0 },
  aiPending: false,
  aiReason: null,
};

export function useHybridMaterialSearch(input: string, aiDebounceMs = 420): HybridSearchState {
  const [state, setState] = useState<HybridSearchState>(DEFAULT_STATE);
  const snapshotRef = useRef<InventorySnapshot | null>(null);
  const latestInputRef = useRef('');
  const workerRef = useRef(
    new AIWorkerQueue((text: string, base: StructuredQuery) => aiService.enhanceQueryAsync(text, base))
  );

  useEffect(() => {
    let cancel = false;
    void (async () => {
      const snapshot = await getInventorySnapshot();
      if (cancel) return;
      snapshotRef.current = snapshot;
      setState(prev => ({ ...prev, loading: false }));
    })();
    return () => {
      cancel = true;
      workerRef.current.cancelAll();
    };
  }, []);

  const baseQuery = useMemo(() => parseNaturalQueryWithRules(input), [input]);

  useEffect(() => {
    latestInputRef.current = input;
    if (state.loading || !snapshotRef.current) return;

    const { materiels, consommables } = snapshotRef.current;

    // 1) Résultat local instantané (offline-first).
    const localRows = generateLists(materiels, consommables, baseQuery);
    setState(prev => ({
      ...prev,
      rows: localRows,
      stats: getStats(localRows),
      aiReason: null,
    }));

    const trimmed = input.trim();
    if (!trimmed || !aiService.isAIAvailable()) {
      setState(prev => ({ ...prev, aiPending: false }));
      return;
    }

    // 2) Enrichissement IA asynchrone (jamais bloquant).
    setState(prev => ({ ...prev, aiPending: true }));
    workerRef.current.enqueue(
      trimmed,
      baseQuery,
      aiDebounceMs,
      (_id: number, enhanced: EnhancedResult | null) => {
        const stillSameInput = latestInputRef.current.trim() === trimmed;
        if (!stillSameInput || !snapshotRef.current) return;
        if (!enhanced) {
          setState(prev => ({ ...prev, aiPending: false }));
          return;
        }
        const aiRows = generateLists(
          snapshotRef.current.materiels,
          snapshotRef.current.consommables,
          enhanced.query
        );
        const changed =
          aiRows.length !== localRows.length ||
          aiRows.some((r, i) => r.id !== localRows[i]?.id || r.kind !== localRows[i]?.kind);
        setState(prev => ({
          ...prev,
          aiPending: false,
          rows: changed ? aiRows : prev.rows,
          stats: changed ? getStats(aiRows) : prev.stats,
          aiReason: changed ? enhanced.reason : null,
        }));
      },
      () => {
        setState(prev => ({ ...prev, aiPending: false }));
      }
    );
  }, [aiDebounceMs, baseQuery, input, state.loading]);

  return state;
}

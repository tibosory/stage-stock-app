import {
  checkServerReachableQuick,
  getResolvedApiBase,
  pingStageStockApi,
  probeStageStockSyncApi,
} from '../config/stageStockApi';
import { getIsOnlineRuntime } from './networkRuntime';
import { hasLocalSyncApiKey } from './serverAuthHeaders';
import { getSupabase, isSupabaseConfigured } from './supabase';
import type { ConnectionDiagnosticsDeps } from './connectionDiagnosticsCore';
import { formatSyncHealthPendingDetail, loadSyncHealthSnapshot } from './syncHealthSnapshot';

export type {
  DiagnosticCheck,
  DiagnosticCheckId,
  DiagnosticLevel,
  ConnectionDiagnosticsDeps,
} from './connectionDiagnosticsCore';
export { runConnectionDiagnostics } from './connectionDiagnosticsCore';

export function defaultConnectionDiagnosticsDeps(): ConnectionDiagnosticsDeps {
  return {
    getIsOnline: () => getIsOnlineRuntime(),
    getResolvedApiBase,
    checkServerReachableQuick,
    pingStageStockApi,
    probeStageStockSyncApi,
    isSupabaseConfigured,
    getSupabaseSession: async () => {
      try {
        const { data } = await getSupabase().auth.getSession();
        return { ok: Boolean(data.session) };
      } catch {
        return { ok: false };
      }
    },
    hasLocalSyncApiKey,
    getInventorySyncHealth: async () => {
      const snapshot = await loadSyncHealthSnapshot();
      return {
        hasPendingWork: snapshot.hasPendingWork,
        detail: snapshot.hasPendingWork ? formatSyncHealthPendingDetail(snapshot) : undefined,
      };
    },
  };
}

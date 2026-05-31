/**
 * Réparation connexion : normalise l’URL, détecte le bon port, vérifie le snapshot JSON.
 */
import { getResolvedApiBase, invalidateQuickReachabilityCache } from '../config/stageStockApi';
import { reconcileStoredApiBaseUrl, setApiBaseOverride } from './apiEndpointStorage';
import {
  probeStageStockSnapshotJson,
  resolveStageStockBaseWithPortProbe,
} from './apiBaseResolution';

export type ConnectionRepairResult = {
  baseUrl: string;
  changed: boolean;
  snapshotOk: boolean;
  snapshotDetail: string;
};

export async function runConnectionRepair(): Promise<ConnectionRepairResult> {
  await reconcileStoredApiBaseUrl();
  invalidateQuickReachabilityCache();

  let base = (await getResolvedApiBase()).trim();
  let changed = false;

  const probed = base ? await resolveStageStockBaseWithPortProbe(base) : null;
  if (probed && probed !== base) {
    await setApiBaseOverride(probed);
    base = probed;
    changed = true;
    invalidateQuickReachabilityCache();
  } else if (probed) {
    base = probed;
  }

  const snap = base
    ? await probeStageStockSnapshotJson(base)
    : { ok: false, detail: 'Aucune URL serveur configurée' };

  return {
    baseUrl: base,
    changed,
    snapshotOk: snap.ok,
    snapshotDetail: snap.detail,
  };
}

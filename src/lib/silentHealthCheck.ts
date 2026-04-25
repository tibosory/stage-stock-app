import { getResolvedApiBase, stageStockApiHeadersAsync } from '../config/stageStockApi';
import { fetchWithTimeout } from './fetchWithTimeout';
import { isConsumerApp } from '../config/appMode';
import { canCallApiSync } from './syncGuards';

/**
 * GET /diagnostic en arrière-plan (aucune alerte, aucun affichage).
 */
export async function runSilentServerDiagnostics(): Promise<void> {
  if (!isConsumerApp()) return;
  try {
    const guard = await canCallApiSync('runSilentServerDiagnostics');
    if (!guard.ok) return;
    const base = await getResolvedApiBase();
    const headers = await stageStockApiHeadersAsync();
    const url = `${base.replace(/\/+$/, '')}/diagnostic`;
    await fetchWithTimeout(url, { method: 'GET', headers }, 8_000);
  } catch {
    // volontairement silencieux
  }
}

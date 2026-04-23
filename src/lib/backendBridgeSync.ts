/**
 * Copie d’inventaire d’un serveur Stage Stock vers un autre (sans passer par la base SQLite locale),
 * via GET /api/sync/snapshot puis POST /api/sync/bulk.
 */
import { inventoryApiFetch, type InventorySyncEndpoint } from './inventoryApiSync';

export async function copyInventoryBetweenServers(
  source: InventorySyncEndpoint,
  dest: InventorySyncEndpoint
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await inventoryApiFetch('/api/sync/snapshot', { method: 'GET' }, source);
    if (!res.ok) {
      const t = await res.text();
      return { ok: false, error: `Source : HTTP ${res.status} — ${t.slice(0, 400)}` };
    }
    const snap = (await res.json()) as Record<string, unknown>;
    const body = {
      categories: snap.categories ?? [],
      localisations: snap.localisations ?? [],
      materiels: snap.materiels ?? [],
      consommables: snap.consommables ?? [],
      prets: snap.prets ?? [],
      pret_materiels: snap.pret_materiels ?? [],
      app_users: snap.app_users ?? [],
    };
    const res2 = await inventoryApiFetch(
      '/api/sync/bulk',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      dest
    );
    const t2 = await res2.text();
    if (!res2.ok) {
      return { ok: false, error: `Destination : HTTP ${res2.status} — ${t2.slice(0, 400)}` };
    }
    return { ok: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'API_NON_CONFIGUREE') {
      return { ok: false, error: 'URL invalide ou manquante.' };
    }
    return { ok: false, error: msg };
  }
}

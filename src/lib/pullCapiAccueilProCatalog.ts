/**
 * Tire les catalogues CAPI (Accueil Pro) depuis le snapshot inventaire CATRACK
 * et matérialise lieux / espaces / événements / agenda.
 */
import { getDB } from '../db/database';
import {
  applyInventorySnapshotRows,
  inventoryApiFetch,
  type InventorySyncEndpoint,
} from './inventoryApiSync';
import { resolveAccueilProSyncEndpoint } from './accueilProApiSync';
import { formatSyncHttpError } from './syncAuthErrors';
import { syncSnapshotInvalidJsonMessage } from './syncSnapshotResponseHint';
import { materializeCapiAccueilProCatalog } from './capiAccueilProMaterialize';

type CapiCatalogSnapshot = {
  ap_capi_lieu_refs?: Record<string, unknown>[];
  ap_capi_spectacle_refs?: Record<string, unknown>[];
  ap_capi_contact_refs?: Record<string, unknown>[];
  ap_capi_espace_refs?: Record<string, unknown>[];
  ap_capi_planning_refs?: Record<string, unknown>[];
  ap_capi_document_refs?: Record<string, unknown>[];
};

export async function pullCapiAccueilProCatalogFromServer(
  endpoint?: InventorySyncEndpoint | null,
): Promise<{ materialized: Awaited<ReturnType<typeof materializeCapiAccueilProCatalog>> }> {
  const ep = endpoint ?? (await resolveAccueilProSyncEndpoint());
  if (!ep) throw new Error('Serveur CATRACK non configuré.');

  const res = await inventoryApiFetch('/api/sync/snapshot', { method: 'GET' }, ep);
  const text = await res.text();
  if (!res.ok) throw formatSyncHttpError(res.status, text, 'Catalogues CAPI');

  let full: CapiCatalogSnapshot;
  try {
    full = JSON.parse(text) as CapiCatalogSnapshot;
  } catch {
    throw new Error(`Catalogues CAPI : ${syncSnapshotInvalidJsonMessage(text)}`);
  }

  const db = await getDB();
  await applyInventorySnapshotRows(db, {
    ap_capi_lieu_refs: full.ap_capi_lieu_refs,
    ap_capi_spectacle_refs: full.ap_capi_spectacle_refs,
    ap_capi_contact_refs: full.ap_capi_contact_refs,
    ap_capi_espace_refs: full.ap_capi_espace_refs,
    ap_capi_planning_refs: full.ap_capi_planning_refs,
    ap_capi_document_refs: full.ap_capi_document_refs,
  });

  const materialized = await materializeCapiAccueilProCatalog();
  return { materialized };
}

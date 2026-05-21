/**
 * Sync Accueil Pro via l’API HTTP du serveur (même périmètre que inventaire CATRACK Pro).
 *
 * Ordre **push puis pull** : fusion incrémentale locale (`mergeAccueilProSnapshot`).
 */
import type * as SQLite from 'expo-sqlite';
import { getDB } from '../db/coreDb';
import {
  ensureAccueilProSchema,
  listUnsyncedAccueilProRows,
  markAccueilProRowsSyncedFromAppliedIds,
  type AccueilProBulkPayload,
} from '../db/accueilProDb';
import {
  getAccueilProLastPullAt,
  mergeAccueilProSnapshot,
  setAccueilProLastPullAt,
  type MergeAccueilProResult,
} from './accueilProMerge';
import { getResolvedApiBase } from '../config/stageStockApi';
import { getApiKeyOverride, looksLikeHttpUrl } from './apiEndpointStorage';
import type { InventorySyncEndpoint } from './inventoryApiSync';
import { inventoryApiFetch } from './inventoryApiSync';
import { formatSyncHttpError, missingSyncApiKeyError } from './syncAuthErrors';
import { hasLocalSyncApiKey } from './serverAuthHeaders';
import { isV1LanMode } from '../config/appMode';

/** Endpoint LAN / Tailscale courant pour uploads Accueil Pro. */
export async function resolveAccueilProSyncEndpoint(): Promise<InventorySyncEndpoint | null> {
  const base = await getResolvedApiBase();
  if (!base || !looksLikeHttpUrl(base)) return null;
  const apiKey = await getApiKeyOverride();
  return { baseUrl: base.replace(/\/+$/, ''), apiKey: apiKey?.trim() || null };
}

export type AccueilProSyncDatabase = SQLite.SQLiteDatabase;

export type AccueilProPullResult = MergeAccueilProResult;

type BulkApplyResponse = {
  ok?: boolean;
  totalApplied?: number;
  appliedIds?: {
    venues?: string[];
    spaces?: string[];
    organizations?: string[];
    organization_contacts?: string[];
    organization_documents?: string[];
    rental_requests?: string[];
    events?: string[];
    conventions?: string[];
    room_inspections?: string[];
    team_members?: string[];
    event_personnel?: string[];
    day_plan_items?: string[];
    day_notes?: string[];
  };
};

function summarizeHttpError(status: number, body: string): Error {
  return formatSyncHttpError(status, body, 'Accueil Pro');
}

async function ensureAccueilProSyncAuth(): Promise<void> {
  if (!isV1LanMode()) return;
  if (await hasLocalSyncApiKey()) return;
  throw missingSyncApiKeyError('Accueil Pro');
}

function countBulkRows(body: AccueilProBulkPayload): number {
  return Object.values(body).reduce((n, v) => n + (Array.isArray(v) ? v.length : 0), 0);
}

export async function syncAccueilProFromApi(
  endpoint: InventorySyncEndpoint | null,
  opts?: { database?: AccueilProSyncDatabase; full?: boolean }
): Promise<AccueilProPullResult> {
  await ensureAccueilProSyncAuth();
  const db = opts?.database ?? (await getDB());
  await ensureAccueilProSchema(db);

  const lastPull = opts?.full ? null : await getAccueilProLastPullAt(db);
  const path =
    lastPull ?
      `/api/accueilpro/snapshot?since=${encodeURIComponent(lastPull)}`
    : '/api/accueilpro/snapshot';

  const res = await inventoryApiFetch(path, { method: 'GET' }, endpoint);
  if (!res.ok) {
    throw summarizeHttpError(res.status, await res.text());
  }
  let json: Record<string, unknown>;
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    throw new Error('AccueilPro snapshot : réponse JSON invalide.');
  }

  const mergeResult = await mergeAccueilProSnapshot(json, db);
  await setAccueilProLastPullAt(new Date().toISOString(), db);
  return mergeResult;
}

/** Envoie les lignes hors ligne ; marque `synced=1` seulement pour les ids confirmés par le serveur. */
export async function pushAccueilProToApi(
  endpoint: InventorySyncEndpoint | null,
  opts?: { database?: AccueilProSyncDatabase }
): Promise<boolean> {
  await ensureAccueilProSyncAuth();
  const db = opts?.database ?? (await getDB());
  await ensureAccueilProSchema(db);
  const body = await listUnsyncedAccueilProRows(db);
  const sentCount = countBulkRows(body);
  if (sentCount === 0) return false;

  const res = await inventoryApiFetch(
    '/api/accueilpro/bulk',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    },
    endpoint
  );
  if (!res.ok) {
    throw summarizeHttpError(res.status, await res.text());
  }

  let json: BulkApplyResponse;
  try {
    json = (await res.json()) as BulkApplyResponse;
  } catch {
    throw new Error('AccueilPro bulk : réponse JSON invalide.');
  }

  const applied = json.totalApplied ?? 0;
  if (applied === 0) {
    throw new Error(
      'AccueilPro : le serveur n’a appliqué aucune ligne. Vérifiez les champs obligatoires (lieu, organisation, nom).'
    );
  }

  if (json.appliedIds && Object.keys(json.appliedIds).length > 0) {
    await markAccueilProRowsSyncedFromAppliedIds(json.appliedIds, db);
  }

  return true;
}

export type AccueilProBidirectionalResult = {
  pushed: boolean;
  pull: AccueilProPullResult;
};

/** Pousse puis fusionne le snapshot serveur (sans effacer le local). @deprecated Préférer accueilProSyncOrchestrator */
export async function syncAccueilProBidirectional(
  endpoint: InventorySyncEndpoint | null,
  opts?: { database?: AccueilProSyncDatabase }
): Promise<AccueilProBidirectionalResult> {
  const { syncAccueilProBidirectional: orchestrated } = await import('./accueilProSyncOrchestrator');
  return orchestrated(endpoint, opts);
}

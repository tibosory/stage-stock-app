/**
 * Synchronisation inventaire via l’API HTTP CATRACK Pro (serveur local ou hébergé),
 * distincte de Supabase. Utilise GET /api/sync/snapshot et POST /api/sync/bulk.
 */
import { Platform } from 'react-native';
import { getResolvedApiBase } from '../config/stageStockApi';
import { fetchWithTimeout } from './fetchWithTimeout';
import {
  getApiKeyOverride,
  looksLikeHttpUrl,
  stripStageStockServerRootSuffix,
} from './apiEndpointStorage';
import { buildServerAuthHeaders } from './serverAuthHeaders';
import { getDB } from '../db/coreDb';
import { invalidateInventorySnapshotCache } from '../db/materialRepository';
import { getSessionAppUserRole } from '../db/userDb';
import { loadPendingInventoryDeletions, clearPendingInventoryDeletions } from '../db/regieDeletionSyncDb';
import { canCallApiSync, isLocalBackendDisabledReason } from './syncGuards';
import { mergeMaterielLocalMedia, mergeConsommableLocalMedia, filterSnapshotRowsByUnsyncedIds, type MaterielLocalMedia, type ConsommableLocalMedia } from './inventorySnapshotMerge';
import {
  reconcileInventoryFromSnapshot,
  type InventoryReconcileDb,
} from './inventorySnapshotReconcile';
export { reconcileInventoryFromSnapshot } from './inventorySnapshotReconcile';
import { syncSnapshotInvalidJsonMessage } from './syncSnapshotResponseHint';
import {
  applyRegieSnapshotRows,
  loadRegiePushPayload,
  markRegieSynced,
  regiePayloadIsEmpty,
  reconcileRegieFromSnapshot,
  uploadPendingRegiePhotos,
  downloadMissingRegiePhotos,
  clearRegieDeletionsAfterPush,
  type RegieSnapshotSlice,
} from './regieInventorySync';
import {
  uploadPendingConsommablePhotos,
  downloadMissingConsommablePhotos,
} from './consommablePhotoSync';
import {
  uploadPendingMaterielMedia,
  downloadMissingMaterielMedia,
} from './materielPhotoSync';

const MSG_NO_API =
  'Aucune URL d’API CATRACK Pro configurée (onglet Réseau ou EXPO_PUBLIC_API_URL au build).';
const MSG_API_DISABLED = 'Synchro serveur local désactivée (backend Supabase sélectionné).';

/** Cible explicite (autre URL / clé) pour sync depuis l’écran Import / export. */
export type InventorySyncEndpoint = {
  baseUrl: string;
  /** Si défini, utilisé comme X-API-Key / Bearer pour ce serveur (sinon JWT ou clé Réseau). */
  apiKey?: string | null;
};

async function isApiBaseConfigured(): Promise<boolean> {
  const b = await getResolvedApiBase();
  return Boolean(b && b.length >= 8 && /^https?:\/\//i.test(b));
}

async function isEndpointConfigured(endpoint?: InventorySyncEndpoint | null): Promise<boolean> {
  const u = endpoint?.baseUrl?.trim();
  if (u) return looksLikeHttpUrl(u);
  return isApiBaseConfigured();
}

async function buildHeadersForEndpoint(endpoint: InventorySyncEndpoint | null): Promise<Record<string, string>> {
  if (!endpoint?.baseUrl?.trim()) {
    return buildServerAuthHeaders();
  }
  const resolved = (await getResolvedApiBase())?.replace(/\/+$/, '') ?? '';
  const target = endpoint.baseUrl.trim().replace(/\/+$/, '');
  if (target === resolved) {
    return buildServerAuthHeaders();
  }
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-StageStock-Client': `StageStock-${Platform.OS}`,
  };
  const key =
    endpoint.apiKey?.trim() ||
    (await getApiKeyOverride())?.trim() ||
    process.env.EXPO_PUBLIC_API_KEY?.trim();
  if (key) {
    headers['X-API-Key'] = key;
    headers.Authorization = `Bearer ${key}`;
    return headers;
  }
  return buildServerAuthHeaders();
}

export async function inventoryApiFetch(
  path: string,
  init: RequestInit | undefined,
  endpoint: InventorySyncEndpoint | null
): Promise<Response> {
  const guard = await canCallApiSync(`inventoryApiFetch:${path}`);
  if (!guard.ok) {
    throw new Error(isLocalBackendDisabledReason(guard.reason) ? 'API_SYNC_DISABLED' : 'API_NON_CONFIGUREE');
  }
  const base = endpoint?.baseUrl?.trim()
    ? endpoint.baseUrl.trim().replace(/\/+$/, '')
    : await getResolvedApiBase();
  if (!base || base.length < 8 || !/^https?:\/\//i.test(base)) {
    throw new Error('API_NON_CONFIGUREE');
  }
  const url = joinBasePath(base, path);
  const headers = await buildHeadersForEndpoint(endpoint);
  const mergedHeaders = {
    ...headers,
    ...(init?.headers as Record<string, string>),
  };
  const method = (init?.method as string) || 'GET';
  const p = path.toLowerCase();
  const timeoutMs =
    p.includes('/sync/snapshot') || p.includes('snapshot')
      ? 120_000
      : p.includes('/sync/bulk') || p.includes('bulk')
        ? 90_000
        : method === 'GET'
          ? 35_000
          : 45_000;
  return fetchWithTimeout(
    url,
    {
      ...init,
      headers: mergedHeaders,
    },
    timeoutMs
  );
}

type Snapshot = {
  materiels?: Record<string, unknown>[];
  consommables?: Record<string, unknown>[];
  prets?: Record<string, unknown>[];
  pret_materiels?: Record<string, unknown>[];
  categories?: Record<string, unknown>[];
  localisations?: Record<string, unknown>[];
  alertes_email?: Record<string, unknown>[];
  /** Comptes PIN (admin pousse ; autres appareils reçoivent). */
  app_users?: Record<string, unknown>[];
  /** Module Régie — conduite et mise technique. */
  conduites?: Record<string, unknown>[];
  tops?: Record<string, unknown>[];
  mises_techniques?: Record<string, unknown>[];
  etapes?: Record<string, unknown>[];
  positions?: Record<string, unknown>[];
  position_photos?: Record<string, unknown>[];
  lieux?: Record<string, unknown>[];
  beneficiaires?: Record<string, unknown>[];
  tour_lieu_refs?: Record<string, unknown>[];
  ap_capi_lieu_refs?: Record<string, unknown>[];
  ap_capi_spectacle_refs?: Record<string, unknown>[];
  ap_capi_contact_refs?: Record<string, unknown>[];
  ap_capi_espace_refs?: Record<string, unknown>[];
  ap_capi_planning_refs?: Record<string, unknown>[];
  ap_capi_document_refs?: Record<string, unknown>[];
  ap_capi_dossier_refs?: Record<string, unknown>[];
  capi_retro_notifications?: Record<string, unknown>[];
};

function joinBasePath(base: string, path: string): string {
  const b = stripStageStockServerRootSuffix(base.replace(/\/+$/, ''));
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}

function formatSyncHttpError(status: number, text: string): string {
  const preview = text.slice(0, 600);
  if (status === 405 && /nginx/i.test(text)) {
    return (
      `HTTP 405 — cette adresse ne pointe pas vers le serveur Stage Stock (réponse nginx).\n\n` +
      `Vérifiez dans Réseau que l’URL est http://IP_DU_PC:8091 (sans /pair), que le serveur tourne sur le PC, et que téléphone + PC sont sur le même Wi‑Fi.\n\n` +
      preview
    );
  }
  return `HTTP ${status} — ${preview}`;
}

function num01(v: unknown): number {
  if (v === true || v === 1) return 1;
  if (v === false || v === 0) return 0;
  if (typeof v === 'string' && (v === '1' || v.toLowerCase() === 'true')) return 1;
  return 0;
}

/** Valeurs acceptées par expo-sqlite pour éviter les erreurs de typage sur Record<string, unknown>. */
function sqlVal(v: unknown): string | number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string' || typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  return String(v);
}

/** Limite conservative de variables liées par requête SQLite (souvent 999). */
const SQLITE_BIND_CHUNK_BUDGET = 880;

type SqliteDb = Awaited<ReturnType<typeof getDB>>;

function materielSnapshotParams(m: Record<string, unknown>): (string | number | null)[] {
  return [
    sqlVal(m.id),
    sqlVal(m.nom ?? null),
    sqlVal(m.type ?? null),
    sqlVal(m.marque ?? null),
    sqlVal(m.numero_serie ?? null),
    sqlVal(m.poids_kg ?? null),
    sqlVal(m.categorie_id ?? null),
    sqlVal(m.localisation_id ?? null),
    sqlVal(m.lieu_id ?? null),
    sqlVal((m as { flightcase?: unknown }).flightcase ?? null),
    sqlVal(m.etat ?? 'bon'),
    sqlVal(m.statut ?? 'en stock'),
    sqlVal(m.date_achat ?? null),
    sqlVal(m.date_validite ?? null),
    sqlVal(m.prochain_controle ?? null),
    sqlVal(m.intervalle_controle_jours ?? null),
    sqlVal((m as { maintenance_todo?: unknown }).maintenance_todo ?? null),
    sqlVal((m as { maintenance_last_comment?: unknown }).maintenance_last_comment ?? null),
    sqlVal(m.technicien ?? null),
    sqlVal(m.qr_code ?? null),
    sqlVal(m.nfc_tag_id ?? null),
    sqlVal(m.photo_url ?? null),
    sqlVal(m.photo_local ?? null),
    sqlVal(m.notice_pdf_local ?? null),
    sqlVal(m.notice_photo_local ?? null),
    sqlVal(m.notice_pdf_url ?? null),
    sqlVal(m.notice_photo_url ?? null),
    m.vgp_actif != null ? num01(m.vgp_actif) : 0,
    sqlVal(m.vgp_periodicite_jours ?? null),
    sqlVal(m.vgp_derniere_visite ?? null),
    sqlVal(m.vgp_libelle ?? null),
    (m as { vgp_epi?: unknown }).vgp_epi != null ? num01((m as { vgp_epi?: unknown }).vgp_epi) : 0,
    sqlVal((m as { gel_brand?: unknown }).gel_brand ?? null),
    sqlVal((m as { gel_code?: unknown }).gel_code ?? null),
    (m as { gel_instead_of_photo?: unknown }).gel_instead_of_photo != null
      ? num01((m as { gel_instead_of_photo?: unknown }).gel_instead_of_photo)
      : 0,
    (m as { gestion_lot?: unknown }).gestion_lot != null
      ? num01((m as { gestion_lot?: unknown }).gestion_lot)
      : 0,
    Number((m as { stock_actuel?: unknown }).stock_actuel ?? 1),
    sqlVal((m as { unite?: unknown }).unite ?? 'pièce'),
    Number((m as { seuil_minimum?: unknown }).seuil_minimum ?? 0),
    sqlVal((m as { capi_spectacle_id?: unknown }).capi_spectacle_id ?? null),
    sqlVal((m as { capi_spectacle_label?: unknown }).capi_spectacle_label ?? null),
    sqlVal(m.created_at ?? new Date().toISOString()),
    sqlVal(m.updated_at ?? new Date().toISOString()),
  ];
}

const MATERIEL_SNAPSHOT_INSERT_SQL = `INSERT OR REPLACE INTO materiels (
            id, nom, type, marque, numero_serie, poids_kg, categorie_id, localisation_id, lieu_id, flightcase,
            etat, statut, date_achat, date_validite, prochain_controle, intervalle_controle_jours,
            maintenance_todo, maintenance_last_comment,
            technicien, qr_code, nfc_tag_id, photo_url, photo_local,
            notice_pdf_local, notice_photo_local, notice_pdf_url, notice_photo_url,
            vgp_actif, vgp_periodicite_jours, vgp_derniere_visite, vgp_libelle, vgp_epi,
            gel_brand, gel_code, gel_instead_of_photo,
            gestion_lot, stock_actuel, unite, seuil_minimum,
            capi_spectacle_id, capi_spectacle_label,
            created_at, updated_at, synced
          ) VALUES `;

const MATERIEL_SNAPSHOT_VALUES_TUPLE = `(${Array(43).fill('?').join(',')},1)`;

function consoSnapshotParams(c: Record<string, unknown>): (string | number | null)[] {
  return [
    sqlVal(c.id),
    sqlVal(c.nom),
    sqlVal(c.reference ?? null),
    sqlVal(c.unite ?? 'pièce'),
    Number(c.stock_actuel ?? 0),
    Number(c.seuil_minimum ?? 5),
    sqlVal(c.categorie_id ?? null),
    sqlVal(c.localisation_id ?? null),
    sqlVal(c.lieu_id ?? null),
    sqlVal(c.fournisseur ?? null),
    sqlVal(c.prix_unitaire ?? null),
    sqlVal(c.qr_code ?? null),
    sqlVal(c.nfc_tag_id ?? null),
    sqlVal(c.photo_local ?? null),
    sqlVal(c.photo_url ?? null),
    sqlVal((c as { gel_brand?: unknown }).gel_brand ?? null),
    sqlVal((c as { gel_code?: unknown }).gel_code ?? null),
    (c as { gel_instead_of_photo?: unknown }).gel_instead_of_photo != null
      ? num01((c as { gel_instead_of_photo?: unknown }).gel_instead_of_photo)
      : 0,
    sqlVal(c.created_at ?? new Date().toISOString()),
    sqlVal(c.updated_at ?? new Date().toISOString()),
  ];
}

const CONSO_SNAPSHOT_INSERT_SQL = `INSERT OR REPLACE INTO consommables (
            id, nom, reference, unite, stock_actuel, seuil_minimum,
            categorie_id, localisation_id, lieu_id, fournisseur, prix_unitaire, qr_code, nfc_tag_id,
            photo_local, photo_url, gel_brand, gel_code, gel_instead_of_photo,
            created_at, updated_at, synced
          ) VALUES `;

const CONSO_SNAPSHOT_VALUES_TUPLE = `(${Array(20).fill('?').join(',')},1)`;

function pretSnapshotParams(p: Record<string, unknown>): (string | number | null)[] {
  const rappel =
    p.rappel_jours_avant != null && Number.isFinite(Number(p.rappel_jours_avant))
      ? Math.min(365, Math.max(1, Math.floor(Number(p.rappel_jours_avant))))
      : null;
  return [
    sqlVal(p.id),
    sqlVal(p.numero_feuille ?? null),
    sqlVal(p.statut ?? 'en cours'),
    sqlVal(p.emprunteur ?? ''),
    sqlVal(p.organisation ?? null),
    sqlVal(p.telephone ?? null),
    sqlVal(p.email ?? null),
    sqlVal(p.date_depart ?? new Date().toISOString()),
    sqlVal(p.retour_prevu ?? null),
    sqlVal(p.retour_reel ?? null),
    sqlVal(p.valeur_estimee ?? null),
    sqlVal(p.commentaire ?? null),
    sqlVal(p.signature_emprunteur_data ?? null),
    sqlVal(p.signed_at ?? null),
    sqlVal(p.emprunteur_user_id ?? null),
    rappel,
    sqlVal(p.created_at ?? new Date().toISOString()),
    sqlVal(p.updated_at ?? new Date().toISOString()),
  ];
}

const PRET_SNAPSHOT_INSERT_SQL = `INSERT OR REPLACE INTO prets (
            id, numero_feuille, statut, emprunteur, organisation, telephone, email,
            date_depart, retour_prevu, retour_reel, valeur_estimee, commentaire,
            signature_emprunteur_data, signed_at, emprunteur_user_id, rappel_jours_avant,
            created_at, updated_at, synced
          ) VALUES `;

const PRET_SNAPSHOT_VALUES_TUPLE = '(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)';

async function loadLocalMaterielMediaMap(
  database: SqliteDb,
  ids: string[]
): Promise<Map<string, MaterielLocalMedia>> {
  const map = new Map<string, MaterielLocalMedia>();
  if (ids.length === 0) return map;
  const idChunk = Math.max(1, Math.floor(SQLITE_BIND_CHUNK_BUDGET / 1));
  for (let i = 0; i < ids.length; i += idChunk) {
    const chunk = ids.slice(i, i + idChunk);
    const ph = chunk.map(() => '?').join(',');
    const rows = await database.getAllAsync<{
      id: string;
      photo_local: string | null;
      photo_url: string | null;
      notice_pdf_local: string | null;
      notice_pdf_url: string | null;
      notice_photo_local: string | null;
      notice_photo_url: string | null;
    }>(
      `SELECT id, photo_local, photo_url, notice_pdf_local, notice_pdf_url,
              notice_photo_local, notice_photo_url FROM materiels WHERE id IN (${ph})`,
      chunk
    );
    for (const row of rows) {
      map.set(String(row.id), {
        photo_local: row.photo_local,
        photo_url: row.photo_url,
        notice_pdf_local: row.notice_pdf_local,
        notice_pdf_url: row.notice_pdf_url,
        notice_photo_local: row.notice_photo_local,
        notice_photo_url: row.notice_photo_url,
      });
    }
  }
  return map;
}

async function loadLocalConsommableMediaMap(
  database: SqliteDb,
  ids: string[]
): Promise<Map<string, ConsommableLocalMedia>> {
  const map = new Map<string, ConsommableLocalMedia>();
  if (ids.length === 0) return map;
  const idChunk = Math.max(1, Math.floor(SQLITE_BIND_CHUNK_BUDGET / 1));
  for (let i = 0; i < ids.length; i += idChunk) {
    const chunk = ids.slice(i, i + idChunk);
    const ph = chunk.map(() => '?').join(',');
    const rows = await database.getAllAsync<{
      id: string;
      photo_local: string | null;
      photo_url: string | null;
    }>(`SELECT id, photo_local, photo_url FROM consommables WHERE id IN (${ph})`, chunk);
    for (const row of rows) {
      map.set(String(row.id), {
        photo_local: row.photo_local,
        photo_url: row.photo_url,
      });
    }
  }
  return map;
}

async function loadUnsyncedLocalIds(database: SqliteDb, table: 'materiels' | 'consommables' | 'prets'): Promise<Set<string>> {
  const rows = await database.getAllAsync<{ id: string }>(`SELECT id FROM ${table} WHERE synced = 0`);
  return new Set(rows.map(r => String(r.id)));
}

export async function applyInventorySnapshotRows(database: SqliteDb, snap: Partial<Snapshot>): Promise<void> {
  const cats = (snap.categories ?? []).filter((c): c is Record<string, unknown> => Boolean(c?.id && c?.nom));
  const perCat = 3;
  const catChunk = Math.max(1, Math.floor(SQLITE_BIND_CHUNK_BUDGET / perCat));
  for (let i = 0; i < cats.length; i += catChunk) {
    const chunk = cats.slice(i, i + catChunk);
    const tuples = chunk.map(() => '(?, ?, ?)').join(', ');
    const flat = chunk.flatMap(c => [
      String(c.id),
      String(c.nom),
      c.parent_id != null ? String(c.parent_id) : null,
    ]);
    await database.runAsync(`INSERT OR REPLACE INTO categories (id, nom, parent_id) VALUES ${tuples}`, flat);
  }

  const locs = (snap.localisations ?? []).filter((l): l is Record<string, unknown> => Boolean(l?.id && l?.nom));
  const perLoc = 3;
  const locChunk = Math.max(1, Math.floor(SQLITE_BIND_CHUNK_BUDGET / perLoc));
  for (let i = 0; i < locs.length; i += locChunk) {
    const chunk = locs.slice(i, i + locChunk);
    const tuples = chunk.map(() => '(?, ?, ?)').join(', ');
    const flat = chunk.flatMap(l => [
      String(l.id),
      String(l.nom),
      l.lieu_id != null ? String(l.lieu_id) : null,
    ]);
    await database.runAsync(`INSERT OR REPLACE INTO localisations (id, nom, lieu_id) VALUES ${tuples}`, flat);
  }

  const lieuxRows = (snap.lieux ?? []).filter((l): l is Record<string, unknown> => Boolean(l?.id && l?.nom));
  const perLieu = 6;
  const lieuChunk = Math.max(1, Math.floor(SQLITE_BIND_CHUNK_BUDGET / perLieu));
  for (let i = 0; i < lieuxRows.length; i += lieuChunk) {
    const chunk = lieuxRows.slice(i, i + lieuChunk);
    const tuples = chunk.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
    const nowIso = new Date().toISOString();
    const flat = chunk.flatMap(l => [
      String(l.id),
      String(l.nom),
      l.source != null ? String(l.source) : null,
      l.capi_ref != null ? String(l.capi_ref) : null,
      l.created_at != null ? String(l.created_at) : nowIso,
      l.updated_at != null ? String(l.updated_at) : nowIso,
    ]);
    await database.runAsync(
      `INSERT OR REPLACE INTO lieux (id, nom, source, capi_ref, created_at, updated_at) VALUES ${tuples}`,
      flat
    );
  }

  const benefs = (snap.beneficiaires ?? []).filter(
    (b): b is Record<string, unknown> => Boolean(b?.id && b?.nom)
  );
  const perBenef = 7;
  const benefChunk = Math.max(1, Math.floor(SQLITE_BIND_CHUNK_BUDGET / perBenef));
  for (let i = 0; i < benefs.length; i += benefChunk) {
    const chunk = benefs.slice(i, i + benefChunk);
    const tuples = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
    const nowIso = new Date().toISOString();
    const flat = chunk.flatMap(b => [
      String(b.id),
      String(b.nom),
      b.organisation != null ? String(b.organisation) : null,
      b.telephone != null ? String(b.telephone) : null,
      b.email != null ? String(b.email) : null,
      b.created_at != null ? String(b.created_at) : nowIso,
      b.updated_at != null ? String(b.updated_at) : nowIso,
    ]);
    await database.runAsync(
      `INSERT OR REPLACE INTO beneficiaires (id, nom, organisation, telephone, email, created_at, updated_at) VALUES ${tuples}`,
      flat
    );
  }

  const tourLieux = (snap.tour_lieu_refs ?? []).filter(
    (l): l is Record<string, unknown> => Boolean(l?.id && l?.nom && l?.kind && l?.capi_ref)
  );
  if (tourLieux.length) {
    await database.runAsync('DELETE FROM tour_lieu_refs');
    const perTourLieu = 7;
    const tourLieuChunk = Math.max(1, Math.floor(SQLITE_BIND_CHUNK_BUDGET / perTourLieu));
    for (let i = 0; i < tourLieux.length; i += tourLieuChunk) {
      const chunk = tourLieux.slice(i, i + tourLieuChunk);
      const tuples = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
      const nowIso = new Date().toISOString();
      const flat = chunk.flatMap(l => [
        String(l.id),
        String(l.kind),
        String(l.nom),
        l.adresse != null ? String(l.adresse) : null,
        String(l.capi_ref),
        l.created_at != null ? String(l.created_at) : nowIso,
        l.updated_at != null ? String(l.updated_at) : nowIso,
      ]);
      await database.runAsync(
        `INSERT OR REPLACE INTO tour_lieu_refs (id, kind, nom, adresse, capi_ref, created_at, updated_at) VALUES ${tuples}`,
        flat
      );
    }
  }

  const apLieux = (snap.ap_capi_lieu_refs ?? []).filter(
    (l): l is Record<string, unknown> => Boolean(l?.id && l?.nom && l?.kind && l?.capi_ref)
  );
  if (apLieux.length) {
    await database.runAsync('DELETE FROM ap_capi_lieu_refs');
    const perApLieu = 8;
    const apLieuChunk = Math.max(1, Math.floor(SQLITE_BIND_CHUNK_BUDGET / perApLieu));
    for (let i = 0; i < apLieux.length; i += apLieuChunk) {
      const chunk = apLieux.slice(i, i + apLieuChunk);
      const tuples = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
      const nowIso = new Date().toISOString();
      const flat = chunk.flatMap(l => [
        String(l.id),
        String(l.kind),
        String(l.nom),
        l.adresse != null ? String(l.adresse) : null,
        l.ville != null ? String(l.ville) : null,
        String(l.capi_ref),
        l.created_at != null ? String(l.created_at) : nowIso,
        l.updated_at != null ? String(l.updated_at) : nowIso,
      ]);
      await database.runAsync(
        `INSERT OR REPLACE INTO ap_capi_lieu_refs (id, kind, nom, adresse, ville, capi_ref, created_at, updated_at) VALUES ${tuples}`,
        flat
      );
    }
  }

  const apSpectacles = (snap.ap_capi_spectacle_refs ?? []).filter(
    (s): s is Record<string, unknown> => Boolean(s?.id && s?.titre && s?.capi_ref)
  );
  if (apSpectacles.length) {
    await database.runAsync('DELETE FROM ap_capi_spectacle_refs');
    const perApSpec = 13;
    const apSpecChunk = Math.max(1, Math.floor(SQLITE_BIND_CHUNK_BUDGET / perApSpec));
    for (let i = 0; i < apSpectacles.length; i += apSpecChunk) {
      const chunk = apSpectacles.slice(i, i + apSpecChunk);
      const tuples = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
      const nowIso = new Date().toISOString();
      const flat = chunk.flatMap(s => [
        String(s.id),
        String(s.titre),
        s.compagnie != null ? String(s.compagnie) : null,
        s.categorie_code != null ? String(s.categorie_code) : null,
        s.categorie_libelle != null ? String(s.categorie_libelle) : null,
        s.salle_id != null ? String(s.salle_id) : null,
        s.salle_nom != null ? String(s.salle_nom) : null,
        s.capi_lieu_ref_id != null ? String(s.capi_lieu_ref_id) : null,
        s.date_debut != null ? String(s.date_debut) : null,
        s.date_fin != null ? String(s.date_fin) : null,
        String(s.capi_ref),
        s.created_at != null ? String(s.created_at) : nowIso,
        s.updated_at != null ? String(s.updated_at) : nowIso,
      ]);
      await database.runAsync(
        `INSERT OR REPLACE INTO ap_capi_spectacle_refs (id, titre, compagnie, categorie_code, categorie_libelle, salle_id, salle_nom, capi_lieu_ref_id, date_debut, date_fin, capi_ref, created_at, updated_at) VALUES ${tuples}`,
        flat
      );
    }
  }

  const apContacts = (snap.ap_capi_contact_refs ?? []).filter(
    (c): c is Record<string, unknown> => Boolean(c?.id && c?.nom && c?.kind && c?.capi_ref)
  );
  if (apContacts.length) {
    await database.runAsync('DELETE FROM ap_capi_contact_refs');
    const perApContact = 9;
    const apContactChunk = Math.max(1, Math.floor(SQLITE_BIND_CHUNK_BUDGET / perApContact));
    for (let i = 0; i < apContacts.length; i += apContactChunk) {
      const chunk = apContacts.slice(i, i + apContactChunk);
      const tuples = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
      const nowIso = new Date().toISOString();
      const flat = chunk.flatMap(c => [
        String(c.id),
        String(c.kind),
        String(c.nom),
        c.role != null ? String(c.role) : null,
        c.organisation != null ? String(c.organisation) : null,
        c.telephone != null ? String(c.telephone) : null,
        c.email != null ? String(c.email) : null,
        String(c.capi_ref),
        c.created_at != null ? String(c.created_at) : nowIso,
        c.updated_at != null ? String(c.updated_at) : nowIso,
      ]);
      await database.runAsync(
        `INSERT OR REPLACE INTO ap_capi_contact_refs (id, kind, nom, role, organisation, telephone, email, capi_ref, created_at, updated_at) VALUES ${tuples}`,
        flat
      );
    }
  }

  const apEspaces = (snap.ap_capi_espace_refs ?? []).filter(
    (e): e is Record<string, unknown> => Boolean(e?.id && e?.nom && e?.capi_ref),
  );
  if (apEspaces.length) {
    await database.runAsync('DELETE FROM ap_capi_espace_refs');
    const per = 11;
    const chunkSize = Math.max(1, Math.floor(SQLITE_BIND_CHUNK_BUDGET / per));
    for (let i = 0; i < apEspaces.length; i += chunkSize) {
      const chunk = apEspaces.slice(i, i + chunkSize);
      const tuples = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
      const nowIso = new Date().toISOString();
      const flat = chunk.flatMap((e) => [
        String(e.id),
        String(e.salle_id),
        String(e.capi_lieu_ref_id),
        String(e.nom),
        e.type != null ? String(e.type) : null,
        e.jauge != null ? Number(e.jauge) : null,
        e.description != null ? String(e.description) : null,
        e.control_points_json != null ? String(e.control_points_json) : null,
        e.ordre != null ? Number(e.ordre) : 0,
        String(e.capi_ref),
        e.updated_at != null ? String(e.updated_at) : nowIso,
      ]);
      await database.runAsync(
        `INSERT OR REPLACE INTO ap_capi_espace_refs (id, salle_id, capi_lieu_ref_id, nom, type, jauge, description, control_points_json, ordre, capi_ref, updated_at) VALUES ${tuples}`,
        flat,
      );
    }
  }

  const apPlanning = (snap.ap_capi_planning_refs ?? []).filter(
    (p): p is Record<string, unknown> => Boolean(p?.id && p?.title && p?.capi_ref && p?.date_key),
  );
  if (apPlanning.length) {
    await database.runAsync('DELETE FROM ap_capi_planning_refs');
    const per = 12;
    const chunkSize = Math.max(1, Math.floor(SQLITE_BIND_CHUNK_BUDGET / per));
    for (let i = 0; i < apPlanning.length; i += chunkSize) {
      const chunk = apPlanning.slice(i, i + chunkSize);
      const tuples = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
      const nowIso = new Date().toISOString();
      const flat = chunk.flatMap((p) => [
        String(p.id),
        String(p.capi_spectacle_ref_id),
        String(p.date_key),
        p.time_start != null ? String(p.time_start) : null,
        p.time_end != null ? String(p.time_end) : null,
        String(p.title),
        p.assignee_name != null ? String(p.assignee_name) : null,
        p.capi_espace_ref_id != null ? String(p.capi_espace_ref_id) : null,
        p.notes != null ? String(p.notes) : null,
        p.sort_order != null ? Number(p.sort_order) : 0,
        String(p.capi_ref),
        p.updated_at != null ? String(p.updated_at) : nowIso,
      ]);
      await database.runAsync(
        `INSERT OR REPLACE INTO ap_capi_planning_refs (id, capi_spectacle_ref_id, date_key, time_start, time_end, title, assignee_name, capi_espace_ref_id, notes, sort_order, capi_ref, updated_at) VALUES ${tuples}`,
        flat,
      );
    }
  }

  const apDocs = (snap.ap_capi_document_refs ?? []).filter(
    (d): d is Record<string, unknown> => Boolean(d?.id && d?.nom && d?.capi_ref && d?.version_id),
  );
  if (apDocs.length) {
    await database.runAsync('DELETE FROM ap_capi_document_refs');
    const per = 11;
    const chunkSize = Math.max(1, Math.floor(SQLITE_BIND_CHUNK_BUDGET / per));
    for (let i = 0; i < apDocs.length; i += chunkSize) {
      const chunk = apDocs.slice(i, i + chunkSize);
      const tuples = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
      const nowIso = new Date().toISOString();
      const flat = chunk.flatMap((d) => [
        String(d.id),
        String(d.capi_spectacle_ref_id),
        String(d.nom),
        d.chemin_dossier != null ? String(d.chemin_dossier) : null,
        d.mime_type != null ? String(d.mime_type) : null,
        d.taille_octets != null ? Number(d.taille_octets) : null,
        d.pole != null ? String(d.pole) : null,
        String(d.version_id),
        String(d.famille_id),
        String(d.capi_ref),
        d.updated_at != null ? String(d.updated_at) : nowIso,
      ]);
      await database.runAsync(
        `INSERT OR REPLACE INTO ap_capi_document_refs (id, capi_spectacle_ref_id, nom, chemin_dossier, mime_type, taille_octets, pole, version_id, famille_id, capi_ref, updated_at) VALUES ${tuples}`,
        flat,
      );
    }
  }

  const apDossiers = (snap.ap_capi_dossier_refs ?? []).filter(
    (d): d is Record<string, unknown> => Boolean(d?.id && d?.capi_ref && d?.capi_spectacle_ref_id),
  );
  if (apDossiers.length) {
    await database.runAsync('DELETE FROM ap_capi_dossier_refs');
    const per = 30;
    const chunkSize = Math.max(1, Math.floor(SQLITE_BIND_CHUNK_BUDGET / per));
    for (let i = 0; i < apDossiers.length; i += chunkSize) {
      const chunk = apDossiers.slice(i, i + chunkSize);
      const tuples = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
      const nowIso = new Date().toISOString();
      const flat = chunk.flatMap((d) => [
        String(d.id),
        String(d.capi_spectacle_ref_id),
        String(d.capi_ref),
        d.compagnie != null ? String(d.compagnie) : null,
        d.date_representation_debut != null ? String(d.date_representation_debut) : null,
        d.date_representation_fin != null ? String(d.date_representation_fin) : null,
        d.date_occupation_debut != null ? String(d.date_occupation_debut) : null,
        d.date_occupation_fin != null ? String(d.date_occupation_fin) : null,
        d.date_premontage_debut != null ? String(d.date_premontage_debut) : null,
        d.date_premontage_fin != null ? String(d.date_premontage_fin) : null,
        d.date_demontage != null ? String(d.date_demontage) : null,
        d.premontage_requis != null ? num01(d.premontage_requis) : 0,
        d.representations_json != null ? String(d.representations_json) : '[]',
        d.contact_compagnie_nom != null ? String(d.contact_compagnie_nom) : null,
        d.contact_compagnie_email != null ? String(d.contact_compagnie_email) : null,
        d.contact_compagnie_tel != null ? String(d.contact_compagnie_tel) : null,
        d.referents_compagnie_json != null ? String(d.referents_compagnie_json) : '[]',
        d.hebergements_json != null ? String(d.hebergements_json) : '[]',
        d.repas_json != null ? String(d.repas_json) : '[]',
        d.loges_json != null ? String(d.loges_json) : '[]',
        d.contacts_local_crew_json != null ? String(d.contacts_local_crew_json) : '[]',
        d.zones_accueil_json != null ? String(d.zones_accueil_json) : '[]',
        d.transports_accueil_json != null ? String(d.transports_accueil_json) : '[]',
        d.personnel_accueil != null ? String(d.personnel_accueil) : null,
        d.notes_accueil != null ? String(d.notes_accueil) : null,
        d.equipe_json != null ? String(d.equipe_json) : '[]',
        d.planning_personnel_json != null ? String(d.planning_personnel_json) : '[]',
        d.besoins_technique_json != null ? String(d.besoins_technique_json) : '[]',
        d.created_at != null ? String(d.created_at) : nowIso,
        d.updated_at != null ? String(d.updated_at) : nowIso,
      ]);
      await database.runAsync(
        `INSERT OR REPLACE INTO ap_capi_dossier_refs (
          id, capi_spectacle_ref_id, capi_ref, compagnie,
          date_representation_debut, date_representation_fin, date_occupation_debut, date_occupation_fin,
          date_premontage_debut, date_premontage_fin, date_demontage, premontage_requis, representations_json,
          contact_compagnie_nom, contact_compagnie_email, contact_compagnie_tel, referents_compagnie_json,
          hebergements_json, repas_json, loges_json, contacts_local_crew_json, zones_accueil_json,
          transports_accueil_json, personnel_accueil, notes_accueil,
          equipe_json, planning_personnel_json, besoins_technique_json, created_at, updated_at
        ) VALUES ${tuples}`,
        flat,
      );
    }
  }

  if (apLieux.length || apSpectacles.length || apContacts.length || apEspaces.length || apPlanning.length || apDocs.length || apDossiers.length) {
    const { materializeCapiAccueilProCatalog } = await import('./capiAccueilProMaterialize');
    await materializeCapiAccueilProCatalog();
  }

  if (lieuxRows.length || apLieux.length || tourLieux.length) {
    const { materializeCapiLieuxIntoInventoryCatalog } = await import('./capiLieuxCatalog');
    await materializeCapiLieuxIntoInventoryCatalog(database);
  }

  if (Array.isArray(snap.capi_retro_notifications)) {
    const capiRetroRows = snap.capi_retro_notifications.filter(
      (n): n is Record<string, unknown> =>
        Boolean(n?.id && n?.spectacle_id && n?.action_libelle && n?.niveau),
    );
    const { replaceCapiRetroNotifications } = await import('../db/capiRetroNotificationDb');
    await replaceCapiRetroNotifications(capiRetroRows);
    const { rescheduleCapiRetroReminders } = await import('./capiRetroNotifications');
    void rescheduleCapiRetroReminders();
  }

  const unsyncedMateriels = await loadUnsyncedLocalIds(database, 'materiels');
  const unsyncedConsos = await loadUnsyncedLocalIds(database, 'consommables');
  const unsyncedPrets = await loadUnsyncedLocalIds(database, 'prets');

  const mats = filterSnapshotRowsByUnsyncedIds(
    (snap.materiels ?? []).filter((m): m is Record<string, unknown> => Boolean(m?.id)),
    unsyncedMateriels
  );
  const localMediaById = await loadLocalMaterielMediaMap(
    database,
    mats.map(m => String(m.id))
  );
  const matCols = 35;
  const matChunk = Math.max(1, Math.floor(SQLITE_BIND_CHUNK_BUDGET / matCols));
  const matRows = mats
    .map(m => mergeMaterielLocalMedia(m, localMediaById.get(String(m.id))))
    .map(materielSnapshotParams);
  for (let i = 0; i < matRows.length; i += matChunk) {
    const chunk = matRows.slice(i, i + matChunk);
    const tuples = chunk.map(() => MATERIEL_SNAPSHOT_VALUES_TUPLE).join(', ');
    await database.runAsync(MATERIEL_SNAPSHOT_INSERT_SQL + tuples, chunk.flat());
  }

  const consos = filterSnapshotRowsByUnsyncedIds(
    (snap.consommables ?? []).filter((c): c is Record<string, unknown> => Boolean(c?.id)),
    unsyncedConsos
  );
  const localConsoMediaById = await loadLocalConsommableMediaMap(
    database,
    consos.map(c => String(c.id))
  );
  const perCon = 19;
  const conChunk = Math.max(1, Math.floor(SQLITE_BIND_CHUNK_BUDGET / perCon));
  const conRows = consos
    .map(c => mergeConsommableLocalMedia(c, localConsoMediaById.get(String(c.id))))
    .map(consoSnapshotParams);
  for (let i = 0; i < conRows.length; i += conChunk) {
    const chunk = conRows.slice(i, i + conChunk);
    const tuples = chunk.map(() => CONSO_SNAPSHOT_VALUES_TUPLE).join(', ');
    await database.runAsync(CONSO_SNAPSHOT_INSERT_SQL + tuples, chunk.flat());
  }

  const prets = filterSnapshotRowsByUnsyncedIds(
    (snap.prets ?? []).filter((p): p is Record<string, unknown> => Boolean(p?.id)),
    unsyncedPrets
  );
  const perPret = 18;
  const pretChunk = Math.max(1, Math.floor(SQLITE_BIND_CHUNK_BUDGET / perPret));
  const pretRows = prets.map(pretSnapshotParams);
  for (let i = 0; i < pretRows.length; i += pretChunk) {
    const chunk = pretRows.slice(i, i + pretChunk);
    const tuples = chunk.map(() => PRET_SNAPSHOT_VALUES_TUPLE).join(', ');
    await database.runAsync(PRET_SNAPSHOT_INSERT_SQL + tuples, chunk.flat());
  }

  const pms = (snap.pret_materiels ?? []).filter(
    (pm): pm is Record<string, unknown> => Boolean(pm?.id && pm?.pret_id && pm?.materiel_id)
  );
  const perPm = 6;
  const pmChunk = Math.max(1, Math.floor(SQLITE_BIND_CHUNK_BUDGET / perPm));
  for (let i = 0; i < pms.length; i += pmChunk) {
    const chunk = pms.slice(i, i + pmChunk);
    const tuples = chunk.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
    const flat = chunk.flatMap(pm => [
      String(pm.id),
      String(pm.pret_id),
      String(pm.materiel_id),
      pm.quantite != null ? Number(pm.quantite) : 1,
      num01(pm.retourne),
      pm.etat_au_retour != null ? String(pm.etat_au_retour) : null,
    ]);
    await database.runAsync(
      `INSERT OR REPLACE INTO pret_materiels (id, pret_id, materiel_id, quantite, retourne, etat_au_retour) VALUES ${tuples}`,
      flat
    );
  }

  const alertes = (snap.alertes_email ?? []).filter(
    (a): a is Record<string, unknown> => Boolean(a?.id && a?.email)
  );
  const perAe = 4;
  const aeChunk = Math.max(1, Math.floor(SQLITE_BIND_CHUNK_BUDGET / perAe));
  for (let i = 0; i < alertes.length; i += aeChunk) {
    const chunk = alertes.slice(i, i + aeChunk);
    const tuples = chunk.map(() => '(?, ?, ?, ?)').join(', ');
    const flat = chunk.flatMap(a => [
      String(a.id),
      a.nom != null ? String(a.nom) : null,
      String(a.email),
      a.role != null ? String(a.role) : null,
    ]);
    await database.runAsync(`INSERT OR REPLACE INTO alertes_email (id, nom, email, role) VALUES ${tuples}`, flat);
  }

  await applyRegieSnapshotRows(database, snap as RegieSnapshotSlice);
}

export async function syncFromInventoryApi(
  endpoint?: InventorySyncEndpoint | null
): Promise<{ ok: boolean; error?: string }> {
  const ep = endpoint ?? null;
  const guard = await canCallApiSync('syncFromInventoryApi');
  if (!guard.ok) {
    return { ok: false, error: isLocalBackendDisabledReason(guard.reason) ? MSG_API_DISABLED : MSG_NO_API };
  }
  if (!(await isEndpointConfigured(ep))) {
    return { ok: false, error: MSG_NO_API };
  }
  try {
    const res = await inventoryApiFetch('/api/sync/snapshot', { method: 'GET' }, ep);
    const text = await res.text();
    if (!res.ok) {
      return { ok: false, error: formatSyncHttpError(res.status, text) };
    }
    let snap: Snapshot;
    try {
      snap = JSON.parse(text) as Snapshot;
    } catch {
      return { ok: false, error: syncSnapshotInvalidJsonMessage(text) };
    }

    const database = await getDB();
    await database.execAsync('BEGIN IMMEDIATE;');
    try {
      await applyInventorySnapshotRows(database, snap);
      await reconcileInventoryFromSnapshot(database as InventoryReconcileDb, snap);
      await reconcileRegieFromSnapshot(database, snap as RegieSnapshotSlice);

      const appUsersSnap = snap.app_users;
      if (Array.isArray(appUsersSnap) && appUsersSnap.length > 0) {
        const tokenById = new Map<string, string | null>();
        const existingTokens = await database.getAllAsync<{ id: string; expo_push_token: string | null }>(
          'SELECT id, expo_push_token FROM app_users'
        );
        for (const e of existingTokens) tokenById.set(e.id, e.expo_push_token ?? null);

        const remoteIds = new Set<string>();
        for (const u of appUsersSnap) {
          if (!u?.id) continue;
          const id = String(u.id);
          const pin = u.pin_hash != null ? String(u.pin_hash) : '';
          if (!pin) continue;
          remoteIds.add(id);
          await database.runAsync(
            `INSERT OR REPLACE INTO app_users (id, nom, email, role, pin_hash, actif, created_at, expo_push_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              id,
              String(u.nom ?? ''),
              u.email != null ? String(u.email) : null,
              String(u.role ?? 'technicien'),
              pin,
              u.actif === false || u.actif === 0 ? 0 : 1,
              u.created_at != null ? String(u.created_at) : new Date().toISOString(),
              tokenById.get(id) ?? null,
            ]
          );
        }
        for (const row of existingTokens) {
          if (!remoteIds.has(row.id)) {
            await database.runAsync('DELETE FROM app_users WHERE id = ?', [row.id]);
          }
        }
      }

      await database.execAsync('COMMIT;');
    } catch (e) {
      try {
        await database.execAsync('ROLLBACK;');
      } catch {
        /* ignore */
      }
      throw e;
    }
    try {
      await downloadMissingRegiePhotos(database, ep);
    } catch {
      /* best effort */
    }
    try {
      await downloadMissingMaterielMedia(database, ep);
    } catch {
      /* best effort */
    }
    try {
      await downloadMissingConsommablePhotos(database, ep);
    } catch {
      /* best effort */
    }
    invalidateInventorySnapshotCache();
    return { ok: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'API_SYNC_DISABLED') {
      return { ok: false, error: MSG_API_DISABLED };
    }
    if (msg === 'API_NON_CONFIGUREE') {
      return { ok: false, error: MSG_NO_API };
    }
    if (/network request failed/i.test(msg)) {
      return {
        ok: false,
        error:
          `${msg}\n\nVérifiez la connexion, l’URL dans Réseau ou EXPO_PUBLIC_API_URL, et la clé API si le serveur l’exige (X-API-Key / Bearer).`,
      };
    }
    return { ok: false, error: msg };
  }
}

function uniqueIds(rows: { categorie_id?: string | null; localisation_id?: string | null }[]): {
  cat: string[];
  loc: string[];
} {
  const cat = new Set<string>();
  const loc = new Set<string>();
  for (const r of rows) {
    if (r.categorie_id) cat.add(String(r.categorie_id));
    if (r.localisation_id) loc.add(String(r.localisation_id));
  }
  return { cat: [...cat], loc: [...loc] };
}

export async function syncToInventoryApi(
  endpoint?: InventorySyncEndpoint | null
): Promise<{ ok: boolean; error?: string }> {
  const ep = endpoint ?? null;
  const guard = await canCallApiSync('syncToInventoryApi');
  if (!guard.ok) {
    return { ok: false, error: isLocalBackendDisabledReason(guard.reason) ? MSG_API_DISABLED : MSG_NO_API };
  }
  try {
    const database = await getDB();
    const materielsToSync = await database.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM materiels WHERE synced = 0'
    );
    const consoToSync = await database.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM consommables WHERE synced = 0'
    );
    const pretsToSync = await database.getAllAsync<Record<string, unknown>>('SELECT * FROM prets WHERE synced = 0');

    const { cat: catIds, loc: locIds } = uniqueIds([
      ...materielsToSync,
      ...consoToSync,
    ]);

    const categoriesPayload: Record<string, unknown>[] = [];
    if (catIds.length > 0) {
      const ph = catIds.map(() => '?').join(',');
      const rows = await database.getAllAsync<Record<string, unknown>>(
        `SELECT * FROM categories WHERE id IN (${ph})`,
        catIds
      );
      categoriesPayload.push(...rows);
    }
    const localisationsPayload: Record<string, unknown>[] = [];
    if (locIds.length > 0) {
      const ph = locIds.map(() => '?').join(',');
      const rows = await database.getAllAsync<Record<string, unknown>>(
        `SELECT * FROM localisations WHERE id IN (${ph})`,
        locIds
      );
      localisationsPayload.push(...rows);
    }

    const pretIds = pretsToSync.map(p => String(p.id));
    let pretMaterielsPayload: Record<string, unknown>[] = [];
    if (pretIds.length > 0) {
      const ph = pretIds.map(() => '?').join(',');
      pretMaterielsPayload = await database.getAllAsync<Record<string, unknown>>(
        `SELECT * FROM pret_materiels WHERE pret_id IN (${ph})`,
        pretIds
      );
    }

    const sessionRole = await getSessionAppUserRole();
    let appUsersPayload: Record<string, unknown>[] = [];
    if (sessionRole === 'admin') {
      const allUsers = await database.getAllAsync<Record<string, unknown>>('SELECT * FROM app_users');
      appUsersPayload = allUsers.map(u => ({
        id: u.id,
        nom: u.nom,
        email: u.email ?? null,
        role: u.role,
        pin_hash: u.pin_hash,
        actif: u.actif,
        created_at: u.created_at,
      }));
    }

    try {
      await uploadPendingMaterielMedia(database);
      await uploadPendingConsommablePhotos(database);
    } catch {
      /* best effort */
    }
    const materielsForPush = await database.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM materiels WHERE synced = 0'
    );
    const materielsPayload = materielsForPush.map(m => ({
      ...m,
      photo_local: null,
      notice_pdf_local: null,
      notice_photo_local: null,
      synced: true,
    }));
    const consosForPush = await database.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM consommables WHERE synced = 0'
    );
    const consommablesPayload = consosForPush.map(c => ({ ...c, photo_local: null, synced: true }));
    const pretsPayload = pretsToSync.map(p => ({ ...p, synced: true }));
    const regiePayload = await loadRegiePushPayload(database, 'unsynced');
    const inventoryDeletions = await loadPendingInventoryDeletions();

    if (
      materielsPayload.length === 0 &&
      consommablesPayload.length === 0 &&
      pretsPayload.length === 0 &&
      categoriesPayload.length === 0 &&
      localisationsPayload.length === 0 &&
      appUsersPayload.length === 0 &&
      inventoryDeletions.length === 0 &&
      regiePayloadIsEmpty(regiePayload)
    ) {
      return { ok: true };
    }

    if (!(await isEndpointConfigured(ep))) {
      return { ok: false, error: MSG_NO_API };
    }

    const body = {
      categories: categoriesPayload,
      localisations: localisationsPayload,
      materiels: materielsPayload,
      consommables: consommablesPayload,
      prets: pretsPayload,
      pret_materiels: pretMaterielsPayload,
      app_users: appUsersPayload,
      inventory_deletions: inventoryDeletions,
      ...regiePayload,
    };

    const res = await inventoryApiFetch(
      '/api/sync/bulk',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      ep
    );
    const respText = await res.text();
    if (!res.ok) {
      return { ok: false, error: formatSyncHttpError(res.status, respText) };
    }

    await database.execAsync('BEGIN IMMEDIATE;');
    try {
      const markSynced = async (table: string, ids: string[]) => {
        if (ids.length === 0) return;
        const ph = ids.map(() => '?').join(',');
        await database.runAsync(`UPDATE ${table} SET synced = 1 WHERE id IN (${ph})`, ids);
      };
      await markSynced(
        'materiels',
        materielsToSync.map(m => String(m.id))
      );
      await markSynced(
        'consommables',
        consoToSync.map(c => String(c.id))
      );
      await markSynced(
        'prets',
        pretsToSync.map(p => String(p.id))
      );
      await markRegieSynced(database, 'unsynced');
      await clearPendingInventoryDeletions();
      await clearRegieDeletionsAfterPush();
      await database.execAsync('COMMIT;');
    } catch (e) {
      try {
        await database.execAsync('ROLLBACK;');
      } catch {
        /* ignore */
      }
      return {
        ok: false,
        error:
          e instanceof Error
            ? e.message
            : 'Erreur locale après envoi réussi : marquage synced — vérifiez la base.',
      };
    }

    try {
      await uploadPendingRegiePhotos(database, ep);
    } catch {
      /* best effort */
    }
    try {
      await uploadPendingMaterielMedia(database);
      await uploadPendingConsommablePhotos(database);
    } catch {
      /* best effort */
    }

    return { ok: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'API_SYNC_DISABLED') {
      return { ok: false, error: MSG_API_DISABLED };
    }
    if (msg === 'API_NON_CONFIGUREE') {
      return { ok: false, error: MSG_NO_API };
    }
    if (/network request failed/i.test(msg)) {
      return {
        ok: false,
        error:
          `${msg}\n\nVérifiez la connexion, l’URL API, et X-API-Key / Bearer (EXPO_PUBLIC_API_KEY ou onglet Réseau).`,
      };
    }
    return { ok: false, error: msg };
  }
}

/**
 * Envoie tout l’inventaire local vers le serveur (pas seulement les lignes `synced = 0`).
 * Utile pour aligner un cloud / un PC après import manuel ou pour une première montée.
 */
export async function pushFullInventoryToApi(
  endpoint?: InventorySyncEndpoint | null
): Promise<{ ok: boolean; error?: string }> {
  const ep = endpoint ?? null;
  const guard = await canCallApiSync('pushFullInventoryToApi');
  if (!guard.ok) {
    return { ok: false, error: isLocalBackendDisabledReason(guard.reason) ? MSG_API_DISABLED : MSG_NO_API };
  }
  if (!(await isEndpointConfigured(ep))) {
    return { ok: false, error: MSG_NO_API };
  }
  try {
    const database = await getDB();
    const materielsToSync = await database.getAllAsync<Record<string, unknown>>('SELECT * FROM materiels');
    const consoToSync = await database.getAllAsync<Record<string, unknown>>('SELECT * FROM consommables');
    const pretsToSync = await database.getAllAsync<Record<string, unknown>>('SELECT * FROM prets');

    const { cat: catIds, loc: locIds } = uniqueIds([...materielsToSync, ...consoToSync]);

    const categoriesPayload: Record<string, unknown>[] = [];
    if (catIds.length > 0) {
      const ph = catIds.map(() => '?').join(',');
      categoriesPayload.push(
        ...(await database.getAllAsync<Record<string, unknown>>(
          `SELECT * FROM categories WHERE id IN (${ph})`,
          catIds
        ))
      );
    }
    const localisationsPayload: Record<string, unknown>[] = [];
    if (locIds.length > 0) {
      const ph = locIds.map(() => '?').join(',');
      localisationsPayload.push(
        ...(await database.getAllAsync<Record<string, unknown>>(
          `SELECT * FROM localisations WHERE id IN (${ph})`,
          locIds
        ))
      );
    }

    const pretIds = pretsToSync.map(p => String(p.id));
    let pretMaterielsPayload: Record<string, unknown>[] = [];
    if (pretIds.length > 0) {
      const ph = pretIds.map(() => '?').join(',');
      pretMaterielsPayload = await database.getAllAsync<Record<string, unknown>>(
        `SELECT * FROM pret_materiels WHERE pret_id IN (${ph})`,
        pretIds
      );
    }

    const sessionRole = await getSessionAppUserRole();
    let appUsersPayload: Record<string, unknown>[] = [];
    if (sessionRole === 'admin') {
      const allUsers = await database.getAllAsync<Record<string, unknown>>('SELECT * FROM app_users');
      appUsersPayload = allUsers.map(u => ({
        id: u.id,
        nom: u.nom,
        email: u.email ?? null,
        role: u.role,
        pin_hash: u.pin_hash,
        actif: u.actif,
        created_at: u.created_at,
      }));
    }

    try {
      await uploadPendingMaterielMedia(database);
      await uploadPendingConsommablePhotos(database);
    } catch {
      /* best effort */
    }
    const materielsForPush = await database.getAllAsync<Record<string, unknown>>('SELECT * FROM materiels');
    const materielsPayload = materielsForPush.map(m => ({
      ...m,
      photo_local: null,
      notice_pdf_local: null,
      notice_photo_local: null,
      synced: true,
    }));
    const consosForPush = await database.getAllAsync<Record<string, unknown>>('SELECT * FROM consommables');
    const consommablesPayload = consosForPush.map(c => ({ ...c, photo_local: null, synced: true }));
    const pretsPayload = pretsToSync.map(p => ({ ...p, synced: true }));
    const regiePayload = await loadRegiePushPayload(database, 'full');
    const inventoryDeletions = await loadPendingInventoryDeletions();

    if (
      materielsPayload.length === 0 &&
      consommablesPayload.length === 0 &&
      pretsPayload.length === 0 &&
      categoriesPayload.length === 0 &&
      localisationsPayload.length === 0 &&
      appUsersPayload.length === 0 &&
      inventoryDeletions.length === 0 &&
      regiePayloadIsEmpty(regiePayload)
    ) {
      return { ok: true };
    }

    const body = {
      categories: categoriesPayload,
      localisations: localisationsPayload,
      materiels: materielsPayload,
      consommables: consommablesPayload,
      prets: pretsPayload,
      pret_materiels: pretMaterielsPayload,
      app_users: appUsersPayload,
      inventory_deletions: inventoryDeletions,
      ...regiePayload,
    };

    const res = await inventoryApiFetch(
      '/api/sync/bulk',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      ep
    );
    const respText = await res.text();
    if (!res.ok) {
      return { ok: false, error: formatSyncHttpError(res.status, respText) };
    }

    await database.execAsync('BEGIN IMMEDIATE;');
    try {
      await database.execAsync('UPDATE materiels SET synced = 1');
      await database.execAsync('UPDATE consommables SET synced = 1');
      await database.execAsync('UPDATE prets SET synced = 1');
      await markRegieSynced(database, 'full');
      await clearPendingInventoryDeletions();
      await clearRegieDeletionsAfterPush();
      await database.execAsync('COMMIT;');
    } catch (e) {
      try {
        await database.execAsync('ROLLBACK;');
      } catch {
        /* ignore */
      }
      return {
        ok: false,
        error:
          e instanceof Error
            ? e.message
            : 'Erreur locale après envoi : marquage synced.',
      };
    }

    try {
      await uploadPendingRegiePhotos(database, ep);
    } catch {
      /* best effort */
    }
    try {
      await uploadPendingMaterielMedia(database);
      await uploadPendingConsommablePhotos(database);
    } catch {
      /* best effort */
    }

    return { ok: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'API_SYNC_DISABLED') {
      return { ok: false, error: MSG_API_DISABLED };
    }
    if (msg === 'API_NON_CONFIGUREE') {
      return { ok: false, error: MSG_NO_API };
    }
    if (/network request failed/i.test(msg)) {
      return {
        ok: false,
        error:
          `${msg}\n\nVérifiez la connexion, l’URL API, et X-API-Key / Bearer (EXPO_PUBLIC_API_KEY ou onglet Réseau).`,
      };
    }
    return { ok: false, error: msg };
  }
}

/**
 * Téléversement / téléchargement des photos consommable (Supabase Storage ou URL distante).
 */
import * as FileSystem from 'expo-file-system/legacy';
import type { SqliteDb } from '../db/coreDb';
import type { InventorySyncEndpoint } from './inventoryApiSync';
import { getResolvedApiBase } from '../config/stageStockApi';
import { stripStageStockServerRootSuffix } from './apiEndpointStorage';
import { buildServerAuthHeaders } from './serverAuthHeaders';
import { isSupabaseConfigured, uploadConsommablePhoto } from './supabase';
import {
  consommablePhotoFileExists,
  persistConsommablePhotoCopy,
} from './consommablePhotoStorage';
import { getDataBackendMode } from './backendMode';
import { uploadInventoryMediaToLocalServer } from './inventoryLocalMediaUpload';

function joinApiUrl(base: string, path: string): string {
  const b = stripStageStockServerRootSuffix(base.replace(/\/+$/, ''));
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}

async function downloadConsommablePhotoFromUrl(args: {
  consommableId: string;
  photoUrl: string;
  endpoint?: InventorySyncEndpoint | null;
}): Promise<string> {
  const photoUrl = args.photoUrl.trim();
  let url: string;
  let headers: Record<string, string> = {};

  if (/^https?:\/\//i.test(photoUrl)) {
    url = photoUrl;
  } else {
    const base = args.endpoint?.baseUrl?.trim()
      ? args.endpoint.baseUrl.trim().replace(/\/+$/, '')
      : ((await getResolvedApiBase()) ?? '').replace(/\/+$/, '');
    if (!base) throw new Error('API non configurée pour télécharger la photo.');
    const rel = photoUrl.startsWith('/') ? photoUrl : `/${photoUrl}`;
    url = joinApiUrl(base, rel);
    headers = await buildServerAuthHeaders();
  }

  const root = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!root) throw new Error('Cache indisponible.');
  const tmp = `${root}conso-dl-${args.consommableId}.jpg`;
  const result = await FileSystem.downloadAsync(url, tmp, { headers });
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Téléchargement photo HTTP ${result.status}`);
  }
  return persistConsommablePhotoCopy(args.consommableId, result.uri);
}

/** Téléverse les photos locales sans URL distante (avant push inventaire). */
export async function uploadPendingConsommablePhotos(database: SqliteDb): Promise<void> {
  const mode = await getDataBackendMode();
  const useSupabase = mode === 'supabase' && isSupabaseConfigured();
  const useLocal = mode === 'local_server' || (!useSupabase && !isSupabaseConfigured());
  if (!useSupabase && !useLocal) return;

  const rows = await database.getAllAsync<{
    id: string;
    photo_local: string | null;
    photo_url: string | null;
  }>(
    `SELECT id, photo_local, photo_url FROM consommables
     WHERE photo_local IS NOT NULL AND TRIM(photo_local) LIKE 'file://%'
       AND (photo_url IS NULL OR TRIM(photo_url) = '')`
  );

  for (const row of rows) {
    const local = row.photo_local?.trim();
    if (!local) continue;
    if (!(await consommablePhotoFileExists(local))) continue;
    try {
      const photoUrl = useSupabase
        ? await uploadConsommablePhoto(local, String(row.id))
        : await uploadInventoryMediaToLocalServer({
            kind: 'consommable-photo',
            entityId: String(row.id),
            localUri: local,
          });
      if (!photoUrl) continue;
      await database.runAsync(
        'UPDATE consommables SET photo_url = ?, updated_at = ? WHERE id = ?',
        [photoUrl, new Date().toISOString(), String(row.id)]
      );
    } catch {
      /* retenter au prochain envoi */
    }
  }
}

/** Télécharge les photos distantes manquantes ou fichier local absent. */
export async function downloadMissingConsommablePhotos(
  database: SqliteDb,
  endpoint?: InventorySyncEndpoint | null
): Promise<void> {
  const rows = await database.getAllAsync<{
    id: string;
    photo_local: string | null;
    photo_url: string | null;
  }>(
    `SELECT id, photo_local, photo_url FROM consommables
     WHERE photo_url IS NOT NULL AND TRIM(photo_url) != ''`
  );

  for (const row of rows) {
    const photoUrl = row.photo_url?.trim();
    if (!photoUrl) continue;
    const local = row.photo_local?.trim() ?? '';
    if (local.startsWith('file://') && (await consommablePhotoFileExists(local))) continue;
    try {
      const dest = await downloadConsommablePhotoFromUrl({
        consommableId: String(row.id),
        photoUrl,
        endpoint,
      });
      await database.runAsync(
        'UPDATE consommables SET photo_local = ?, updated_at = ? WHERE id = ?',
        [dest, new Date().toISOString(), String(row.id)]
      );
    } catch {
      /* retenter au prochain pull */
    }
  }
}

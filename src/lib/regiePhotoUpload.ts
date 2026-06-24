/**
 * Téléversement / téléchargement des photos de mise technique (serveur local ou Supabase Storage).
 */
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import type { InventorySyncEndpoint } from './inventoryApiSync';
import { accueilProMultipartFetch } from './accueilProMultipart';
import { getResolvedApiBase } from '../config/stageStockApi';
import { stripStageStockServerRootSuffix } from './apiEndpointStorage';
import { buildServerAuthHeaders } from './serverAuthHeaders';
import { persistPositionPhotoCopy } from './miseTechniquePhotoStorage';
import { getDataBackendMode } from './backendMode';
import { getSupabase, isSupabaseConfigured } from './supabase';

const REGIE_STORAGE_BUCKET = 'photos';

function normalizedAssetUri(uri: string): string {
  if (!uri) return uri;
  if (Platform.OS === 'android') return uri;
  return uri;
}

function joinApiUrl(base: string, path: string): string {
  const b = stripStageStockServerRootSuffix(base.replace(/\/+$/, ''));
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}

function regieStoragePath(photoId: string, ext: string): string {
  return `regie/${photoId}.${ext}`;
}

async function uploadRegiePositionPhotoSupabase(args: {
  photoId: string;
  localUri: string;
}): Promise<string> {
  const uri = normalizedAssetUri(args.localUri);
  const ext = /\.png$/i.test(uri) ? 'png' : 'jpg';
  const path = regieStoragePath(args.photoId, ext);
  const sb = getSupabase();
  const response = await fetch(uri);
  const blob = await response.blob();
  const { error } = await sb.storage
    .from(REGIE_STORAGE_BUCKET)
    .upload(path, blob, { upsert: true, contentType: ext === 'png' ? 'image/png' : 'image/jpeg' });
  if (error) throw new Error(`Upload Supabase : ${error.message}`);
  return sb.storage.from(REGIE_STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** POST multipart (serveur local) ou Storage Supabase — retourne l’URL distante. */
export async function uploadRegiePositionPhoto(args: {
  photoId: string;
  localUri: string;
  endpoint?: InventorySyncEndpoint | null;
}): Promise<string> {
  const uri = normalizedAssetUri(args.localUri);
  if (!uri.startsWith('file://')) {
    throw new Error('URI locale attendue pour upload photo Régie.');
  }

  const mode = await getDataBackendMode();
  if (mode === 'supabase' && isSupabaseConfigured()) {
    return uploadRegiePositionPhotoSupabase({ photoId: args.photoId, localUri: uri });
  }
  const ext = /\.png$/i.test(uri) ? 'png' : 'jpg';
  const form = new FormData();
  form.append(
    'photo',
    { uri, type: ext === 'png' ? 'image/png' : 'image/jpeg', name: `${args.photoId}.${ext}` } as unknown as Blob
  );
  const path = `/api/regie/position-photos/${encodeURIComponent(args.photoId)}/upload`;
  const res = await accueilProMultipartFetch(path, { method: 'POST', body: form }, args.endpoint ?? null, `regiePhoto:${args.photoId}`);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Upload photo Régie HTTP ${res.status}: ${text.slice(0, 280)}`);
  }
  let json: { photo_url?: string };
  try {
    json = JSON.parse(text) as { photo_url?: string };
  } catch {
    throw new Error('Réponse upload photo Régie invalide.');
  }
  const url = json.photo_url?.trim();
  if (!url) throw new Error('photo_url absent après upload.');
  return url;
}

/** Télécharge une photo distante (URL Supabase ou chemin API local) vers le stockage persistant. */
export async function downloadRegiePositionPhoto(args: {
  photoId: string;
  positionId: string;
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
  const tmp = `${root}regie-dl-${args.photoId}.jpg`;
  const result = await FileSystem.downloadAsync(url, tmp, { headers });
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Téléchargement photo HTTP ${result.status}`);
  }
  return persistPositionPhotoCopy(args.positionId, result.uri);
}

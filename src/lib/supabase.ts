// src/lib/supabase.ts
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type PostgrestError, type SupabaseClient } from '@supabase/supabase-js';
import {
  loadSupabaseOverride,
  saveSupabaseOverride,
  clearSupabaseOverride,
  type SupabaseOverride,
} from './supabaseConfigStorage';
import type { Materiel } from '../types';

const buildUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const buildAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

const PLACEHOLDER_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.placeholder-signature';

let client: SupabaseClient;
let effectiveConfigured = false;
/** True when l'utilisateur a une config sur l'appareil (remplace le .env du build). */
let userOverrideActive = false;
let cachedDisplayUrl = '';
let cachedEffectiveAnonKey = '';

type ClientListener = () => void;
const clientListeners = new Set<ClientListener>();

export function onSupabaseClientReplaced(cb: ClientListener): () => void {
  clientListeners.add(cb);
  return () => clientListeners.delete(cb);
}

function emitClientsReplaced() {
  clientListeners.forEach(cb => cb());
}

function applyResolvedConfig(override: SupabaseOverride | null) {
  const url = override?.url ?? buildUrl ?? '';
  const anonKey = override?.anonKey ?? buildAnonKey ?? '';
  effectiveConfigured = Boolean(url && anonKey);
  userOverrideActive = Boolean(override?.url && override?.anonKey);
  cachedDisplayUrl = effectiveConfigured ? url : '';
  cachedEffectiveAnonKey = effectiveConfigured ? anonKey : '';

  client = createClient(
    effectiveConfigured ? url : PLACEHOLDER_URL,
    effectiveConfigured ? anonKey : PLACEHOLDER_KEY,
    {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: effectiveConfigured,
        persistSession: effectiveConfigured,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
    }
  );
}

applyResolvedConfig(null);

/** Client Supabase courant (projet = build et/ou surcharge stockée sur l'appareil). */
export function getSupabase(): SupabaseClient {
  return client;
}

/** À appeler au démarrage après lecture du stockage (surcharge utilisateur). */
export async function initSupabaseFromStorage(): Promise<void> {
  const o = await loadSupabaseOverride();
  applyResolvedConfig(o);
}

async function resolveAnonKeyForSave(url: string, anonKey: string): Promise<string> {
  const k = anonKey.trim();
  if (k) return k;
  const u = url.trim();
  const o = await loadSupabaseOverride();
  if (o && o.url.trim() === u) return o.anonKey;
  const bu = buildUrl ?? '';
  const bk = buildAnonKey ?? '';
  if (u === bu && bk) return bk;
  throw new Error("Clé anon requise (collez la clé du projet si vous changez d'URL).");
}

/**
 * Enregistre URL + clé anon sur l'appareil et recrée le client (déconnexion session courante).
 * Si la clé est vide, réutilise la clé déjà stockée pour la même URL ou celle du build (.env).
 */
export async function saveAndApplySupabaseConfig(url: string, anonKey: string): Promise<void> {
  const u = url.trim();
  if (!u) {
    throw new Error('URL du projet requise.');
  }
  const k = await resolveAnonKeyForSave(u, anonKey);
  try {
    await getSupabase().auth.signOut();
  } catch {
    /* ignore */
  }
  await saveSupabaseOverride({ url: u, anonKey: k });
  applyResolvedConfig({ url: u, anonKey: k });
  emitClientsReplaced();
  const { setDataBackendMode } = await import('./backendMode');
  await setDataBackendMode('supabase');
}

/** Supprime la surcharge locale et revient à la config du build (.env / EAS). */
export async function clearStoredSupabaseOverrideAndReapply(): Promise<void> {
  try {
    await getSupabase().auth.signOut();
  } catch {
    /* ignore */
  }
  await clearSupabaseOverride();
  const o = await loadSupabaseOverride();
  applyResolvedConfig(o);
  emitClientsReplaced();
}

export function hasSupabaseUserOverride(): boolean {
  return userOverrideActive;
}

/** URL du projet effectivement utilisée (jamais la clé). */
export function getEffectiveSupabaseUrlForDisplay(): string {
  return cachedDisplayUrl;
}

/** Config effective (staff) pour QR / lien d’invitation — ne pas logger la clé. */
export async function getEffectiveSupabaseConfigForShare(): Promise<SupabaseOverride | null> {
  if (!effectiveConfigured) return null;
  const url = cachedDisplayUrl.trim();
  if (!url) return null;
  const stored = await loadSupabaseOverride();
  if (stored?.url && stored.anonKey) return stored;
  if (buildUrl && buildAnonKey && url === buildUrl.trim()) {
    return { url: buildUrl.trim(), anonKey: buildAnonKey.trim() };
  }
  if (cachedEffectiveAnonKey) return { url, anonKey: cachedEffectiveAnonKey };
  return null;
}

/**
 * Wrapper de requête Supabase : logs homogènes + retour structuré.
 */
export async function runSupabaseQuery<T>(
  label: string,
  executor: () => Promise<{ data: T | null; error: PostgrestError | null }>
): Promise<{ ok: boolean; data: T | null; error: PostgrestError | null }> {
  try {
    const { data, error } = await executor();
    if (error) {
      console.log(`[supabase] ${label} error:`, error);
      return { ok: false, data, error };
    }
    return { ok: true, data, error: null };
  } catch (e) {
    console.log(`[supabase] ${label} exception:`, e);
    return { ok: false, data: null, error: null };
  }
}

/**
 * Exemple de requête relationnelle optimisée (stocks + matériel + lieu).
 * Adaptez les alias/relations selon vos FK côté Supabase.
 */
export async function getStocksWithMaterielsAndLieux(): Promise<{
  ok: boolean;
  data: Record<string, unknown>[] | null;
  error: PostgrestError | null;
}> {
  if (!effectiveConfigured) {
    return { ok: false, data: null, error: null };
  }
  return runSupabaseQuery<Record<string, unknown>[]>(
    'getStocksWithMaterielsAndLieux',
    async () =>
      getSupabase()
        .from('stocks')
        .select(
          `
          id,
          quantite,
          updated_at,
          materiel:materiels(id, nom, numero_serie, categorie_id),
          lieu:lieux(id, nom)
        `
        )
        .order('updated_at', { ascending: false })
  );
}

// ═══════════════════════════════════════════════════════════════════
// SYNC : inventaire + Régie (supabaseMobileSync.ts)
// ═══════════════════════════════════════════════════════════════════

const STORAGE_BUCKET = 'photos';

/** True si un projet Supabase est utilisable (build et/ou config sur l'appareil). */
export const isSupabaseConfigured = (): boolean => effectiveConfigured;

/** URL projet Supabase figée au build uniquement (diagnostic ; ne pas logger la clé). */
export const getSupabaseProjectUrlFromBuild = (): string => buildUrl ?? '';

export { syncToSupabase, syncFromSupabase } from './supabaseMobileSync';

export const uploadPhoto = async (localUri: string, materielId: string): Promise<string | null> => {
  try {
    const ext = localUri.split('.').pop() ?? 'jpg';
    const path = `materiels/${materielId}.${ext}`;
    const sb = getSupabase();

    const response = await fetch(localUri);
    const blob = await response.blob();

    const { error } = await sb.storage
      .from(STORAGE_BUCKET)
      .upload(path, blob, { upsert: true, contentType: `image/${ext}` });

    if (error) return null;

    const { data } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  } catch {
    return null;
  }
};

export const uploadConsommablePhoto = async (
  localUri: string,
  consommableId: string
): Promise<string | null> => {
  try {
    const ext = localUri.split('.').pop() ?? 'jpg';
    const path = `consommables/${consommableId}.${ext}`;
    const sb = getSupabase();
    const response = await fetch(localUri);
    const blob = await response.blob();
    const { error } = await sb.storage
      .from(STORAGE_BUCKET)
      .upload(path, blob, { upsert: true, contentType: `image/${ext}` });
    if (error) return null;
    const { data } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  } catch {
    return null;
  }
};

const noticePdfStoragePath = (materielId: string) => `notices/${materielId}.pdf`;
const noticePhotoStoragePath = (materielId: string) => `notices/${materielId}_scan.jpg`;

async function uploadBlobToPhotos(
  localUri: string,
  path: string,
  contentType: string
): Promise<string | null> {
  try {
    const sb = getSupabase();
    const response = await fetch(localUri);
    const blob = await response.blob();
    const { error } = await sb.storage
      .from(STORAGE_BUCKET)
      .upload(path, blob, { upsert: true, contentType });
    if (error) return null;
    return sb.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
  } catch {
    return null;
  }
}

export async function pushMaterielNoticesToSupabaseAfterSave(
  materielId: string,
  localPatch: Partial<Pick<Materiel, 'notice_pdf_local' | 'notice_photo_local'>>
): Promise<Partial<Pick<Materiel, 'notice_pdf_url' | 'notice_photo_url'>>> {
  if (!isSupabaseConfigured()) return {};
  const sb = getSupabase();
  const out: Partial<Pick<Materiel, 'notice_pdf_url' | 'notice_photo_url'>> = {};

  if ('notice_pdf_local' in localPatch) {
    if (localPatch.notice_pdf_local) {
      const url = await uploadBlobToPhotos(
        localPatch.notice_pdf_local,
        noticePdfStoragePath(materielId),
        'application/pdf'
      );
      if (url) out.notice_pdf_url = url;
    } else {
      await sb.storage
        .from(STORAGE_BUCKET)
        .remove([noticePdfStoragePath(materielId)])
        .catch(() => {});
      out.notice_pdf_url = null;
    }
  }

  if ('notice_photo_local' in localPatch) {
    if (localPatch.notice_photo_local) {
      const url = await uploadBlobToPhotos(
        localPatch.notice_photo_local,
        noticePhotoStoragePath(materielId),
        'image/jpeg'
      );
      if (url) out.notice_photo_url = url;
    } else {
      await sb.storage
        .from(STORAGE_BUCKET)
        .remove([noticePhotoStoragePath(materielId)])
        .catch(() => {});
      out.notice_photo_url = null;
    }
  }

  return out;
}

export async function removeMaterielNoticesFromRemoteStorage(materielId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const sb = getSupabase();
  await sb.storage
    .from(STORAGE_BUCKET)
    .remove([noticePdfStoragePath(materielId), noticePhotoStoragePath(materielId)])
    .catch(() => {});
}

// src/lib/supabase.ts
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  loadSupabaseOverride,
  saveSupabaseOverride,
  clearSupabaseOverride,
  type SupabaseOverride,
} from './supabaseConfigStorage';
import { getDB } from '../db/database';
import type { Materiel } from '../types';

const buildUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const buildAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

const PLACEHOLDER_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.placeholder-signature';

let client: SupabaseClient;
let effectiveConfigured = false;
/** True when l’utilisateur a une config sur l’appareil (remplace le .env du build). */
let userOverrideActive = false;
let cachedDisplayUrl = '';

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

/** Client Supabase courant (projet = build et/ou surcharge stockée sur l’appareil). */
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
  throw new Error('Clé anon requise (collez la clé du projet si vous changez d’URL).');
}

/**
 * Enregistre URL + clé anon sur l’appareil et recrée le client (déconnexion session courante).
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

// ═══════════════════════════════════════════════════════════════════
// SYNC : pousse les données locales non-syncées vers Supabase
// ═══════════════════════════════════════════════════════════════════

const STORAGE_BUCKET = 'photos';

/** True si un projet Supabase est utilisable (build et/ou config sur l’appareil). */
export const isSupabaseConfigured = (): boolean => effectiveConfigured;

/** URL projet Supabase figée au build uniquement (diagnostic ; ne pas logger la clé). */
export const getSupabaseProjectUrlFromBuild = (): string => buildUrl ?? '';

const MSG_SUPABASE_MANQUE =
  'Supabase n’est pas configuré. Renseignez l’URL du projet et la clé anon (Paramètres → Projet Supabase sur cet appareil), ' +
  'ou définissez EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY au build (EAS).';

function formatSyncError(e: unknown): string {
  const raw =
    e instanceof Error
      ? e.message
      : e && typeof e === 'object' && 'message' in e
        ? String((e as { message: unknown }).message)
        : String(e);
  if (/network request failed/i.test(raw)) {
    return (
      `${raw}\n\n` +
      'Causes fréquentes :\n' +
      '• Projet Supabase non configuré sur l’appareil ou variables EAS absentes.\n' +
      '• Téléphone hors ligne, Wi‑Fi invité qui bloque les API, VPN ou DNS privé (ex. « DNS privé » Android) qui bloque supabase.co.\n' +
      '• Projet Supabase en pause (gratuit) : réactiver sur supabase.com.\n' +
      '• URL incorrecte (faute de frappe, espaces).'
    );
  }
  return raw;
}

/** Lignes matériel pour Postgres : pas de chemins locaux (spécifiques à l’appareil). */
function materielRowForRemote(m: Record<string, unknown>) {
  return {
    ...m,
    photo_local: null,
    notice_pdf_local: null,
    notice_photo_local: null,
    synced: true,
  };
}

export const syncToSupabase = async (): Promise<{ ok: boolean; error?: string }> => {
  if (!effectiveConfigured) {
    return { ok: false, error: MSG_SUPABASE_MANQUE };
  }
  try {
    const database = await getDB();
    const sb = getSupabase();

    const materielsToSync = await database.getAllAsync<any>(
      'SELECT * FROM materiels WHERE synced = 0'
    );
    if (materielsToSync.length > 0) {
      const { error } = await sb
        .from('materiels')
        .upsert(materielsToSync.map(m => materielRowForRemote(m)));
      if (!error) {
        await database.runAsync("UPDATE materiels SET synced = 1 WHERE synced = 0");
      }
    }

    const consoToSync = await database.getAllAsync<any>(
      'SELECT * FROM consommables WHERE synced = 0'
    );
    if (consoToSync.length > 0) {
      const { error } = await sb
        .from('consommables')
        .upsert(consoToSync.map(c => ({ ...c, synced: true })));
      if (!error) {
        await database.runAsync("UPDATE consommables SET synced = 1 WHERE synced = 0");
      }
    }

    const pretsToSync = await database.getAllAsync<any>(
      'SELECT * FROM prets WHERE synced = 0'
    );
    if (pretsToSync.length > 0) {
      const { error } = await sb
        .from('prets')
        .upsert(pretsToSync.map(p => ({ ...p, synced: true })));
      if (!error) {
        await database.runAsync("UPDATE prets SET synced = 1 WHERE synced = 0");
      }
    }

    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: formatSyncError(e) };
  }
};

export const syncFromSupabase = async (): Promise<{ ok: boolean; error?: string }> => {
  if (!effectiveConfigured) {
    return { ok: false, error: MSG_SUPABASE_MANQUE };
  }
  try {
    const database = await getDB();
    const sb = getSupabase();

    const { data: materiels, error: e1 } = await sb
      .from('materiels')
      .select('*')
      .order('updated_at', { ascending: false });

    if (e1) throw e1;
    if (materiels) {
      for (const m of materiels) {
        await database.runAsync(
          `
          INSERT OR REPLACE INTO materiels (
            id, nom, type, marque, numero_serie, poids_kg, categorie_id, localisation_id,
            etat, statut, date_achat, date_validite, prochain_controle, intervalle_controle_jours,
            maintenance_todo, maintenance_last_comment,
            technicien, qr_code, nfc_tag_id, photo_url, photo_local,
            notice_pdf_local, notice_photo_local, notice_pdf_url, notice_photo_url,
            vgp_actif, vgp_periodicite_jours, vgp_derniere_visite, vgp_libelle, vgp_epi,
            created_at, updated_at, synced
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `,
          [
            m.id,
            m.nom ?? null,
            m.type ?? null,
            m.marque ?? null,
            m.numero_serie ?? null,
            m.poids_kg ?? null,
            m.categorie_id ?? null,
            m.localisation_id ?? null,
            m.etat ?? 'bon',
            m.statut ?? 'en stock',
            m.date_achat ?? null,
            m.date_validite ?? null,
            m.prochain_controle ?? null,
            m.intervalle_controle_jours ?? null,
            (m as any).maintenance_todo ?? null,
            (m as any).maintenance_last_comment ?? null,
            m.technicien ?? null,
            m.qr_code ?? null,
            m.nfc_tag_id ?? null,
            m.photo_url ?? null,
            null,
            null,
            null,
            m.notice_pdf_url ?? null,
            m.notice_photo_url ?? null,
            m.vgp_actif != null ? (m.vgp_actif ? 1 : 0) : 0,
            m.vgp_periodicite_jours ?? null,
            m.vgp_derniere_visite ?? null,
            m.vgp_libelle ?? null,
            (m as any).vgp_epi != null ? ((m as any).vgp_epi ? 1 : 0) : 0,
            m.created_at ?? new Date().toISOString(),
            m.updated_at ?? new Date().toISOString(),
          ]
        );
      }
    }

    const { data: consommables, error: e2 } = await sb.from('consommables').select('*');
    if (e2) throw e2;
    if (consommables) {
      for (const c of consommables) {
        const row = c as Record<string, unknown>;
        await database.runAsync(
          `
          INSERT OR REPLACE INTO consommables (
            id, nom, reference, unite, stock_actuel, seuil_minimum,
            categorie_id, localisation_id, fournisseur, prix_unitaire, qr_code, nfc_tag_id,
            photo_local, photo_url, gel_brand, gel_code, gel_instead_of_photo,
            created_at, updated_at, synced
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
          [
            c.id,
            c.nom,
            c.reference ?? null,
            c.unite ?? 'pièce',
            c.stock_actuel ?? 0,
            c.seuil_minimum ?? 5,
            c.categorie_id ?? null,
            c.localisation_id ?? null,
            c.fournisseur ?? null,
            c.prix_unitaire ?? null,
            c.qr_code ?? null,
            c.nfc_tag_id ?? null,
            null,
            row.photo_url != null ? String(row.photo_url) : null,
            row.gel_brand != null ? String(row.gel_brand) : null,
            row.gel_code != null ? String(row.gel_code) : null,
            row.gel_instead_of_photo != null ? ((row.gel_instead_of_photo as number) ? 1 : 0) : 0,
            c.created_at ?? new Date().toISOString(),
            c.updated_at ?? new Date().toISOString(),
            1,
          ]
        );
      }
    }

    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: formatSyncError(e) };
  }
};

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

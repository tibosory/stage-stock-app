/**
 * Identité du lieu (théâtre, adresse, logo) + coordonnées admin — sync Supabase.
 * Une ligne partagée par projet (`id = default`).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import {
  loadTheatreBranding,
  saveTheatreIdentity,
  storePickedLogoFile,
  clearTheatreLogo,
} from './theatreBranding';
import { loadUserProfile, saveUserProfile, type UserProfile } from './userProfileStorage';
import { getSupabase, isSupabaseConfigured } from './supabase';
import { canCallSupabaseSync } from './syncGuards';

const ROW_ID = 'default';
const META_UPDATED = 'stagestock_workspace_settings_updated_at';
const META_DIRTY = 'stagestock_workspace_settings_dirty';
const META_REMOTE_LOGO = 'stagestock_workspace_settings_remote_logo_url';
const LOGO_STORAGE_PATH = 'workspace/theatre_logo.jpg';

export type WorkspaceSettingsRemote = {
  id: string;
  theatre_name: string;
  theatre_address: string;
  logo_url: string | null;
  contact_prenom: string;
  contact_nom: string;
  contact_telephone: string;
  contact_email: string;
  contact_fonction: string;
  contact_etablissement: string;
  updated_at: string;
};

async function getLocalUpdatedAt(): Promise<string> {
  const raw = await AsyncStorage.getItem(META_UPDATED);
  if (raw && !Number.isNaN(Date.parse(raw))) return raw;
  return new Date(0).toISOString();
}

async function isLocalDirty(): Promise<boolean> {
  return (await AsyncStorage.getItem(META_DIRTY)) === '1';
}

export async function markWorkspaceSettingsDirty(): Promise<void> {
  await AsyncStorage.multiSet([
    [META_DIRTY, '1'],
    [META_UPDATED, new Date().toISOString()],
  ]);
}

async function markWorkspaceSettingsSynced(updatedAt: string): Promise<void> {
  await AsyncStorage.multiSet([
    [META_DIRTY, '0'],
    [META_UPDATED, updatedAt],
  ]);
}

async function buildLocalPayload(): Promise<WorkspaceSettingsRemote> {
  const [brand, profile, updatedAt] = await Promise.all([
    loadTheatreBranding(),
    loadUserProfile(),
    getLocalUpdatedAt(),
  ]);
  const remoteLogo = await AsyncStorage.getItem(META_REMOTE_LOGO);
  return {
    id: ROW_ID,
    theatre_name: brand.theatreName.trim(),
    theatre_address: brand.theatreAddress.trim(),
    logo_url: remoteLogo?.trim() || null,
    contact_prenom: profile.prenom.trim(),
    contact_nom: profile.nom.trim(),
    contact_telephone: profile.telephone.trim(),
    contact_email: profile.email.trim(),
    contact_fonction: profile.fonction.trim(),
    contact_etablissement: profile.etablissement.trim(),
    updated_at: updatedAt,
  };
}

async function uploadLocalLogoIfNeeded(brandLogoUri: string | null): Promise<string | null> {
  if (!brandLogoUri?.trim()) return null;
  const local = brandLogoUri.trim();
  try {
    const info = await FileSystem.getInfoAsync(local);
    if (!info.exists) return null;
    const sb = getSupabase();
    const response = await fetch(local);
    const blob = await response.blob();
    const { error } = await sb.storage
      .from('photos')
      .upload(LOGO_STORAGE_PATH, blob, { upsert: true, contentType: 'image/jpeg' });
    if (error) return null;
    return sb.storage.from('photos').getPublicUrl(LOGO_STORAGE_PATH).data.publicUrl;
  } catch {
    return null;
  }
}

async function downloadRemoteLogo(logoUrl: string): Promise<void> {
  const url = logoUrl.trim();
  if (!url) return;
  const root = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!root) return;
  const tmp = `${root}workspace-logo-dl.jpg`;
  try {
    const result = await FileSystem.downloadAsync(url, tmp);
    if (result.status < 200 || result.status >= 300) return;
    await storePickedLogoFile(result.uri, { skipWorkspaceSyncMark: true });
    await AsyncStorage.setItem(META_REMOTE_LOGO, url);
  } catch {
    /* retenter au prochain pull */
  }
}

async function applyRemoteToLocal(remote: WorkspaceSettingsRemote): Promise<void> {
  const silent = { skipWorkspaceSyncMark: true as const };
  await saveTheatreIdentity(remote.theatre_name, remote.theatre_address, silent);
  const profile: UserProfile = {
    prenom: remote.contact_prenom,
    nom: remote.contact_nom,
    telephone: remote.contact_telephone,
    email: remote.contact_email,
    fonction: remote.contact_fonction,
    etablissement: remote.contact_etablissement,
  };
  await saveUserProfile(profile, silent);

  const remoteLogo = remote.logo_url?.trim() ?? '';
  const prevRemoteLogo = (await AsyncStorage.getItem(META_REMOTE_LOGO))?.trim() ?? '';
  if (!remoteLogo) {
    if (prevRemoteLogo) await clearTheatreLogo(silent);
    await AsyncStorage.removeItem(META_REMOTE_LOGO);
  } else if (remoteLogo !== prevRemoteLogo) {
    await downloadRemoteLogo(remoteLogo);
  }

  await markWorkspaceSettingsSynced(remote.updated_at);
}

export async function pushWorkspaceSettingsToSupabase(): Promise<void> {
  const guard = await canCallSupabaseSync('pushWorkspaceSettingsToSupabase');
  if (!guard.ok) return;
  if (!isSupabaseConfigured()) return;

  const dirty = await isLocalDirty();
  const updatedMeta = await AsyncStorage.getItem(META_UPDATED);
  if (!dirty && updatedMeta) return;

  if (!dirty && !updatedMeta) {
    const brand = await loadTheatreBranding();
    const profile = await loadUserProfile();
    const hasContent =
      Boolean(brand.theatreName.trim() || brand.theatreAddress.trim() || brand.logoUri) ||
      Boolean(
        profile.prenom.trim() ||
          profile.nom.trim() ||
          profile.telephone.trim() ||
          profile.email.trim() ||
          profile.fonction.trim() ||
          profile.etablissement.trim()
      );
    if (!hasContent) return;
  }

  const brand = await loadTheatreBranding();
  let logoUrl = (await AsyncStorage.getItem(META_REMOTE_LOGO))?.trim() || null;
  if (brand.logoUri) {
    const uploaded = await uploadLocalLogoIfNeeded(brand.logoUri);
    if (uploaded) {
      logoUrl = uploaded;
      await AsyncStorage.setItem(META_REMOTE_LOGO, uploaded);
    }
  } else {
    logoUrl = null;
  }

  const payload = await buildLocalPayload();
  const now = new Date().toISOString();
  const row = {
    ...payload,
    logo_url: logoUrl,
    updated_at: now,
    synced: true,
  };

  const { error } = await getSupabase().from('workspace_settings').upsert(row);
  if (error) {
    if (/does not exist/i.test(error.message)) {
      throw new Error(
        'Table Supabase « workspace_settings » absente. Réexportez et exécutez le schéma SQL (Profil ou Connexion).'
      );
    }
    throw new Error(`Supabase workspace_settings: ${error.message}`);
  }

  await markWorkspaceSettingsSynced(now);
}

export async function pullWorkspaceSettingsFromSupabase(): Promise<void> {
  const guard = await canCallSupabaseSync('pullWorkspaceSettingsFromSupabase');
  if (!guard.ok) return;
  if (!isSupabaseConfigured()) return;

  const { data, error } = await getSupabase()
    .from('workspace_settings')
    .select('*')
    .eq('id', ROW_ID)
    .maybeSingle();

  if (error) {
    if (/does not exist/i.test(error.message)) return;
    throw new Error(`Supabase workspace_settings: ${error.message}`);
  }
  if (!data) return;

  const remote = data as WorkspaceSettingsRemote;
  const remoteUpdated = remote.updated_at?.trim() ? Date.parse(remote.updated_at) : 0;
  const localUpdated = Date.parse(await getLocalUpdatedAt());
  const dirty = await isLocalDirty();

  if (dirty && localUpdated >= remoteUpdated) return;
  if (!dirty && remoteUpdated <= localUpdated) return;

  await applyRemoteToLocal(remote);
}

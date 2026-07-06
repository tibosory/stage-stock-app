import { getApiKeyOverride, getCapiBridgeBaseOverride } from './apiEndpointStorage';
import { fetchWithTimeout } from './fetchWithTimeout';
import * as FileSystem from 'expo-file-system/legacy';

const CAPI_BRIDGE_TIMEOUT_MS = 45_000;

export async function resolveCapiBridgeApiBase(): Promise<string | null> {
  const override = await getCapiBridgeBaseOverride();
  if (override) return `${override.replace(/\/$/, '')}/api`;
  return null;
}

export function capiAccueilProDocumentViewUrl(
  apiBase: string,
  spectacleRefId: string,
  versionId: string,
): string {
  const base = apiBase.replace(/\/$/, '');
  return `${base}/cattrack/accueil-pro/spectacles/${encodeURIComponent(spectacleRefId)}/documents/${encodeURIComponent(versionId)}/view`;
}

async function capiBridgeHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  const key = (await getApiKeyOverride())?.trim();
  if (key) headers['X-API-Key'] = key;
  return headers;
}

export async function pushAccueilProContactToCapi(body: {
  nom: string;
  prenom?: string | null;
  email?: string | null;
  telephone?: string | null;
  role?: string | null;
  organisation?: string | null;
  kind?: 'personnel' | 'prestataire';
}): Promise<{ capi_ref: string; capi_contact_ref_id: string; kind: string; nom: string } | null> {
  const apiBase = await resolveCapiBridgeApiBase();
  if (!apiBase) return null;
  const headers = await capiBridgeHeaders();
  try {
    const res = await fetchWithTimeout(
      `${apiBase}/cattrack/accueil-pro/contacts`,
      { method: 'POST', headers, body: JSON.stringify(body) },
      CAPI_BRIDGE_TIMEOUT_MS,
    );
    if (!res.ok) return null;
    return (await res.json()) as { capi_ref: string; capi_contact_ref_id: string; kind: string; nom: string };
  } catch {
    return null;
  }
}

/** Télécharge un document CAPI (auth X-API-Key) vers le cache local pour prévisualisation. */
export async function downloadCapiAccueilProDocumentToCache(
  spectacleRefId: string,
  versionId: string,
  filename: string,
): Promise<string | null> {
  const apiBase = await resolveCapiBridgeApiBase();
  if (!apiBase) return null;
  const key = await getApiKeyOverride();
  if (!key?.trim()) return null;
  const url = capiAccueilProDocumentViewUrl(apiBase, spectacleRefId, versionId);
  const safeName = filename.replace(/[^\w.\-() ]+/g, '_').slice(0, 120) || 'document';
  const dir = `${FileSystem.cacheDirectory ?? FileSystem.documentDirectory}capi-docs`;
  if (!dir) return null;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const localUri = `${dir}/${versionId}-${safeName}`;
  const result = await FileSystem.downloadAsync(url, localUri, {
    headers: { 'X-API-Key': key.trim() },
  });
  if (result.status < 200 || result.status >= 300) return null;
  return result.uri;
}

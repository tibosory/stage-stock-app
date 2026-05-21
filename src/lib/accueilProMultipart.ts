/**
 * En-têtes + URL CATRACK Pro pour téléversements multipart (Accueil Pro),
 * aligné sur {@link inventoryApiFetch} sans forcer `Content-Type` JSON.
 */
import { getResolvedApiBase } from '../config/stageStockApi';
import { fetchWithTimeout } from './fetchWithTimeout';
import { looksLikeHttpUrl, stripStageStockServerRootSuffix } from './apiEndpointStorage';
import { buildServerAuthHeaders } from './serverAuthHeaders';
import { canCallApiSync, isLocalBackendDisabledReason } from './syncGuards';
import type { InventorySyncEndpoint } from './inventoryApiSync';

function joinBasePath(base: string, path: string): string {
  const b = stripStageStockServerRootSuffix(base.replace(/\/+$/, ''));
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
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
  const key = endpoint.apiKey?.trim();
  if (key) {
    const headers = await buildServerAuthHeaders();
    headers['X-API-Key'] = key;
    headers.Authorization = `Bearer ${key}`;
    return headers;
  }
  return buildServerAuthHeaders();
}

export async function accueilProMultipartFetch(
  path: string,
  init: RequestInit,
  endpoint: InventorySyncEndpoint | null,
  guardLabel?: string
): Promise<Response> {
  const guard = await canCallApiSync(guardLabel ?? `accueilProUpload:${path}`);
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
  const authHeaders = await buildHeadersForEndpoint(endpoint);
  const merged: Record<string, string> = { ...authHeaders };
  const extra = init.headers as Record<string, string> | undefined;
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v != null && k.toLowerCase() !== 'content-type') merged[k] = v;
    }
  }
  return fetchWithTimeout(url, { ...init, headers: merged, method: init.method ?? 'POST' }, 120_000);
}

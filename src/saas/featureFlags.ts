import { fetchWithTimeout } from '../lib/fetchWithTimeout';
import { getResolvedApiBase, stageStockApiHeadersAsync } from '../config/stageStockApi';

export type SaaSFeatureFlags = {
  'saas.rbac': boolean;
  'saas.ai': boolean;
  'saas.offlineSync': boolean;
  'saas.tourMode': boolean;
  'saas.materialProfileEditor': boolean;
};

type CachedFlags = {
  flags: SaaSFeatureFlags;
  fetchedAt: number;
};

const DEFAULT_FEATURE_FLAGS: SaaSFeatureFlags = {
  'saas.rbac': true,
  'saas.ai': false,
  'saas.offlineSync': true,
  'saas.tourMode': false,
  'saas.materialProfileEditor': true,
};

const FLAGS_CACHE_TTL_MS = 60_000;
const FLAGS_FETCH_TIMEOUT_MS = 8_000;
let flagsCache: CachedFlags | null = null;

function coerceBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeFlags(raw: unknown): SaaSFeatureFlags {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    'saas.rbac': coerceBoolean(src['saas.rbac'], DEFAULT_FEATURE_FLAGS['saas.rbac']),
    'saas.ai': coerceBoolean(src['saas.ai'], DEFAULT_FEATURE_FLAGS['saas.ai']),
    'saas.offlineSync': coerceBoolean(src['saas.offlineSync'], DEFAULT_FEATURE_FLAGS['saas.offlineSync']),
    'saas.tourMode': coerceBoolean(src['saas.tourMode'], DEFAULT_FEATURE_FLAGS['saas.tourMode']),
    'saas.materialProfileEditor': coerceBoolean(
      src['saas.materialProfileEditor'],
      DEFAULT_FEATURE_FLAGS['saas.materialProfileEditor']
    ),
  };
}

export function getDefaultSaasFeatureFlags(): SaaSFeatureFlags {
  return { ...DEFAULT_FEATURE_FLAGS };
}

export function invalidateSaasFeatureFlagsCache(): void {
  flagsCache = null;
}

export async function getSaasFeatureFlags(forceRefresh = false): Promise<SaaSFeatureFlags> {
  const now = Date.now();
  if (!forceRefresh && flagsCache && now - flagsCache.fetchedAt <= FLAGS_CACHE_TTL_MS) {
    return { ...flagsCache.flags };
  }

  const base = await getResolvedApiBase();
  if (!base || base.length < 8) {
    return getDefaultSaasFeatureFlags();
  }

  const url = `${base.replace(/\/+$/, '')}/api/v1/feature-flags`;
  const headers = await stageStockApiHeadersAsync();
  try {
    const res = await fetchWithTimeout(url, { method: 'GET', headers }, FLAGS_FETCH_TIMEOUT_MS);
    if (!res.ok) {
      return getDefaultSaasFeatureFlags();
    }
    const body = (await res.json()) as { flags?: unknown };
    const flags = normalizeFlags(body?.flags);
    flagsCache = { flags, fetchedAt: now };
    return { ...flags };
  } catch {
    return getDefaultSaasFeatureFlags();
  }
}

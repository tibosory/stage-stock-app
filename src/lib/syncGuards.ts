import { getResolvedApiBase } from '../config/stageStockApi';
import {
  getDoubleBackendRuntime,
  isDoubleBackendRuntimeInitialized,
  loadDoubleBackendRuntimeFromStorage,
} from './doubleBackendRuntime';

const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').trim();

function isHttpUrl(v: string): boolean {
  return /^https?:\/\//i.test(v);
}

function parseBooleanEnv(v: string | undefined): boolean | null {
  if (!v) return null;
  const t = v.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(t)) return true;
  if (['0', 'false', 'no', 'off'].includes(t)) return false;
  return null;
}

/**
 * DOUBLE_BACKEND : piloté par l'UI (AsyncStorage), avec fallback optionnel via env.
 *
 * ⚠️  Déprécié S2.0 (mai 2026). Ce flag correspond historiquement au "Mode C"
 * (réplication simultanée Express PG + Supabase), qui dégrade l’intégrité des
 * données (P0-E : pull qui écrase synced=0). La cible architecturale est
 * `SyncProfileRouter` (single-target choisi au runtime : docker-local OU
 * supabase-cloud). Le branchement se fait en S2.4. Pour l’instant ce getter
 * reste actif pour ne casser aucun call-site, mais émet un warn unique.
 */
let _deprecationLogged = false;
export async function getDoubleBackendEnabled(): Promise<boolean> {
  let enabled: boolean;
  if (isDoubleBackendRuntimeInitialized()) {
    enabled = getDoubleBackendRuntime();
  } else {
    const fromStorage = await loadDoubleBackendRuntimeFromStorage();
    if (fromStorage === true) enabled = true;
    else {
      const envFallback = parseBooleanEnv(process.env.EXPO_PUBLIC_DOUBLE_BACKEND);
      enabled = envFallback ?? false;
    }
  }
  if (enabled && !_deprecationLogged) {
    _deprecationLogged = true;
    console.warn(
      '[deprecation] DOUBLE_BACKEND activé : la réplication simultanée Express+Supabase ' +
        'est dépréciée (mode C, risque P0-E). Cible : SyncProfileRouter single-target ' +
        '(docker-local OU supabase-cloud). Migration : S2.4.',
    );
  }
  return enabled;
}

export async function resolveApiUrlForSync(): Promise<string> {
  const resolved = (await getResolvedApiBase()).trim();
  if (isHttpUrl(resolved)) return resolved.replace(/\/+$/, '');
  if (isHttpUrl(API_URL)) return API_URL.replace(/\/+$/, '');
  return '';
}

export async function canCallApiSync(scope: string): Promise<
  | { ok: true; apiUrl: string; doubleBackend: boolean }
  | { ok: false; reason: string; doubleBackend: boolean; apiUrl: string }
> {
  const doubleBackend = await getDoubleBackendEnabled();
  const apiUrl = await resolveApiUrlForSync();

  if (!apiUrl) {
    const reason = 'API_URL non configurée';
    console.log(`[sync][skip][${scope}] ${reason}`);
    return { ok: false, reason, doubleBackend, apiUrl };
  }
  console.log(`[sync][guard][${scope}] API autorisée (${apiUrl})`);
  return { ok: true, apiUrl, doubleBackend };
}

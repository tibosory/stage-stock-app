import { getResolvedApiBase } from '../config/stageStockApi';
import { isSupabaseConfigured } from './supabase';
import { BACKEND_SKIP, getDataBackendMode } from './backendMode';
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
 * ⚠️  Déprécié S2.0 (mai 2026). Remplacé par le choix explicite `DataBackendMode`
 * (serveur local **ou** Supabase, jamais les deux). Ce getter reste pour compatibilité
 * des call-sites qui lisent encore `doubleBackend` dans le retour de `canCallApiSync`.
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
        'est dépréciée. Utilisez le choix de backend dans Connexion/Réseau (local ou Supabase).',
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
  const backendMode = await getDataBackendMode();

  if (backendMode !== 'local_server') {
    const reason = BACKEND_SKIP.localNotSelected;
    console.log(`[sync][skip][${scope}] ${reason}`);
    return { ok: false, reason, doubleBackend, apiUrl };
  }

  if (!apiUrl) {
    const reason = 'API_URL non configurée';
    console.log(`[sync][skip][${scope}] ${reason}`);
    return { ok: false, reason, doubleBackend, apiUrl };
  }
  console.log(`[sync][guard][${scope}] API autorisée (${apiUrl})`);
  return { ok: true, apiUrl, doubleBackend };
}

export async function canCallSupabaseSync(scope: string): Promise<
  { ok: true } | { ok: false; reason: string }
> {
  const backendMode = await getDataBackendMode();

  if (backendMode !== 'supabase') {
    const reason = BACKEND_SKIP.supabaseNotSelected;
    console.log(`[sync][skip][${scope}] ${reason}`);
    return { ok: false, reason };
  }

  if (!isSupabaseConfigured()) {
    const reason = 'Supabase non configuré';
    console.log(`[sync][skip][${scope}] ${reason}`);
    return { ok: false, reason };
  }

  console.log(`[sync][guard][${scope}] Supabase autorisé`);
  return { ok: true };
}

export function isLocalBackendDisabledReason(reason: string): boolean {
  return reason === BACKEND_SKIP.localNotSelected || reason === 'DOUBLE_BACKEND désactivé';
}

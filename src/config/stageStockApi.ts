import { Platform } from 'react-native';
import {
  getApiBaseOverride,
  getHealthPathOverride,
  normalizeHttpBaseUrl,
  stripStageStockServerRootSuffix,
} from '../lib/apiEndpointStorage';
import { buildServerAuthHeaders } from '../lib/serverAuthHeaders';
import { formatSyncHttpError } from '../lib/syncAuthErrors';
import { fetchWithTimeout } from '../lib/fetchWithTimeout';
import { syncSnapshotInvalidJsonMessage } from '../lib/syncSnapshotResponseHint';
import { isStageStockHealthJson } from '../lib/apiBaseResolution';
import {
  getCachedQuickReachable,
  setCachedQuickReachable,
} from '../lib/networkQuickReachability';

/** Contournement explicite du cache (ex. tests) — l’app invalide surtout via les réglages API. */
export { invalidateQuickReachabilityCache } from '../lib/networkQuickReachability';

const trimSlash = (u: string) => u.replace(/\/+$/, '');

/**
 * Racine API optionnelle embarquée dans le build (serveur maison, VPS, etc.).
 * Surcharges `.env` :
 * - `EXPO_PUBLIC_API_URL`
 * - `EXPO_PUBLIC_API_HEALTH_PATH`
 * - `EXPO_PUBLIC_API_KEY`
 *
 * **Sur l’appareil**, l’onglet Réseau peut remplacer l’URL (et clé / chemin santé) sans rebuild : voir `getResolvedApiBase()`.
 * Si rien n’est défini, l’URL reste vide (pas de synchro inventaire HTTP tant que vous ne configurez pas le serveur).
 */
export function getBundledDefaultApiBase(): string {
  const u = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!u) return '';
  const raw = normalizeHttpBaseUrl(u) ?? trimSlash(u);
  return stripStageStockServerRootSuffix(raw);
}

/** Alias figé au chargement du bundle (même valeur que getBundledDefaultApiBase()). */
export const STAGE_STOCK_API_BASE = getBundledDefaultApiBase();

/** URL effective : priorité au réglage « Réseau » sur l’appareil, sinon valeur du build. */
export async function getResolvedApiBase(): Promise<string> {
  const o = await getApiBaseOverride();
  if (o) {
    const normalized = normalizeHttpBaseUrl(o);
    if (normalized) return stripStageStockServerRootSuffix(trimSlash(normalized));
    return stripStageStockServerRootSuffix(trimSlash(o));
  }
  return getBundledDefaultApiBase();
}

export function stageStockApiHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-StageStock-Client': `StageStock-${Platform.OS}`,
  };
  const key = process.env.EXPO_PUBLIC_API_KEY?.trim();
  if (key) {
    headers['X-API-Key'] = key;
    headers['Authorization'] = `Bearer ${key}`;
  }
  return headers;
}

export async function stageStockApiHeadersAsync(): Promise<Record<string, string>> {
  return buildServerAuthHeaders();
}

function pushCustomHealthUrls(base: string, custom: string | undefined | null, out: string[]) {
  if (!custom?.trim()) return;
  const c = custom.trim();
  if (/^https?:\/\//i.test(c)) {
    out.push(c.replace(/\/+$/, ''));
  } else {
    const p = c.startsWith('/') ? c : `/${c}`;
    out.push(`${base}${p}`);
  }
}

async function buildPingUrlList(base: string): Promise<string[]> {
  const out: string[] = [];
  pushCustomHealthUrls(base, await getHealthPathOverride(), out);
  pushCustomHealthUrls(base, process.env.EXPO_PUBLIC_API_HEALTH_PATH?.trim() ?? null, out);
  out.push(
    `${base}/health`,
    `${base}/api/health`,
    `${base}/healthz`,
    `${base}/`,
    `${base}/api`,
  );
  const seen = new Set<string>();
  return out.filter(u => {
    if (seen.has(u)) return false;
    seen.add(u);
    return true;
  });
}

/**
 * Pings (GET) : délai max par essai, nombre d’URL limité pour le mode « rapide »
 * (hors test manuel complet dans l’onglet Réseau).
 */
const QUICK_PING_PER_URL_MS = 3_800;
const QUICK_PING_MAX_URLS = 4;
const REACHABLE_HTTP_STATUSES = new Set([401, 403, 404]);

/** Test rapide sans message technique (mode grand public). */
export async function checkServerReachableQuick(): Promise<boolean> {
  const cached = getCachedQuickReachable();
  if (cached !== null) return cached;

  const base = await getResolvedApiBase();
  if (!base || base.length < 8) {
    setCachedQuickReachable(false);
    return false;
  }
  const allUrls = await buildPingUrlList(base);
  const urls = allUrls.slice(0, Math.min(QUICK_PING_MAX_URLS, allUrls.length));
  const headers = await stageStockApiHeadersAsync();
  for (const url of urls) {
    try {
      const res = await fetchWithTimeout(
        url,
        { method: 'GET', headers },
        QUICK_PING_PER_URL_MS
      );
      if (res.ok) {
        const text = await res.text();
        const isHealthProbe = /\/health(\?|$)/i.test(url) || url.endsWith('/health');
        if (isHealthProbe && !isStageStockHealthJson(text)) {
          continue;
        }
        setCachedQuickReachable(true);
        return true;
      }
      if (REACHABLE_HTTP_STATUSES.has(res.status)) {
        setCachedQuickReachable(true);
        return true;
      }
    } catch {
      continue;
    }
  }
  setCachedQuickReachable(false);
  return false;
}

/**
 * Vérifie que le téléphone atteint le serveur (Wi‑Fi local, LAN ou Internet).
 */
export async function pingStageStockApi(): Promise<{ ok: boolean; message: string }> {
  const base = await getResolvedApiBase();
  if (!base || base.length < 8) {
    return {
      ok: false,
      message:
        'Aucune URL d’API configurée. Renseignez l’onglet Réseau ou EXPO_PUBLIC_API_URL dans le .env du build.',
    };
  }
  const urls = await buildPingUrlList(base);
  const failures: string[] = [];
  const headers = await stageStockApiHeadersAsync();

  const PING_PER_URL_MS = 10_000;
  for (const url of urls) {
    try {
      const res = await fetchWithTimeout(url, { method: 'GET', headers }, PING_PER_URL_MS);
      const text = await res.text();
      if (res.ok) {
        const preview = text.trim() ? text.slice(0, 400) : '(corps vide)';
        return {
          ok: true,
          message: `HTTP ${res.status} — ${url}\n\n${preview}`,
        };
      }
      if (REACHABLE_HTTP_STATUSES.has(res.status)) {
        return {
          ok: true,
          message:
            `Serveur joignable (HTTP ${res.status}) — ${url}\n\n` +
            `La connectivité est OK. Cette réponse indique surtout qu'une authentification est requise ` +
            `(clé API ou session), pas que le serveur est hors ligne.`,
        };
      }
      failures.push(`${url} → HTTP ${res.status}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      failures.push(`${url} → ${msg}`);
    }
  }

  return {
    ok: false,
    message:
      `Aucune route de test n’a répondu OK (2xx).\n\n${failures.join('\n')}\n\n` +
      `Vérifiez l’URL dans l’onglet Réseau, le pare-feu du PC, et que le serveur écoute sur 0.0.0.0. ` +
      `Vous pouvez aussi définir un chemin de santé (champ dédié ou EXPO_PUBLIC_API_HEALTH_PATH dans .env).`,
  };
}

/**
 * Vérifie si l'API est prête pour la synchronisation de base (lecture snapshot).
 * Utile pour valider rapidement le couple téléphone ↔ backend sur le même Wi‑Fi.
 */
export async function probeStageStockSyncApi(): Promise<{ ok: boolean; message: string }> {
  const base = await getResolvedApiBase();
  if (!base || base.length < 8) {
    return {
      ok: false,
      message:
        'Aucune URL d’API configurée. Définissez l’URL dans l’onglet Réseau ou EXPO_PUBLIC_API_URL au build.',
    };
  }
  const headers = await stageStockApiHeadersAsync();
  const url = `${base.replace(/\/+$/, '')}/api/sync/snapshot`;
  const SNAPSHOT_TEST_MS = 12_000;
  try {
    const res = await fetchWithTimeout(url, { method: 'GET', headers }, SNAPSHOT_TEST_MS);
    const text = await res.text();
    if (!res.ok) {
      if (res.status === 401) {
        return {
          ok: false,
          message: formatSyncHttpError(401, text, 'Test sync').message,
        };
      }
      return {
        ok: false,
        message:
          `Endpoint sync non valide: HTTP ${res.status}\n${url}\n\n` +
          `${text.slice(0, 500)}\n\n` +
          `Le backend doit exposer GET /api/sync/snapshot pour les mises à jour de base.`,
      };
    }
    try {
      JSON.parse(text);
    } catch {
      return { ok: false, message: syncSnapshotInvalidJsonMessage(text) };
    }
    return {
      ok: true,
      message:
        `Sync API accessible (HTTP ${res.status})\n${url}\n\n` +
        `Le téléphone peut lire les données de sync. Vous pouvez ensuite tester Envoyer/Recevoir dans Paramètres.`,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      message:
        `Erreur réseau vers ${url}\n${msg}\n\n` +
        `Vérifiez le Wi‑Fi commun, le pare-feu Windows, l'écoute serveur sur 0.0.0.0 et l'URL dans Réseau.`,
    };
  }
}

/**
 * Vérifie si l’API Accueil Pro accepte la sync (lecture snapshot).
 */
export async function probeAccueilProSyncApi(): Promise<{ ok: boolean; message: string }> {
  const base = await getResolvedApiBase();
  if (!base || base.length < 8) {
    return {
      ok: false,
      message:
        'Aucune URL d’API configurée. Définissez l’URL dans l’onglet Réseau ou EXPO_PUBLIC_API_URL au build.',
    };
  }
  const headers = await stageStockApiHeadersAsync();
  const url = `${base.replace(/\/+$/, '')}/api/accueilpro/snapshot`;
  const SNAPSHOT_TEST_MS = 12_000;
  try {
    const res = await fetchWithTimeout(url, { method: 'GET', headers }, SNAPSHOT_TEST_MS);
    const text = await res.text();
    if (!res.ok) {
      if (res.status === 401) {
        return {
          ok: false,
          message: formatSyncHttpError(401, text, 'Test Accueil Pro').message,
        };
      }
      return {
        ok: false,
        message:
          `Endpoint Accueil Pro non valide: HTTP ${res.status}\n${url}\n\n` +
          `${text.slice(0, 500)}\n\n` +
          `Le backend doit exposer GET /api/accueilpro/snapshot.`,
      };
    }
    try {
      JSON.parse(text);
    } catch {
      return { ok: false, message: syncSnapshotInvalidJsonMessage(text) };
    }
    return {
      ok: true,
      message:
        `Accueil Pro sync accessible (HTTP ${res.status})\n${url}\n\n` +
        `Le téléphone peut lire les données Accueil Pro du serveur.`,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      message:
        `Erreur réseau vers ${url}\n${msg}\n\n` +
        `Vérifiez le Wi‑Fi commun, le pare-feu Windows, l'écoute serveur sur 0.0.0.0 et l'URL dans Réseau.`,
    };
  }
}

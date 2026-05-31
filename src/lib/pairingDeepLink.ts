import {
  setApiBaseOverride,
  setApiKeyOverride,
  looksLikeHttpUrl,
  stripStageStockServerRootSuffix,
} from './apiEndpointStorage';

/**
 * Liens profonds : stagestock://pair?base=...&key=... (émis par GET /pair sur le PC).
 */
export function parsePairingDeepLink(url: string): { baseUrl: string; apiKey: string | null } | null {
  const t = url.trim();
  if (!/^stagestock:\/\/pair(\?|$)/i.test(t)) return null;
  const q = t.indexOf('?');
  if (q === -1) return null;
  const params = new URLSearchParams(t.slice(q + 1));
  const base = params.get('base')?.trim() ?? '';
  if (!base || !looksLikeHttpUrl(base)) return null;
  const key = params.get('key')?.trim();
  return { baseUrl: stripStageStockServerRootSuffix(base.replace(/\/+$/, '')), apiKey: key || null };
}

/** QR ou URL http(s) affichée sur la page /pair du PC (ex. http://192.168.0.5:8091/pair?key=…). */
export function parseHttpPairingTarget(raw: string): { baseUrl: string; apiKey: string | null } | null {
  const t = raw.trim();
  if (!/^https?:\/\//i.test(t)) return null;
  try {
    const u = new URL(t);
    const baseParam = u.searchParams.get('base')?.trim() ?? '';
    const baseFromQuery =
      baseParam && looksLikeHttpUrl(baseParam)
        ? stripStageStockServerRootSuffix(baseParam.replace(/\/+$/, ''))
        : null;
    const base =
      baseFromQuery ?? stripStageStockServerRootSuffix(`${u.protocol}//${u.host}`);
    if (!looksLikeHttpUrl(base)) return null;
    const key = u.searchParams.get('key')?.trim();
    return { baseUrl: base, apiKey: key || null };
  } catch {
    return null;
  }
}

export function isLoopbackHost(hostname: string): boolean {
  const h = hostname.trim().toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]';
}

/** Retourne `loopback` si l’URL pointe vers le PC lui-même (inutilisable depuis le téléphone). */
export function getPairingHostIssue(baseUrl: string): 'loopback' | null {
  try {
    const u = new URL(baseUrl.includes('://') ? baseUrl : `http://${baseUrl}`);
    return isLoopbackHost(u.hostname) ? 'loopback' : null;
  } catch {
    return null;
  }
}

export async function tryApplyPairingFromScan(raw: string): Promise<boolean> {
  const fromDeep = parsePairingDeepLink(raw);
  const parsed = fromDeep ?? parseHttpPairingTarget(raw);
  if (!parsed) return false;
  await setApiBaseOverride(parsed.baseUrl);
  await setApiKeyOverride(parsed.apiKey);
  return true;
}

export async function applyPairingDeepLink(url: string): Promise<boolean> {
  const parsed = parsePairingDeepLink(url) ?? parseHttpPairingTarget(url);
  if (!parsed) return false;
  await setApiBaseOverride(parsed.baseUrl);
  await setApiKeyOverride(parsed.apiKey);
  return true;
}

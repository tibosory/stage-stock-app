import { looksLikeHttpUrl, stripStageStockServerRootSuffix } from './httpUrlUtils';

export type PairingParsed = {
  baseUrl: string;
  apiKey: string | null;
  capiBaseUrl: string | null;
};

function trimSlash(u: string): string {
  return u.replace(/\/+$/, '');
}

function parseCapiParam(raw: string | null | undefined): string | null {
  const capi = raw?.trim() ?? '';
  if (!capi || !looksLikeHttpUrl(capi)) return null;
  return trimSlash(capi);
}

/**
 * Liens profonds : stagestock://pair?base=...&key=...&capi=... (émis par CAPI ou GET /pair sur le PC).
 */
export function parsePairingDeepLink(url: string): PairingParsed | null {
  const t = url.trim();
  if (!/^stagestock:\/\/pair(\?|$)/i.test(t)) return null;
  const q = t.indexOf('?');
  if (q === -1) return null;
  const params = new URLSearchParams(t.slice(q + 1));
  const base = params.get('base')?.trim() ?? '';
  if (!base || !looksLikeHttpUrl(base)) return null;
  const key = params.get('key')?.trim();
  return {
    baseUrl: stripStageStockServerRootSuffix(trimSlash(base)),
    apiKey: key || null,
    capiBaseUrl: parseCapiParam(params.get('capi')),
  };
}

function isHttpPairingCandidate(u: URL): boolean {
  const path = u.pathname.replace(/\/+$/, '') || '/';
  if (/^\/(pair|pair\.html)$/i.test(path)) return true;
  if (u.searchParams.has('key')) return true;
  const baseParam = u.searchParams.get('base')?.trim() ?? '';
  return Boolean(baseParam && looksLikeHttpUrl(baseParam));
}

/** QR ou URL http(s) affichée sur la page /pair du PC ou générée par CAPI (ex. http://192.168.0.5:8091/pair?key=…&capi=…). */
export function parseHttpPairingTarget(raw: string): PairingParsed | null {
  const t = raw.trim();
  if (!/^https?:\/\//i.test(t)) return null;
  try {
    const u = new URL(t);
    if (!isHttpPairingCandidate(u)) return null;
    const baseParam = u.searchParams.get('base')?.trim() ?? '';
    const baseFromQuery =
      baseParam && looksLikeHttpUrl(baseParam)
        ? stripStageStockServerRootSuffix(trimSlash(baseParam))
        : null;
    const base =
      baseFromQuery ?? stripStageStockServerRootSuffix(`${u.protocol}//${u.host}`);
    if (!looksLikeHttpUrl(base)) return null;
    const key = u.searchParams.get('key')?.trim();
    return {
      baseUrl: base,
      apiKey: key || null,
      capiBaseUrl: parseCapiParam(u.searchParams.get('capi')),
    };
  } catch {
    return null;
  }
}

export function isLoopbackHost(hostname: string): boolean {
  const h = hostname.trim().toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]';
}

/** Retourne `loopback` si l'URL pointe vers le PC lui-même (inutilisable depuis le téléphone). */
export function getPairingHostIssue(baseUrl: string): 'loopback' | null {
  try {
    const u = new URL(baseUrl.includes('://') ? baseUrl : `http://${baseUrl}`);
    return isLoopbackHost(u.hostname) ? 'loopback' : null;
  } catch {
    return null;
  }
}

export function pairingScanHadApiKey(raw: string): boolean {
  const parsed = parsePairingDeepLink(raw) ?? parseHttpPairingTarget(raw);
  return Boolean(parsed?.apiKey?.trim());
}

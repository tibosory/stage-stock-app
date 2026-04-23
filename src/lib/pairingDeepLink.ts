import { setApiBaseOverride, setApiKeyOverride, looksLikeHttpUrl } from './apiEndpointStorage';

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
  return { baseUrl: base.replace(/\/+$/, ''), apiKey: key || null };
}

export async function applyPairingDeepLink(url: string): Promise<boolean> {
  const parsed = parsePairingDeepLink(url);
  if (!parsed) return false;
  await setApiBaseOverride(parsed.baseUrl);
  await setApiKeyOverride(parsed.apiKey);
  return true;
}

export type SupabaseProvisioningPayload = { url: string; anonKey: string };

/** Lien profond : stagestock://supabase?url=…&key=… (QR ou e-mail d’invitation). */
export function buildSupabaseProvisioningDeepLink(url: string, anonKey: string): string {
  const params = new URLSearchParams();
  params.set('url', url.trim());
  params.set('key', anonKey.trim());
  return `stagestock://supabase?${params.toString()}`;
}

function looksLikeSupabaseProjectUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'https:') return false;
    return /\.supabase\.co$/i.test(u.hostname);
  } catch {
    return false;
  }
}

export function parseSupabaseProvisioningDeepLink(raw: string): SupabaseProvisioningPayload | null {
  const t = raw.trim();
  if (!/^stagestock:\/\/supabase(\?|$)/i.test(t)) return null;
  const q = t.indexOf('?');
  if (q === -1) return null;
  const params = new URLSearchParams(t.slice(q + 1));
  const url = params.get('url')?.trim() ?? '';
  const anonKey = params.get('key')?.trim() ?? '';
  if (!url || !anonKey || !looksLikeSupabaseProjectUrl(url)) return null;
  return { url, anonKey };
}

export async function tryApplySupabaseProvisioningFromScan(raw: string): Promise<boolean> {
  const parsed = parseSupabaseProvisioningDeepLink(raw);
  if (!parsed) return false;
  const { saveAndApplySupabaseConfig } = await import('./supabase');
  await saveAndApplySupabaseConfig(parsed.url, parsed.anonKey);
  return true;
}

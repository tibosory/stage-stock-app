import { tryApplySupabaseProvisioningFromScan, parseSupabaseProvisioningDeepLink } from './supabaseProvisioningDeepLink';
import type { AppLanguage } from '../i18n/strings';

export type SupabaseProvisioningScanResult =
  | { kind: 'not_provisioning' }
  | { kind: 'success'; url: string }
  | { kind: 'error'; title: string; message: string };

export async function completeSupabaseProvisioningFromScan(
  raw: string,
  language: AppLanguage
): Promise<SupabaseProvisioningScanResult> {
  const applied = await tryApplySupabaseProvisioningFromScan(raw);
  if (!applied) {
    return { kind: 'not_provisioning' };
  }
  try {
    const parsed = parseSupabaseProvisioningDeepLink(raw);
    return {
      kind: 'success',
      url: parsed?.url ?? '',
    };
  } catch (e: unknown) {
    return {
      kind: 'error',
      title: language === 'en' ? 'Supabase' : 'Supabase',
      message: e instanceof Error ? e.message : String(e),
    };
  }
}

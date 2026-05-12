import type { PostgrestError } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from './supabase';
import { ACCUEILPRO_CLIENT_ROLE, ACCUEILPRO_ORGANISATEUR_ROLE } from '../modules/accueilpro/types/roles';

export type InvitationPreviewResult =
  | {
      ok: true;
      organizationId: string;
      organizationName: string;
      invitedRole: typeof ACCUEILPRO_CLIENT_ROLE | typeof ACCUEILPRO_ORGANISATEUR_ROLE;
      emailHint?: string;
    }
  | { ok: false; error: string; message?: string };

export type FinalizeInvitationResult =
  | {
      ok: true;
      organizationId: string;
      invitedRole: typeof ACCUEILPRO_CLIENT_ROLE | typeof ACCUEILPRO_ORGANISATEUR_ROLE;
      alreadyLinked?: boolean;
    }
  | { ok: false; error: string; message?: string };

function mapRpcPreview(data: unknown): InvitationPreviewResult {
  if (!data || typeof data !== 'object') return { ok: false, error: 'invalid_response' };
  const row = data as { ok?: boolean; error?: string; organization_id?: string; organization_name?: string; invited_role?: string; email_hint?: string };
  if (!row.ok) return { ok: false, error: String(row.error ?? 'unknown') };
  const role =
    row.invited_role === ACCUEILPRO_ORGANISATEUR_ROLE ? ACCUEILPRO_ORGANISATEUR_ROLE : ACCUEILPRO_CLIENT_ROLE;
  return {
    ok: true,
    organizationId: String(row.organization_id ?? ''),
    organizationName: String(row.organization_name ?? ''),
    invitedRole: role,
    emailHint: row.email_hint ? String(row.email_hint) : undefined,
  };
}

function mapRpcFinalize(data: unknown): FinalizeInvitationResult {
  if (!data || typeof data !== 'object') return { ok: false, error: 'invalid_response' };
  const row = data as {
    ok?: boolean;
    error?: string;
    organization_id?: string;
    invited_role?: string;
    already_linked?: boolean;
  };
  if (!row.ok) return { ok: false, error: String(row.error ?? 'unknown') };
  const role =
    row.invited_role === ACCUEILPRO_ORGANISATEUR_ROLE ? ACCUEILPRO_ORGANISATEUR_ROLE : ACCUEILPRO_CLIENT_ROLE;
  return {
    ok: true,
    organizationId: String(row.organization_id ?? ''),
    invitedRole: role,
    alreadyLinked: Boolean(row.already_linked),
  };
}

function formatErr(err: PostgrestError | null): string | undefined {
  return err?.message;
}

/**
 * Aperçu d’invitation (anon ou authentifié). Ne divulgue pas l’email complet.
 */
export async function previewAccueilProInvitation(token: string): Promise<InvitationPreviewResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: 'supabase_unconfigured' };
  const trimmed = token.trim();
  if (!trimmed) return { ok: false, error: 'empty_token' };
  const { data, error } = await getSupabase().rpc('ap_get_invitation_preview', { p_token: trimmed });
  if (error) return { ok: false, error: 'rpc_error', message: formatErr(error) };
  return mapRpcPreview(data);
}

/**
 * Lie `organizations.supabase_user_id` à l’utilisateur courant (email JWT = invitation).
 * Met à jour `user_metadata.role` selon `invited_role`.
 */
export async function finalizeAccueilProInvitation(token: string): Promise<FinalizeInvitationResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: 'supabase_unconfigured' };
  const trimmed = token.trim();
  if (!trimmed) return { ok: false, error: 'empty_token' };

  const sb = getSupabase();
  const { data, error } = await sb.rpc('ap_finalize_client_invitation', { p_token: trimmed });
  if (error) return { ok: false, error: 'rpc_error', message: formatErr(error) };

  const fin = mapRpcFinalize(data);
  if (!fin.ok) return fin;

  const role = fin.invitedRole;
  const { error: uErr } = await sb.auth.updateUser({ data: { role } });
  if (uErr) {
    return {
      ok: false,
      error: 'metadata_update_failed',
      message: uErr.message,
    };
  }

  return fin;
}

import type { User } from '@supabase/supabase-js';
import { getApOrganization } from '../db/accueilProDb';
import { getSupabase, isSupabaseConfigured } from './supabase';
import {
  ACCUEILPRO_CLIENT_ROLE,
  ACCUEILPRO_ORGANISATEUR_ROLE,
  ACCUEILPRO_STAFF_ROLES,
} from '../modules/accueilpro/types/roles';
import { openEmail } from './contactActions';

export type SupabasePortailOrganization = {
  id: string;
  name: string;
  email: string | null;
};

export type CreateInvitationResult =
  | {
      ok: true;
      token: string;
      email: string;
      expiresAt: string;
      invitedRole: typeof ACCUEILPRO_CLIENT_ROLE | typeof ACCUEILPRO_ORGANISATEUR_ROLE;
      organizationId: string;
      organizationName: string;
    }
  | { ok: false; error: string; message?: string };

export function isSupabaseStaffUser(user: User | null | undefined): boolean {
  if (!user) return false;
  const role = String((user.user_metadata as { role?: string } | undefined)?.role ?? '').trim();
  return (ACCUEILPRO_STAFF_ROLES as readonly string[]).includes(role);
}

export async function listSupabasePortailOrganizations(): Promise<SupabasePortailOrganization[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await getSupabase()
    .from('organizations')
    .select('id, name, email')
    .order('name', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(row => ({
    id: String(row.id),
    name: String(row.name ?? ''),
    email: row.email != null ? String(row.email) : null,
  }));
}

/** Crée ou retrouve l’organisation portail Supabase à partir d’une fiche locale SQLite. */
export async function ensureSupabasePortailOrganizationFromLocal(
  localOrganizationId: string
): Promise<{ ok: true; id: string; name: string } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: 'supabase_unconfigured' };
  const local = await getApOrganization(localOrganizationId);
  if (!local) return { ok: false, error: 'local_org_not_found' };

  const sb = getSupabase();
  const email = local.email?.trim().toLowerCase() ?? '';
  if (email) {
    const { data: byEmail } = await sb.from('organizations').select('id, name').eq('email', email).maybeSingle();
    if (byEmail?.id) {
      return { ok: true, id: String(byEmail.id), name: String(byEmail.name ?? local.name) };
    }
  }

  const { data: byName } = await sb
    .from('organizations')
    .select('id, name')
    .ilike('name', local.name.trim())
    .maybeSingle();
  if (byName?.id) {
    return { ok: true, id: String(byName.id), name: String(byName.name ?? local.name) };
  }

  const { data: inserted, error } = await sb
    .from('organizations')
    .insert({
      name: local.name.trim(),
      type: local.type ?? null,
      address: local.address ?? null,
      cp: local.cp ?? null,
      city: local.city ?? null,
      phone: local.phone ?? null,
      email: local.email ?? null,
      website: local.website ?? null,
      notes_internes: local.notes_internes ?? null,
      status: local.status ?? 'actif',
    })
    .select('id, name')
    .single();

  if (error || !inserted?.id) {
    return { ok: false, error: error?.message ?? 'insert_failed' };
  }
  return { ok: true, id: String(inserted.id), name: String(inserted.name ?? local.name) };
}

export async function createAccueilProClientInvitation(args: {
  email: string;
  organizationId: string;
  invitedRole: typeof ACCUEILPRO_CLIENT_ROLE | typeof ACCUEILPRO_ORGANISATEUR_ROLE;
}): Promise<CreateInvitationResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: 'supabase_unconfigured' };
  const email = args.email.trim().toLowerCase();
  if (!email) return { ok: false, error: 'empty_email' };

  const { data, error } = await getSupabase().rpc('ap_create_client_invitation', {
    p_email: email,
    p_organization_id: args.organizationId,
    p_invited_role: args.invitedRole,
  });

  if (error) return { ok: false, error: 'rpc_error', message: error.message };
  if (!data || typeof data !== 'object') return { ok: false, error: 'invalid_response' };

  const row = data as {
    ok?: boolean;
    error?: string;
    token?: string;
    email?: string;
    expires_at?: string;
    invited_role?: string;
    organization_id?: string;
    organization_name?: string;
  };

  if (!row.ok) return { ok: false, error: String(row.error ?? 'unknown') };

  const invitedRole =
    row.invited_role === ACCUEILPRO_ORGANISATEUR_ROLE ? ACCUEILPRO_ORGANISATEUR_ROLE : ACCUEILPRO_CLIENT_ROLE;

  return {
    ok: true,
    token: String(row.token ?? ''),
    email: String(row.email ?? email),
    expiresAt: String(row.expires_at ?? ''),
    invitedRole,
    organizationId: String(row.organization_id ?? args.organizationId),
    organizationName: String(row.organization_name ?? ''),
  };
}

export async function sendAccueilProInvitationEmail(args: {
  toEmail: string;
  subject: string;
  body: string;
}): Promise<boolean> {
  return openEmail(args.toEmail, { subject: args.subject, body: args.body });
}

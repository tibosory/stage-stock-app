-- StageStock SaaS bootstrap helpers
-- Run after schema_saas.sql

create or replace function public.bootstrap_create_organization(
  p_name text,
  p_plan public.app_plan default 'free'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.organizations(name, plan)
  values (trim(p_name), p_plan)
  returning id into v_org;

  insert into public.users(id, email, role, organization_id)
  values (
    auth.uid(),
    coalesce((auth.jwt() ->> 'email')::text, ''),
    'admin',
    v_org
  )
  on conflict (id) do update
    set role = 'admin',
        organization_id = excluded.organization_id,
        updated_at = now();

  insert into public.organization_billing(organization_id, plan, status, updated_at)
  values (v_org, p_plan, 'inactive', now())
  on conflict (organization_id) do nothing;

  return v_org;
end;
$$;

revoke all on function public.bootstrap_create_organization(text, public.app_plan) from public;
grant execute on function public.bootstrap_create_organization(text, public.app_plan) to authenticated;

create or replace function public.bootstrap_invite_user(
  p_email text,
  p_role public.app_role default 'viewer'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.has_role(array['admin']::public.app_role[]) then
    raise exception 'Only admin can invite users';
  end if;

  select organization_id into v_org
  from public.users
  where id = auth.uid()
  limit 1;

  if v_org is null then
    raise exception 'Admin has no organization';
  end if;

  -- This helper returns payload for your invitation flow (edge function / dashboard).
  -- Creation of auth.users must be done via Supabase Admin API from server-side.
  return jsonb_build_object(
    'email', lower(trim(p_email)),
    'role', p_role,
    'organization_id', v_org
  );
end;
$$;

revoke all on function public.bootstrap_invite_user(text, public.app_role) from public;
grant execute on function public.bootstrap_invite_user(text, public.app_role) to authenticated;

create or replace function public.bootstrap_complete_user_membership(
  p_role public.app_role,
  p_organization_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  insert into public.users(id, email, role, organization_id)
  values (
    auth.uid(),
    coalesce((auth.jwt() ->> 'email')::text, ''),
    p_role,
    p_organization_id
  )
  on conflict (id) do update
    set role = excluded.role,
        organization_id = excluded.organization_id,
        updated_at = now();
end;
$$;

revoke all on function public.bootstrap_complete_user_membership(public.app_role, uuid) from public;
grant execute on function public.bootstrap_complete_user_membership(public.app_role, uuid) to authenticated;

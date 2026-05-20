-- StageStock SaaS multi-tenant schema (Supabase/PostgreSQL)
-- Production baseline: org isolation + RBAC + audit + billing.

create extension if not exists "pgcrypto";

create type public.app_plan as enum ('free', 'pro', 'enterprise');
create type public.app_role as enum ('admin', 'manager', 'technician', 'viewer');
create type public.product_status as enum ('available', 'in_tour', 'broken', 'maintenance');
create type public.tour_status as enum ('draft', 'active', 'closed', 'cancelled');
create type public.issue_type as enum ('broken', 'lost', 'maintenance');
create type public.issue_status as enum ('open', 'in_progress', 'resolved', 'closed');

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan public.app_plan not null default 'free',
  created_at timestamptz not null default now()
);

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role public.app_role not null default 'viewer',
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.tours (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  start_date date,
  end_date date,
  status public.tour_status not null default 'draft',
  current_location text,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  profile_id text,
  status public.product_status not null default 'available',
  current_location text,
  assigned_tour_id uuid references public.tours(id) on delete set null,
  technical_data jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  from_location text,
  to_location text,
  user_id uuid not null references public.users(id),
  timestamp timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.issues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  type public.issue_type not null,
  description text,
  photo_url text,
  status public.issue_status not null default 'open',
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references public.users(id),
  action text not null,
  entity text not null,
  entity_id text,
  payload jsonb not null default '{}'::jsonb,
  timestamp timestamptz not null default now()
);

create table if not exists public.organization_billing (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  plan public.app_plan not null default 'free',
  status text not null default 'inactive',
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists idx_users_org on public.users(organization_id);
create index if not exists idx_products_org on public.products(organization_id);
create index if not exists idx_products_status on public.products(status);
create index if not exists idx_tours_org on public.tours(organization_id);
create index if not exists idx_tours_status on public.tours(status);
create index if not exists idx_movements_org_ts on public.product_movements(organization_id, timestamp desc);
create index if not exists idx_issues_org_status on public.issues(organization_id, status);
create index if not exists idx_logs_org_ts on public.activity_logs(organization_id, timestamp desc);

create or replace function public.current_user_profile()
returns public.users
language sql
stable
as $$
  select u.*
  from public.users u
  where u.id = auth.uid()
  limit 1;
$$;

create or replace function public.current_org_id()
returns uuid
language sql
stable
as $$
  select organization_id
  from public.users
  where id = auth.uid()
  limit 1;
$$;

create or replace function public.has_role(required_roles public.app_role[])
returns boolean
language sql
stable
as $$
  select exists(
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = any(required_roles)
  );
$$;

alter table public.organizations enable row level security;
alter table public.users enable row level security;
alter table public.locations enable row level security;
alter table public.tours enable row level security;
alter table public.products enable row level security;
alter table public.product_movements enable row level security;
alter table public.issues enable row level security;
alter table public.activity_logs enable row level security;
alter table public.organization_billing enable row level security;

drop policy if exists "org_select" on public.organizations;
create policy "org_select"
on public.organizations for select
using (id = public.current_org_id());

drop policy if exists "users_select_same_org" on public.users;
create policy "users_select_same_org"
on public.users for select
using (organization_id = public.current_org_id());

drop policy if exists "users_admin_write" on public.users;
create policy "users_admin_write"
on public.users for all
using (
  organization_id = public.current_org_id()
  and public.has_role(array['admin']::public.app_role[])
)
with check (
  organization_id = public.current_org_id()
  and public.has_role(array['admin']::public.app_role[])
);

drop policy if exists "locations_rw" on public.locations;
create policy "locations_rw"
on public.locations for all
using (
  organization_id = public.current_org_id()
  and public.has_role(array['admin', 'manager']::public.app_role[])
)
with check (
  organization_id = public.current_org_id()
  and public.has_role(array['admin', 'manager']::public.app_role[])
);

drop policy if exists "locations_ro" on public.locations;
create policy "locations_ro"
on public.locations for select
using (organization_id = public.current_org_id());

drop policy if exists "products_select_same_org" on public.products;
create policy "products_select_same_org"
on public.products for select
using (organization_id = public.current_org_id());

drop policy if exists "products_write_manager_plus" on public.products;
create policy "products_write_manager_plus"
on public.products for all
using (
  organization_id = public.current_org_id()
  and public.has_role(array['admin', 'manager', 'technician']::public.app_role[])
)
with check (
  organization_id = public.current_org_id()
  and public.has_role(array['admin', 'manager', 'technician']::public.app_role[])
);

drop policy if exists "tours_select_same_org" on public.tours;
create policy "tours_select_same_org"
on public.tours for select
using (organization_id = public.current_org_id());

drop policy if exists "tours_write_manager_plus" on public.tours;
create policy "tours_write_manager_plus"
on public.tours for all
using (
  organization_id = public.current_org_id()
  and public.has_role(array['admin', 'manager']::public.app_role[])
)
with check (
  organization_id = public.current_org_id()
  and public.has_role(array['admin', 'manager']::public.app_role[])
);

drop policy if exists "movements_select_same_org" on public.product_movements;
create policy "movements_select_same_org"
on public.product_movements for select
using (organization_id = public.current_org_id());

drop policy if exists "movements_write_tech_plus" on public.product_movements;
create policy "movements_write_tech_plus"
on public.product_movements for insert
with check (
  organization_id = public.current_org_id()
  and public.has_role(array['admin', 'manager', 'technician']::public.app_role[])
);

drop policy if exists "issues_select_same_org" on public.issues;
create policy "issues_select_same_org"
on public.issues for select
using (organization_id = public.current_org_id());

drop policy if exists "issues_write_tech_plus" on public.issues;
create policy "issues_write_tech_plus"
on public.issues for all
using (
  organization_id = public.current_org_id()
  and public.has_role(array['admin', 'manager', 'technician']::public.app_role[])
)
with check (
  organization_id = public.current_org_id()
  and public.has_role(array['admin', 'manager', 'technician']::public.app_role[])
);

drop policy if exists "logs_select_manager_plus" on public.activity_logs;
create policy "logs_select_manager_plus"
on public.activity_logs for select
using (
  organization_id = public.current_org_id()
  and public.has_role(array['admin', 'manager']::public.app_role[])
);

drop policy if exists "logs_insert_app" on public.activity_logs;
create policy "logs_insert_app"
on public.activity_logs for insert
with check (
  organization_id = public.current_org_id()
  and public.has_role(array['admin', 'manager', 'technician']::public.app_role[])
);

drop policy if exists "billing_admin_only" on public.organization_billing;
create policy "billing_admin_only"
on public.organization_billing for all
using (
  organization_id = public.current_org_id()
  and public.has_role(array['admin']::public.app_role[])
)
with check (
  organization_id = public.current_org_id()
  and public.has_role(array['admin']::public.app_role[])
);

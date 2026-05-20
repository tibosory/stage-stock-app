# SaaS Setup (5 minutes)

## 1) Apply database scripts

Run in order:

1. `supabase/schema_saas.sql`
2. `supabase/bootstrap_saas.sql`

## 2) Create first organization (admin user)

Connect with your first user in the app (or Supabase SQL editor as authenticated session), then call:

```sql
select public.bootstrap_create_organization('Ma Régie', 'free');
```

This creates:
- one row in `organizations`
- one row in `users` for current auth user as `admin`
- one row in `organization_billing` (`free`, inactive)

## 3) Invite users (admin only)

Prepare invite payload:

```sql
select public.bootstrap_invite_user('tech@exemple.com', 'technician');
```

Then create user in `auth.users` via server-side admin API, and finalize membership:

```sql
select public.bootstrap_complete_user_membership('technician', '<org_uuid>'::uuid);
```

## 4) Deploy Edge Functions

See `supabase/functions/README.md`, then deploy:

```bash
supabase functions deploy ai-parse-query
supabase functions deploy ai-analyze-material-image
supabase functions deploy ai-generate-report-summary
supabase functions deploy stripe-webhook
supabase functions deploy export-pdf-report
```

## 5) Enable SaaS mode in app

Set:

```env
EXPO_PUBLIC_SAAS_MODE=true
```

Rebuild app.

## 6) Billing (Stripe)

Configure Stripe webhook endpoint to `stripe-webhook` function.

Required secrets:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

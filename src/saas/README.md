# StageStock SaaS Layer

Ce dossier contient la couche SaaS multi-tenant prête à brancher:

- `types.ts`: contrats data B2B (org/users/products/tours/issues/billing/audit).
- `services/tenantApi.ts`: accès Supabase multi-tenant (RLS-driven).
- `services/offlineSync.ts`: queue offline-first + retry + LWW.
- `services/ai.ts`: IA JSON-only via Edge Functions.
- `featureFlags.ts`: feature flags distants (`/api/v1/feature-flags`) + cache TTL + fallback local.
- `hooks/useSaasData.ts`: hooks data pour dashboard/modules.
- `hooks/useRbac.ts`: permissions RBAC frontend.
- `hooks/useFeatureFlags.ts`: hook React de récupération/rafraîchissement des flags SaaS.
- `navigation/SaaSNavigator.tsx`: structure Auth + App + Tabs.

## Déploiement backend

1. Exécuter `supabase/schema_saas.sql`.
2. Vérifier que les utilisateurs ont une ligne dans `public.users` avec `organization_id`.
3. Créer les Edge Functions:
   - `ai-analyze-material-image`
   - `ai-parse-query`
   - `ai-generate-report-summary`
4. Configurer Stripe (webhooks) pour `organization_billing`.

## Notes production

- Les politiques RLS empêchent tout accès cross-tenant.
- Les restrictions de plan (free/pro/enterprise) se font dans:
  - Edge Functions (hard checks)
  - frontend (`useRbac`) pour UX.

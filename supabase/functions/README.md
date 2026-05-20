# Supabase Edge Functions (SaaS)

Fonctions fournies (templates):

- `ai-parse-query`
- `ai-analyze-material-image`
- `ai-generate-report-summary`
- `stripe-webhook`
- `export-pdf-report`

## Déploiement

```bash
supabase functions deploy ai-parse-query
supabase functions deploy ai-analyze-material-image
supabase functions deploy ai-generate-report-summary
supabase functions deploy stripe-webhook
supabase functions deploy export-pdf-report
```

## Secrets requis

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY` (webhook)
- `STRIPE_WEBHOOK_SECRET` (webhook)

## Notes

- Les fonctions IA retournent du JSON structuré uniquement.
- `stripe-webhook` met à jour `organization_billing` depuis les événements Stripe.
- `export-pdf-report` est un stub à connecter à votre renderer PDF final.

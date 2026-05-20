-- =============================================================================
-- StageStock (app mobile) — compléter les tables sync vers Supabase
-- =============================================================================
-- À coller dans Supabase : menu gauche → SQL → New query → Run.
-- (Personne d’autre ne peut exécuter ce script sur TON projet : il faut
--  être connecté sur supabase.com dans ton workspace.)
--
-- À utiliser si l’erreur dit : column materiels.updated_at does not exist
-- ou équivalent pour consommables / prets.
-- =============================================================================

ALTER TABLE materiels ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE materiels ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
UPDATE materiels
SET created_at = COALESCE(created_at, now()),
    updated_at = COALESCE(updated_at, created_at, now());

ALTER TABLE consommables ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE consommables ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
UPDATE consommables
SET created_at = COALESCE(created_at, now()),
    updated_at = COALESCE(updated_at, created_at, now());

ALTER TABLE prets ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE prets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
UPDATE prets
SET created_at = COALESCE(created_at, now()),
    updated_at = COALESCE(updated_at, created_at, now());

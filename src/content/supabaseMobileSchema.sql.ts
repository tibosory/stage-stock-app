/**
 * Schéma PostgreSQL Supabase — inventaire mobile + module Régie.
 * Source unique : export app (supabaseSchemaSql) + migration repo supabase/migrations/.
 */
export const SUPABASE_MOBILE_SCHEMA_SQL = `-- CATRACK Pro — schéma Supabase (inventaire + Régie + storage)
-- SQL Editor Supabase : New query → coller → Run (nouveau projet : une fois).

-- ── Catalogues ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  nom TEXT NOT NULL,
  parent_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS localisations (
  id TEXT PRIMARY KEY,
  nom TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── Inventaire ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS materiels (
  id TEXT PRIMARY KEY,
  nom TEXT NOT NULL,
  type TEXT,
  marque TEXT,
  numero_serie TEXT,
  poids_kg DOUBLE PRECISION,
  categorie_id TEXT REFERENCES categories(id),
  localisation_id TEXT REFERENCES localisations(id),
  etat TEXT DEFAULT 'bon',
  statut TEXT DEFAULT 'en stock',
  date_achat TEXT,
  date_validite TEXT,
  prochain_controle TEXT,
  intervalle_controle_jours INTEGER,
  maintenance_todo TEXT,
  maintenance_last_comment TEXT,
  technicien TEXT,
  qr_code TEXT,
  nfc_tag_id TEXT,
  photo_url TEXT,
  photo_local TEXT,
  notice_pdf_local TEXT,
  notice_photo_local TEXT,
  notice_pdf_url TEXT,
  notice_photo_url TEXT,
  vgp_actif BOOLEAN DEFAULT false,
  vgp_periodicite_jours INTEGER,
  vgp_derniere_visite TEXT,
  vgp_libelle TEXT,
  vgp_epi BOOLEAN DEFAULT false,
  gel_brand TEXT,
  gel_code TEXT,
  gel_instead_of_photo BOOLEAN DEFAULT false,
  prix_unitaire DOUBLE PRECISION,
  technical_data TEXT,
  profile_id TEXT,
  profile_version INTEGER,
  tracking_state TEXT,
  current_tour_id TEXT,
  current_location_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  synced BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS consommables (
  id TEXT PRIMARY KEY,
  nom TEXT NOT NULL,
  reference TEXT,
  unite TEXT DEFAULT 'pièce',
  stock_actuel INTEGER DEFAULT 0,
  seuil_minimum INTEGER DEFAULT 5,
  categorie_id TEXT REFERENCES categories(id),
  localisation_id TEXT REFERENCES localisations(id),
  fournisseur TEXT,
  prix_unitaire DOUBLE PRECISION,
  qr_code TEXT,
  nfc_tag_id TEXT,
  photo_local TEXT,
  photo_url TEXT,
  gel_brand TEXT,
  gel_code TEXT,
  gel_instead_of_photo BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  synced BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS prets (
  id TEXT PRIMARY KEY,
  numero_feuille TEXT,
  statut TEXT DEFAULT 'en cours',
  emprunteur TEXT NOT NULL,
  organisation TEXT,
  telephone TEXT,
  email TEXT,
  date_depart TEXT NOT NULL,
  retour_prevu TEXT,
  retour_reel TEXT,
  valeur_estimee DOUBLE PRECISION,
  commentaire TEXT,
  signature_emprunteur_data TEXT,
  signed_at TEXT,
  emprunteur_user_id TEXT,
  rappel_jours_avant INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  synced BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS pret_materiels (
  id TEXT PRIMARY KEY,
  pret_id TEXT NOT NULL REFERENCES prets(id) ON DELETE CASCADE,
  materiel_id TEXT NOT NULL REFERENCES materiels(id),
  quantite INTEGER DEFAULT 1,
  retourne BOOLEAN DEFAULT false,
  etat_au_retour TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── Module Régie ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conduites (
  id TEXT PRIMARY KEY,
  nom_spectacle TEXT NOT NULL DEFAULT '',
  tour_id TEXT,
  titre TEXT NOT NULL DEFAULT '',
  departement TEXT NOT NULL DEFAULT 'generale',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  synced BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS tops (
  id TEXT PRIMARY KEY,
  conduite_id TEXT NOT NULL REFERENCES conduites(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  minutage TEXT,
  minutage_secondes INTEGER,
  departement TEXT NOT NULL DEFAULT 'autre',
  description TEXT NOT NULL DEFAULT '',
  detail TEXT,
  localisation TEXT,
  action TEXT,
  repere TEXT,
  effectue BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  synced BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS mises_techniques (
  id TEXT PRIMARY KEY,
  nom_spectacle TEXT NOT NULL DEFAULT '',
  tour_id TEXT,
  titre TEXT NOT NULL DEFAULT '',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  synced BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS etapes (
  id TEXT PRIMARY KEY,
  mise_technique_id TEXT NOT NULL REFERENCES mises_techniques(id) ON DELETE CASCADE,
  ordre INTEGER NOT NULL,
  nom TEXT NOT NULL DEFAULT '',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  synced BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS positions (
  id TEXT PRIMARY KEY,
  etape_id TEXT NOT NULL REFERENCES etapes(id) ON DELETE CASCADE,
  materiel_id TEXT REFERENCES materiels(id) ON DELETE SET NULL,
  nom_objet TEXT NOT NULL DEFAULT '',
  description_emplacement TEXT NOT NULL DEFAULT '',
  zone TEXT DEFAULT 'non_definie',
  notes TEXT,
  ordre INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  synced BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS position_photos (
  id TEXT PRIMARY KEY,
  position_id TEXT NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  local_uri TEXT DEFAULT '',
  photo_url TEXT,
  ordre INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  synced BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_materiels_updated_at ON materiels(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_consommables_updated_at ON consommables(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_prets_updated_at ON prets(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conduites_updated_at ON conduites(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tops_updated_at ON tops(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_mises_techniques_updated_at ON mises_techniques(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_etapes_updated_at ON etapes(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_positions_updated_at ON positions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_position_photos_updated_at ON position_photos(updated_at DESC);

-- ── RLS (clé anon — même modèle que l’app mobile) ───────────────────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'categories','localisations',
    'materiels','consommables','prets','pret_materiels',
    'conduites','tops','mises_techniques','etapes','positions','position_photos'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS allow_all ON %I', t);
    EXECUTE format('CREATE POLICY allow_all ON %I FOR ALL USING (true)', t);
  END LOOP;
END $$;

-- ── Storage (photos matériel / consommables / mise technique) ───────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS photos_bucket_all ON storage.objects;
CREATE POLICY photos_bucket_all ON storage.objects
  FOR ALL USING (bucket_id = 'photos');

-- Accueil Pro (sync séparée) : exécutez aussi
-- supabase/migrations/20260520120000_accueilpro_mobile_sync_tables.sql
`;

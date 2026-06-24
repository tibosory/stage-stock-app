/**
 * Schéma PostgreSQL Supabase — inventaire mobile + module Régie.
 * Source unique : export app (supabaseSchemaSql) + migration repo supabase/migrations/.
 *
 * Important : toutes les clés primaires sont TEXT (identifiants générés par l'app mobile).
 * Le script exporté nettoie seul un projet Supabase existant (id UUID, colonne material_id).
 */
export const SUPABASE_MOBILE_SCHEMA_SQL = `-- CATRACK Pro — schéma Supabase complet (inventaire + Régie + Accueil Pro + storage)
-- SQL Editor Supabase : New query → coller tout → « Exécutez et activez RLS » (ou Run).
-- Une seule exécution : nettoie automatiquement un ancien schéma incompatible (id UUID, colonne material_id).
-- Les données cloud inventaire/Régie/Accueil Pro sont recréées vides ; resynchronisez depuis le téléphone (Envoyer ↑).
-- Tables portail UUID (venues, organizations…) hors ap_* : non modifiées.

-- ── Nettoyage inventaire + Régie (id non-TEXT, colonne legacy material_id) ─
DO $$
DECLARE
  must_reset boolean;
  mat_typ text;
BEGIN
  SELECT bool_or(t.typname <> 'text') INTO must_reset
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
  JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped AND a.attname = 'id'
  JOIN pg_type t ON t.oid = a.atttypid
  WHERE c.relname = ANY(ARRAY[
    'categories','localisations','materiels','consommables','prets',
    'conduites','tops','mises_techniques','etapes','positions','position_photos'
  ]);

  must_reset := COALESCE(must_reset, false);

  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
    JOIN pg_attribute a ON a.attrelid = c.oid AND NOT a.attisdropped
    WHERE c.relname = 'pret_materiels' AND a.attname = 'material_id'
  ) THEN
    must_reset := true;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
    WHERE c.relname = 'pret_materiels'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
    JOIN pg_attribute a ON a.attrelid = c.oid AND NOT a.attisdropped
    JOIN pg_type t ON t.oid = a.atttypid
    WHERE c.relname = 'pret_materiels' AND a.attname = 'materiel_id' AND t.typname = 'text'
  ) THEN
    must_reset := true;
  END IF;

  SELECT t.typname INTO mat_typ
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
  JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
  JOIN pg_type t ON t.oid = a.atttypid
  WHERE c.relname = 'materiels' AND a.attname = 'id';

  IF mat_typ IS NOT NULL AND mat_typ <> 'text' THEN
    must_reset := true;
  END IF;

  IF must_reset THEN
    DROP TABLE IF EXISTS public.position_photos CASCADE;
    DROP TABLE IF EXISTS public.positions CASCADE;
    DROP TABLE IF EXISTS public.etapes CASCADE;
    DROP TABLE IF EXISTS public.mises_techniques CASCADE;
    DROP TABLE IF EXISTS public.tops CASCADE;
    DROP TABLE IF EXISTS public.conduites CASCADE;
    DROP TABLE IF EXISTS public.pret_materiels CASCADE;
    DROP TABLE IF EXISTS public.prets CASCADE;
    DROP TABLE IF EXISTS public.consommables CASCADE;
    DROP TABLE IF EXISTS public.materiels CASCADE;
    DROP TABLE IF EXISTS public.localisations CASCADE;
    DROP TABLE IF EXISTS public.categories CASCADE;
    RAISE NOTICE 'Inventaire/Régie : schéma incompatible supprimé, recréation en TEXT.';
  END IF;
END $$;

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

-- ── Inventaire (FK vers materiels/prets ajoutées plus bas) ───────────────────
CREATE TABLE IF NOT EXISTS materiels (
  id TEXT PRIMARY KEY,
  nom TEXT NOT NULL,
  type TEXT,
  marque TEXT,
  numero_serie TEXT,
  poids_kg DOUBLE PRECISION,
  categorie_id TEXT,
  localisation_id TEXT,
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
  categorie_id TEXT,
  localisation_id TEXT,
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
  pret_id TEXT NOT NULL,
  materiel_id TEXT NOT NULL,
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
  materiel_id TEXT,
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

-- ── Colonnes manquantes (projet déjà partiellement migré) ────────────────────
ALTER TABLE materiels ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE materiels ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE materiels ADD COLUMN IF NOT EXISTS synced BOOLEAN DEFAULT true;
ALTER TABLE consommables ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE consommables ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE consommables ADD COLUMN IF NOT EXISTS synced BOOLEAN DEFAULT true;
ALTER TABLE prets ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE prets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE prets ADD COLUMN IF NOT EXISTS synced BOOLEAN DEFAULT true;
ALTER TABLE pret_materiels ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- ── Contraintes FK inventaire (uniquement si materiels.id = TEXT) ────────────
DO $$
DECLARE
  mat_typ text;
BEGIN
  SELECT t.typname INTO mat_typ
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
  JOIN pg_type t ON t.oid = a.atttypid
  WHERE n.nspname = 'public' AND c.relname = 'materiels' AND a.attname = 'id';

  IF mat_typ IS DISTINCT FROM 'text' THEN
    DROP TABLE IF EXISTS public.pret_materiels CASCADE;
    DROP TABLE IF EXISTS public.prets CASCADE;
    DROP TABLE IF EXISTS public.consommables CASCADE;
    DROP TABLE IF EXISTS public.materiels CASCADE;
    DROP TABLE IF EXISTS public.localisations CASCADE;
    DROP TABLE IF EXISTS public.categories CASCADE;
    ALTER TABLE positions DROP CONSTRAINT IF EXISTS positions_materiel_id_fkey;
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
    CREATE TABLE IF NOT EXISTS materiels (
      id TEXT PRIMARY KEY,
      nom TEXT NOT NULL,
      type TEXT,
      marque TEXT,
      numero_serie TEXT,
      poids_kg DOUBLE PRECISION,
      categorie_id TEXT,
      localisation_id TEXT,
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
      categorie_id TEXT,
      localisation_id TEXT,
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
      pret_id TEXT NOT NULL,
      materiel_id TEXT NOT NULL,
      quantite INTEGER DEFAULT 1,
      retourne BOOLEAN DEFAULT false,
      etat_au_retour TEXT,
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  END IF;

  ALTER TABLE pret_materiels DROP CONSTRAINT IF EXISTS pret_materiels_materiel_id_fkey;
  ALTER TABLE pret_materiels DROP CONSTRAINT IF EXISTS pret_materiels_material_id_fkey;
  ALTER TABLE pret_materiels DROP CONSTRAINT IF EXISTS pret_materiels_pret_id_fkey;
  ALTER TABLE positions DROP CONSTRAINT IF EXISTS positions_materiel_id_fkey;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND constraint_name = 'materiels_categorie_id_fkey'
  ) THEN
    ALTER TABLE materiels ADD CONSTRAINT materiels_categorie_id_fkey
      FOREIGN KEY (categorie_id) REFERENCES categories(id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND constraint_name = 'materiels_localisation_id_fkey'
  ) THEN
    ALTER TABLE materiels ADD CONSTRAINT materiels_localisation_id_fkey
      FOREIGN KEY (localisation_id) REFERENCES localisations(id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND constraint_name = 'consommables_categorie_id_fkey'
  ) THEN
    ALTER TABLE consommables ADD CONSTRAINT consommables_categorie_id_fkey
      FOREIGN KEY (categorie_id) REFERENCES categories(id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND constraint_name = 'consommables_localisation_id_fkey'
  ) THEN
    ALTER TABLE consommables ADD CONSTRAINT consommables_localisation_id_fkey
      FOREIGN KEY (localisation_id) REFERENCES localisations(id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND constraint_name = 'pret_materiels_pret_id_fkey'
  ) THEN
    ALTER TABLE pret_materiels ADD CONSTRAINT pret_materiels_pret_id_fkey
      FOREIGN KEY (pret_id) REFERENCES prets(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND constraint_name = 'pret_materiels_materiel_id_fkey'
  ) THEN
    ALTER TABLE pret_materiels ADD CONSTRAINT pret_materiels_materiel_id_fkey
      FOREIGN KEY (materiel_id) REFERENCES materiels(id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND constraint_name = 'positions_materiel_id_fkey'
  ) THEN
    ALTER TABLE positions ADD CONSTRAINT positions_materiel_id_fkey
      FOREIGN KEY (materiel_id) REFERENCES materiels(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_materiels_updated_at ON materiels(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_consommables_updated_at ON consommables(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_prets_updated_at ON prets(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conduites_updated_at ON conduites(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tops_updated_at ON tops(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_mises_techniques_updated_at ON mises_techniques(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_etapes_updated_at ON etapes(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_positions_updated_at ON positions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_position_photos_updated_at ON position_photos(updated_at DESC);

-- ── Nettoyage Accueil Pro mobile (ap_* id non-TEXT) ─────────────────────────
DO $$
DECLARE
  ap_reset boolean;
BEGIN
  SELECT bool_or(t.typname <> 'text') INTO ap_reset
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
  JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped AND a.attname = 'id'
  JOIN pg_type t ON t.oid = a.atttypid
  WHERE c.relname = ANY(ARRAY[
    'ap_venues','ap_organizations','ap_spaces','ap_organization_contacts',
    'ap_organization_documents','ap_rental_requests','ap_events','ap_conventions',
    'ap_room_inspections','ap_team_members','ap_event_personnel','ap_day_plan_items'
  ]);

  IF COALESCE(ap_reset, false) THEN
    DROP TABLE IF EXISTS public.ap_day_notes CASCADE;
    DROP TABLE IF EXISTS public.ap_day_plan_items CASCADE;
    DROP TABLE IF EXISTS public.ap_event_personnel CASCADE;
    DROP TABLE IF EXISTS public.ap_team_members CASCADE;
    DROP TABLE IF EXISTS public.ap_room_inspections CASCADE;
    DROP TABLE IF EXISTS public.ap_conventions CASCADE;
    DROP TABLE IF EXISTS public.ap_events CASCADE;
    DROP TABLE IF EXISTS public.ap_rental_requests CASCADE;
    DROP TABLE IF EXISTS public.ap_organization_documents CASCADE;
    DROP TABLE IF EXISTS public.ap_organization_contacts CASCADE;
    DROP TABLE IF EXISTS public.ap_spaces CASCADE;
    DROP TABLE IF EXISTS public.ap_organizations CASCADE;
    DROP TABLE IF EXISTS public.ap_venues CASCADE;
    RAISE NOTICE 'Accueil Pro mobile (ap_*) : schéma incompatible supprimé, recréation en TEXT.';
  END IF;
END $$;

-- ── Accueil Pro mobile (ap_*) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ap_venues (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  address TEXT,
  cp TEXT,
  city TEXT,
  phone TEXT,
  email TEXT,
  erp_type TEXT,
  erp_category TEXT,
  capacity INTEGER,
  fire_notes TEXT,
  safety_rules TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  synced BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS ap_organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  type TEXT,
  siret TEXT,
  address TEXT,
  cp TEXT,
  city TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  supabase_user_id TEXT,
  status TEXT DEFAULT 'actif',
  notes_internes TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  synced BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS ap_spaces (
  id TEXT PRIMARY KEY,
  venue_id TEXT NOT NULL REFERENCES ap_venues(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  type TEXT,
  capacity INTEGER,
  description TEXT,
  control_points_json TEXT DEFAULT '[]',
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  synced BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS ap_organization_contacts (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES ap_organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  role TEXT,
  phone TEXT,
  email TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  synced BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS ap_organization_documents (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES ap_organizations(id) ON DELETE CASCADE,
  event_id TEXT,
  title TEXT NOT NULL DEFAULT '',
  category TEXT,
  storage_path TEXT,
  public_url TEXT,
  file_size INTEGER,
  mime_type TEXT,
  uploaded_by TEXT,
  file_path TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  synced BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS ap_rental_requests (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES ap_organizations(id) ON DELETE CASCADE,
  venue_id TEXT REFERENCES ap_venues(id) ON DELETE SET NULL,
  space_id TEXT,
  space_ids_json TEXT,
  spaces_mode TEXT DEFAULT 'all',
  selected_space_ids_json TEXT,
  event_name TEXT,
  event_type TEXT,
  date_debut TEXT,
  date_fin TEXT,
  heure_debut TEXT,
  heure_fin TEXT,
  participants INTEGER,
  description TEXT,
  motif TEXT,
  staff_notes TEXT,
  all_spaces BOOLEAN DEFAULT false,
  notes TEXT,
  status TEXT DEFAULT 'en_attente',
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  synced BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS ap_events (
  id TEXT PRIMARY KEY,
  venue_id TEXT REFERENCES ap_venues(id) ON DELETE SET NULL,
  organization_id TEXT REFERENCES ap_organizations(id) ON DELETE SET NULL,
  rental_request_id TEXT,
  name TEXT NOT NULL DEFAULT '',
  type TEXT,
  organisateur TEXT,
  date_debut TEXT,
  date_fin TEXT,
  heure_debut TEXT,
  heure_fin TEXT,
  participants INTEGER,
  description TEXT,
  status TEXT DEFAULT 'brouillon',
  spaces_mode TEXT DEFAULT 'all',
  selected_space_ids_json TEXT,
  space_id TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  synced BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS ap_conventions (
  id TEXT PRIMARY KEY,
  event_id TEXT REFERENCES ap_events(id) ON DELETE SET NULL,
  titre TEXT NOT NULL DEFAULT '',
  contenu TEXT,
  status TEXT DEFAULT 'brouillon',
  signature_data TEXT,
  signed_at TIMESTAMPTZ,
  signed_by TEXT,
  document_storage_path TEXT,
  document_filename TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  synced BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS ap_room_inspections (
  id TEXT PRIMARY KEY,
  event_id TEXT REFERENCES ap_events(id) ON DELETE CASCADE,
  space_id TEXT REFERENCES ap_spaces(id) ON DELETE SET NULL,
  space_name TEXT,
  type TEXT,
  status TEXT DEFAULT 'en cours',
  date TEXT,
  inspection_date TEXT,
  representant_lieu TEXT,
  representant_orga TEXT,
  verifications TEXT,
  commentaire TEXT,
  photos TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  synced BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS ap_team_members (
  id TEXT PRIMARY KEY,
  venue_id TEXT NOT NULL REFERENCES ap_venues(id) ON DELETE CASCADE,
  organization_id TEXT,
  name TEXT NOT NULL DEFAULT '',
  role TEXT,
  mission TEXT,
  phone TEXT,
  email TEXT,
  kind TEXT DEFAULT 'lieu',
  role_permanent BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  synced BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS ap_event_personnel (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES ap_events(id) ON DELETE CASCADE,
  source TEXT DEFAULT 'adhoc',
  name TEXT NOT NULL DEFAULT '',
  day_role TEXT,
  day_mission TEXT,
  phone TEXT,
  email TEXT,
  source_personnel_id TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  synced BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS ap_day_plan_items (
  id TEXT PRIMARY KEY,
  plan_date TEXT NOT NULL,
  event_id TEXT REFERENCES ap_events(id) ON DELETE SET NULL,
  time_start TEXT,
  time_end TEXT,
  title TEXT NOT NULL DEFAULT '',
  assignee_name TEXT,
  space_id TEXT REFERENCES ap_spaces(id) ON DELETE SET NULL,
  venue_id TEXT REFERENCES ap_venues(id) ON DELETE SET NULL,
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  synced BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS ap_day_notes (
  plan_date TEXT PRIMARY KEY,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  synced BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_ap_venues_updated ON ap_venues(updated_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_ap_events_updated ON ap_events(updated_at DESC NULLS LAST);

-- ── RLS (clé anon — même modèle que l'app mobile) ───────────────────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'categories','localisations',
    'materiels','consommables','prets','pret_materiels',
    'conduites','tops','mises_techniques','etapes','positions','position_photos',
    'ap_venues','ap_organizations','ap_spaces','ap_organization_contacts',
    'ap_organization_documents','ap_rental_requests','ap_events','ap_conventions',
    'ap_room_inspections','ap_team_members','ap_event_personnel',
    'ap_day_plan_items','ap_day_notes'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS allow_all ON %I', t);
    EXECUTE format('CREATE POLICY allow_all ON %I FOR ALL USING (true)', t);
  END LOOP;
END $$;

-- ── Storage ─────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS photos_bucket_all ON storage.objects;
CREATE POLICY photos_bucket_all ON storage.objects
  FOR ALL USING (bucket_id = 'photos');

INSERT INTO storage.buckets (id, name, public)
VALUES ('accueilpro-files', 'accueilpro-files', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS accueilpro_files_all ON storage.objects;
CREATE POLICY accueilpro_files_all ON storage.objects
  FOR ALL USING (bucket_id = 'accueilpro-files');
`;

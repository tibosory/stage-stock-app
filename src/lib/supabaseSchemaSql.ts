import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

const SUPABASE_SCHEMA_SQL = `-- StageStock - schema SQL minimal pour Supabase
-- Collez dans Supabase : gauche SQL > SQL Editor > New query > Run.
--
-- Nouveau projet : executez tout le fichier une fois.
-- Projet existant (erreur "updated_at") : voyez aussi dans le depot :
--   StageStock/supabase/patch_mobile_sync_tables_timestamps.sql (section courte a copier seule).

CREATE TABLE IF NOT EXISTS materiels (
  id TEXT PRIMARY KEY,
  nom TEXT NOT NULL,
  type TEXT,
  marque TEXT,
  numero_serie TEXT,
  poids_kg REAL,
  categorie_id TEXT,
  localisation_id TEXT,
  etat TEXT DEFAULT 'bon',
  statut TEXT DEFAULT 'en stock',
  date_achat TEXT,
  date_validite TEXT,
  technicien TEXT,
  qr_code TEXT,
  nfc_tag_id TEXT,
  photo_url TEXT,
  photo_local TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  synced BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS consommables (
  id TEXT PRIMARY KEY,
  nom TEXT NOT NULL,
  reference TEXT,
  unite TEXT DEFAULT 'piece',
  stock_actuel INT DEFAULT 0,
  seuil_minimum INT DEFAULT 5,
  categorie_id TEXT,
  localisation_id TEXT,
  fournisseur TEXT,
  prix_unitaire REAL,
  qr_code TEXT,
  nfc_tag_id TEXT,
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
  valeur_estimee REAL,
  commentaire TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  synced BOOLEAN DEFAULT true
);

ALTER TABLE materiels ENABLE ROW LEVEL SECURITY;
ALTER TABLE consommables ENABLE ROW LEVEL SECURITY;
ALTER TABLE prets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS allow_all ON materiels;
DROP POLICY IF EXISTS allow_all ON consommables;
DROP POLICY IF EXISTS allow_all ON prets;

CREATE POLICY allow_all ON materiels FOR ALL USING (true);
CREATE POLICY allow_all ON consommables FOR ALL USING (true);
CREATE POLICY allow_all ON prets FOR ALL USING (true);

-- --- Mise à jour projet existant (ancien SQL sans timestamps) ---
-- Si l'app affiche : column materiels.updated_at does not exist, exécutez puis resynchronisez.
ALTER TABLE materiels ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE materiels ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
UPDATE materiels SET created_at = COALESCE(created_at, now()), updated_at = COALESCE(updated_at, created_at, now()) WHERE true;

ALTER TABLE consommables ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE consommables ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
UPDATE consommables SET created_at = COALESCE(created_at, now()), updated_at = COALESCE(updated_at, created_at, now()) WHERE true;

ALTER TABLE prets ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE prets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
UPDATE prets SET created_at = COALESCE(created_at, now()), updated_at = COALESCE(updated_at, created_at, now()) WHERE true;

-- Accueil Pro (sync mobile, mode Supabase) :
-- exécutez aussi supabase/migrations/20260520120000_accueilpro_mobile_sync_tables.sql
`;

export async function exportShareSupabaseSchemaSql(): Promise<void> {
  const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!dir) throw new Error('Impossible de trouver un dossier local pour exporter le schema SQL.');
  const path = `${dir}stagestock-supabase-schema.sql`;
  await FileSystem.writeAsStringAsync(path, SUPABASE_SCHEMA_SQL, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, {
      mimeType: 'application/sql',
      dialogTitle: 'Schema SQL Supabase StageStock',
      UTI: 'public.sql',
    });
  }
}


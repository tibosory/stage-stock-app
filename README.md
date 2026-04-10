# 📦 Stage Stock

Application Android de gestion d'inventaire pour le matériel de scène et spectacle vivant.

## Fonctionnalités

- **Scanner** : QR codes, codes-barres (tous formats), puces NFC, saisie manuelle, mode lot
- **Stock** : matériels avec photo, état, statut, catégorie, localisation
- **Prêts** : feuilles de prêt avec suivi retour
- **Consommables** : gestion stock avec alertes seuil
- **Alertes** : stocks bas, prêts en retard
- **Paramètres** : catégories, localisations, alertes email, sync cloud
- **Offline/Online** : SQLite local + sync Supabase

---

## Installation

### Prérequis
- Node.js 18+
- Expo CLI : `npm install -g expo-cli`
- EAS CLI : `npm install -g eas-cli`
- Android Studio (ou téléphone Android avec debug USB)

### Setup

```bash
cd StageStock
npm install
```

### Configuration Supabase (optionnel)

1. Créez un projet sur https://supabase.com
2. Créez les tables (script SQL ci-dessous)
3. Créez un bucket `photos` dans Storage
4. Modifiez `src/lib/supabase.ts` :

```typescript
const SUPABASE_URL = 'https://VOTRE_PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'VOTRE_ANON_KEY';
```

Ou utilisez des variables d'environnement dans `.env` :
```
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

#### Script SQL Supabase

```sql
CREATE TABLE materiels (
  id TEXT PRIMARY KEY,
  nom TEXT NOT NULL,
  type TEXT, marque TEXT, numero_serie TEXT, poids_kg REAL,
  categorie_id TEXT, localisation_id TEXT,
  etat TEXT DEFAULT 'bon', statut TEXT DEFAULT 'en stock',
  date_achat TEXT, date_validite TEXT, technicien TEXT,
  qr_code TEXT, nfc_tag_id TEXT, photo_url TEXT, photo_local TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  synced BOOLEAN DEFAULT true
);

CREATE TABLE consommables (
  id TEXT PRIMARY KEY,
  nom TEXT NOT NULL, reference TEXT, unite TEXT DEFAULT 'pièce',
  stock_actuel INT DEFAULT 0, seuil_minimum INT DEFAULT 5,
  categorie_id TEXT, localisation_id TEXT,
  fournisseur TEXT, prix_unitaire REAL,
  qr_code TEXT, nfc_tag_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  synced BOOLEAN DEFAULT true
);

CREATE TABLE prets (
  id TEXT PRIMARY KEY,
  numero_feuille TEXT, statut TEXT DEFAULT 'en cours',
  emprunteur TEXT NOT NULL, organisation TEXT,
  telephone TEXT, email TEXT,
  date_depart TEXT NOT NULL, retour_prevu TEXT,
  retour_reel TEXT, valeur_estimee REAL, commentaire TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  synced BOOLEAN DEFAULT true
);

-- RLS permissif pour usage interne (adaptez selon vos besoins)
ALTER TABLE materiels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON materiels FOR ALL USING (true);
ALTER TABLE consommables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON consommables FOR ALL USING (true);
ALTER TABLE prets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON prets FOR ALL USING (true);
```

---

## Lancement développement

```bash
# Expo Go (sans NFC)
npx expo start

# Sur téléphone Android via USB (avec NFC)
npx expo run:android
```

> ⚠️ **Le NFC ne fonctionne pas dans Expo Go** — il faut un build natif (`expo run:android`).

---

## Build APK de production

```bash
# Configuration EAS
eas build:configure

# Build APK Android
eas build --platform android --profile preview

# Ou APK local (nécessite Android Studio)
npx expo run:android --variant release
```

### Profil EAS (`eas.json`)
```json
{
  "build": {
    "preview": {
      "android": { "buildType": "apk" }
    },
    "production": {
      "android": { "buildType": "app-bundle" }
    }
  }
}
```

---

## Architecture

```
StageStock/
├── App.tsx                     # Entry point, navigation
├── src/
│   ├── types/index.ts          # TypeScript types
│   ├── theme/colors.ts         # Couleurs dark theme
│   ├── db/database.ts          # SQLite : schéma + CRUD complet
│   ├── lib/supabase.ts         # Client Supabase + sync up/down
│   ├── hooks/
│   │   └── useNfc.ts           # Hook NFC (read/write tags)
│   ├── components/
│   │   ├── Icons.tsx           # Icônes légères
│   │   ├── UI.tsx              # Composants réutilisables
│   │   └── MaterielModal.tsx   # Modal ajout/édition matériel
│   └── screens/
│       ├── ScannerScreen.tsx   # Scanner QR/NFC/lot/manuel
│       ├── StockScreen.tsx     # Liste matériels
│       ├── MaterielDetailScreen.tsx  # Fiche détail + photo + NFC
│       ├── PretsScreen.tsx     # Feuilles de prêt
│       ├── ConsommablesScreen.tsx    # Consommables
│       ├── AlertesScreen.tsx   # Alertes stock/retard
│       └── ParamsScreen.tsx    # Paramètres + sync
```

---

## NFC — Fonctionnement

### Lecture
- L'app lit le **contenu texte NDEF** du tag (si présent)
- Fallback sur l'**ID hardware** du tag (UID)
- Recherche dans la DB : correspond à un `nfc_tag_id` ou `id` de matériel

### Écriture
- Écrit l'**ID du matériel** en texte NDEF sur la puce
- Compatible avec tous tags NDEF (NTAG213, NTAG215, NTAG216, Mifare Ultralight…)

### Association sans écriture
- "Associer puce" : lit l'UID hardware et le stocke dans `nfc_tag_id`
- Utile pour les tags déjà programmés ou en métal

---

## Consommables — QR & NFC

Les consommables supportent aussi QR code et NFC. Le scanner redirige automatiquement vers la fiche matériel **ou** consommable selon ce qui est trouvé.

---

## Stack technique

| Composant | Technologie |
|-----------|-------------|
| Framework | React Native + Expo SDK 51 |
| Navigation | React Navigation v6 (Bottom Tabs + Stack) |
| Base locale | expo-sqlite (SQLite WAL) |
| Cloud | Supabase (PostgreSQL + Storage) |
| Caméra/QR | expo-camera (BarcodeScanningResult) |
| Photos | expo-image-picker |
| NFC | react-native-nfc-manager |
| TypeScript | ✅ typage complet |

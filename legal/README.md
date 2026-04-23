# Cadre juridique & commercial — Stage Stock

**Avertissement** : les fichiers de ce dossier sont des **modèles indicatifs**. Ils ne constituent pas un conseil juridique. Faites les **relire et les adapter** avec un **avocat** ou un **DPO** selon votre structure, votre pays et votre cas d’usage (B2B, association, éditeur unique, etc.).

Les textes incluent l’**adresse** (14 rue du Bret, bâtiment 2, 38090 Villefontaine, France) et le contact **tibosory@gmail.com**.  
**Page web unique** sans site perso : dossier **[docs/](./docs/)** + guide **[docs/MISE_EN_LIGNE.md](./docs/MISE_EN_LIGNE.md)** (GitHub Pages → URL HTTPS pour les stores). Il reste à **publier** cette page et à recopier l’URL dans **[CE_QUE_VOUS_DEVEZ_FOURNIR.md](./CE_QUE_VOUS_DEVEZ_FOURNIR.md)** et dans `app.json`.

## Contenu

| Fichier | Usage |
|--------|--------|
| [CE_QUE_VOUS_DEVEZ_FOURNIR.md](./CE_QUE_VOUS_DEVEZ_FOURNIR.md) | Suite à fournir (URL publique, etc.) — statut **personne physique** confirmé |
| [CGU.md](./CGU.md) | Conditions générales d’utilisation (utilisateur final / client) |
| [POLITIQUE_CONFIDENTIALITE.md](./POLITIQUE_CONFIDENTIALITE.md) | Politique de confidentialité & RGPD (à publier sur une **URL publique**) |
| [FICHES_STORES.md](./FICHES_STORES.md) | Textes type pour **Google Play** et **App Store** (fiche, confidentialité, catégories) |
| [docs/](./docs/) | **Page web unique** (`index.html` + `.md`) — hébergement type GitHub Pages → URL HTTPS |
| [docs/MISE_EN_LIGNE.md](./docs/MISE_EN_LIGNE.md) | Pas de site perso : comment publier la page légale |

## Liens dans l’application

Les URL **HTTPS** suivantes sont lues au build (`app.json` → `expo.extra`) ou via variables d’environnement **EAS / `.env`** :

| Clé `app.json` (`extra`) | Variable d’environnement |
|--------------------------|-------------------------|
| `privacyPolicyUrl` | `EXPO_PUBLIC_PRIVACY_POLICY_URL` |
| `termsOfServiceUrl` | `EXPO_PUBLIC_TERMS_OF_SERVICE_URL` |

L’env **prime** sur `app.json`. Seules les URL commençant par **`https://`** sont acceptées.

Une fois renseignées, les liens apparaissent dans **Notice utilisateur** et **Paramètres** (carte « Juridique »). Si les deux champs sont vides, rien n’est affiché.

## Checklist avant mise en vente

### Comptes développeur

- [ ] **Google Play Console** — compte développeur (frais annuel / ponctuel selon pays).
- [ ] **Apple Developer Program** — si vous publiez sur iOS (frais annuels).
- [ ] Même identité légale / société alignée avec les contrats clients si applicable.

### Hébergement des documents légaux

Les stores exigent souvent une **URL HTTPS** vers la politique de confidentialité.

- [ ] Publier `POLITIQUE_CONFIDENTIALITE.md` (version HTML ou PDF) sur votre site, **GitHub Pages**, Notion public, ou page Supabase / hébergeur.
- [ ] L’URL doit être **stable** et **accessible sans compte**.

### Données & RGPD (Union européenne)

- [ ] Identifier le **responsable de traitement** (vous, la société, le client B2B ?).
- [ ] Si vous traitez des données pour le compte d’entreprises : prévoir **DPA / sous-traitance** avec vos clients si nécessaire.
- [ ] Tenir à jour le **registre des traitements** (interne).
- [ ] Prévoir les **droits** (accès, rectification, effacement, portabilité) — au minimum un **contact** dans la politique.
- [ ] **Supabase / cloud** : vérifier la **localisation des données** (région du projet) et les mentions contractuelles Supabase.
- [ ] **Notifications push** : base légale (consentement ou intérêt légitime selon contexte) à clarifier avec votre conseil.

### Fiches magasins

- [ ] Remplir [FICHES_STORES.md](./FICHES_STORES.md) avec votre nom commercial, URL, email support.
- [ ] **Google** : questionnaire « Sécurité des données » (Data safety) — cohérent avec la politique.
- [ ] **Apple** : « App Privacy » — déclarer les données collectées comme dans la politique.

### Tests

- [ ] Tests sur **appareils réels** Android (et iOS si concerné).
- [ ] Parcours : inscription / connexion, sync, export, notifications.

### Après publication

- [ ] Conserver les **versions** des CGU / politique (dates de mise à jour).
- [ ] Prévoir une procédure en cas de **fuite de données** ou demande CNIL.

---

*Dernière mise à jour du dossier modèle : à compléter par l’éditeur.*

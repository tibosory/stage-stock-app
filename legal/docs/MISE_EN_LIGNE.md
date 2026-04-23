# Mettre en ligne la page unique (politique + CGU)

Vous n’avez pas de site : ce dossier **`docs/`** contient une **page unique** qui affiche les deux documents.

## Contenu

| Fichier | Rôle |
|---------|------|
| `index.html` | Page web : charge et affiche les `.md` |
| `POLITIQUE_CONFIDENTIALITE.md` | Copie à jour de la politique (source : `legal/POLITIQUE_CONFIDENTIALITE.md`) |
| `CGU.md` | Copie à jour des CGU (source : `legal/CGU.md`) |

Après chaque modification des textes dans `legal/`, **recopiez** les deux fichiers `.md` ici (ou maintenez une seule source et copiez avant déploiement).

## Option A — GitHub Pages (gratuit, HTTPS)

1. Créez un dépôt GitHub (ex. `stage-stock-legal`) **ou** le dépôt d’appli (`tibosory/stagestock`).
2. Placez le **contenu** du dossier `docs/` à la racine du site Pages :
   - soit le dossier `/docs` du dépôt : mettez ces fichiers dans **`[repo]/docs/`** à la racine du repo ;
   - dans **Settings → Pages**, source : **Deploy from a branch**, dossier **`/docs`** sur la branche `main`.
3. Après quelques minutes, l’URL sera du type :  
   **`https://[votre-login].github.io/[nom-repo]/`**
4. Cette URL est votre **politique de confidentialité** pour les stores et pour `app.json` → `privacyPolicyUrl`.
5. Même URL pour **CGU** si les stores acceptent un seul lien (sinon ajoutez `#cgu` à la fin de l’URL si le formulaire le permet).

## Option B — Autre hébergeur

Tout hébergement statique (Netlify, Cloudflare Pages, etc.) : uploadez les **trois fichiers** (`index.html` + les deux `.md`) dans le même répertoire public.

## Test

Ouvrez l’URL dans Chrome : vous devez voir la politique puis les CGU. En **HTTPS** uniquement pour les stores.

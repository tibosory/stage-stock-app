# Fiches magasins — Google Play & App Store

**Textes pré-remplis pour Stage Stock — à ajuster selon les limites de caractères au moment du dépôt.**

**Avertissement :** les déclarations doivent rester **alignées** avec `POLITIQUE_CONFIDENTIALITE.md` une fois publiée.

---

## Informations communes

| Champ | Valeur |
|--------|--------|
| **Nom commercial** | Stage Stock |
| **Éditeur** | Thibaut Sory |
| **Email support** | tibosory@gmail.com |
| **Site web** | Pas de site dédié : utiliser l’URL **GitHub Pages** une fois le dossier `legal/docs` déployé (voir `docs/MISE_EN_LIGNE.md`) |
| **URL politique de confidentialité** | **À remplir après déploiement** — ex. `https://[login].github.io/[repo]/` (HTTPS) |
| **URL conditions d’utilisation** | **Même URL** que la politique (une seule page avec les deux sections) ou ajouter `#cgu` si le formulaire le permet |
| **Catégorie (indicatif)** | Productivité ou Entreprise (Play) / Productivité ou Utilitaires (App Store) |

---

## Google Play

### Titre (≈30 caractères)

```
Stage Stock — Inventaire
```

### Courte description (max 80 caractères)

```
Inventaire matériel & consommables : scan QR/NFC, prêts, alertes, export.
```

### Description longue

```
Stage Stock accompagne les équipes techniques et les structures du spectacle vivant pour suivre le matériel de scène, les consommables et les prêts.

FONCTIONNALITÉS
• Scanner les QR codes, codes-barres et puces NFC
• Fiches matériel avec photos, état, localisation
• Gestion des prêts et des demandes
• Consommables avec seuils d’alerte
• Alertes (retours, VGP, stocks bas)
• Export CSV, Excel et calendrier (.ics)
• Base locale sur l’appareil ; synchronisation possible avec votre cloud (ex. Supabase) selon configuration
• Connexion à un serveur sur réseau local ou Internet selon vos paramètres

PUBLIC
Associations culturelles, salles, compagnies, régisseurs et techniciens qui gèrent un parc matériel.

ASSISTANCE
tibosory@gmail.com

CONFIDENTIALITÉ
[Collez ici l’URL HTTPS de votre politique de confidentialité une fois en ligne]
```

### Notes de version (exemple)

```
Correctifs et améliorations de stabilité. Politique de confidentialité : [URL].
```

### Data safety (Google) — repères

Répondez selon l’app réelle : **contenu créé par l’utilisateur** (inventaire), **identifiants** si compte / session, **photos** si utilisées, **identifiant d’appareil** pour les notifications si vous les déclarez. **Chiffrement en transit** : oui pour HTTPS vers backends configurés. **Suppression des données** : précisez si l’utilisateur peut supprimer compte / données côté cloud (selon votre implémentation).

---

## App Store (Apple)

### Nom (30 car. max)

```
Stage Stock
```

### Sous-titre (30 car. max)

```
Inventaire & prêts matériel
```

### Texte promotionnel (170 car. max) — optionnel

```
Scannez, gérez prêts et consommables. Exports Excel, alertes, mode local avec sync cloud optionnelle. Pour équipes techniques et lieux de spectacle.
```

### Description

```
Stage Stock est une application d’inventaire pour le matériel de scène et les consommables.

• Scan QR, codes-barres et NFC
• Fiches détaillées, photos, localisation
• Prêts, demandes et suivi des retours
• Consommables et seuils d’alerte
• Historique et exports pour vos bilans

L’application fonctionne avec une base locale. Vous pouvez connecter un projet cloud (Supabase) ou un serveur selon votre déploiement.

Assistance : tibosory@gmail.com
Confidentialité : [URL HTTPS à compléter]
```

### Mots-clés (100 car. max)

```
inventaire,stock,qr,nfc,prêt,spectacle,matériel,consommable,théâtre
```

### URL d’assistance

```
À compléter : https://votre-site.fr/support
```

*(Si vous n’avez pas de page support : utilisez un lien `mailto:` n’est en général pas accepté — prévoir une page minimale avec l’email.)*

### URL marketing (optionnel)

```
À compléter
```

### App Privacy

Déclarez les catégories collectées en cohérence avec la politique : par ex. **contenu utilisateur**, **identifiants**, **photos** si applicable, **identifiant d’appareil** pour les notifications.

---

## Tests sur appareils réels — check-list

- [ ] Installation du build (APK / TestFlight).
- [ ] Connexion utilisateur / PIN.
- [ ] Scan et fiche matériel.
- [ ] Export Excel ou CSV.
- [ ] Notifications si activées.
- [ ] Liens « Politique de confidentialité » depuis l’app (Notice / Paramètres).

---

*Mettez à jour les URL dès que vos pages HTTPS sont en ligne.*

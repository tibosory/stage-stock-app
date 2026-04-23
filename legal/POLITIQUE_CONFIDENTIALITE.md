# Politique de confidentialité — Stage Stock

**Document rédigé pour faciliter votre mise en conformité — à publier sur une URL HTTPS publique et à faire valider par un professionnel du droit ou un DPO.**

---

## Identification du responsable du traitement

| | |
|--|--|
| **Responsable du traitement** | Thibaut Sory (personne physique) |
| **Adresse postale** | 14 rue du Bret, bâtiment 2, 38090 Villefontaine, France |
| **Contact données personnelles** | tibosory@gmail.com |
| **Dernière mise à jour** | 18 avril 2026 |

---

## 1. Introduction

La présente politique décrit comment **Thibaut Sory** (« **nous** ») traite les informations à caractère personnel dans le cadre de l’application mobile **Stage Stock** (« l’**Application** »).

Elle s’applique lorsque vous utilisez l’Application depuis l’**Espace économique européen** et vise à respecter le **Règlement général sur la protection des données (RGPD)** et la **loi « Informatique et Libertés »** française.

## 2. Données traitées — vue d’ensemble

Selon votre utilisation et la configuration (déploiement par vous ou par votre organisation), peuvent être concernées notamment :

| Catégorie | Exemples | Finalités principales |
|-----------|----------|------------------------|
| **Compte / session** | identifiant utilisateur interne, nom affiché, rôle (admin, technicien, emprunteur), session stockée localement | accès à l’Application, contrôle des droits |
| **Données métier** | fiches matériel et consommables, stocks, prêts, catégories, localisations, codes QR/NFC, dates, photos associées au matériel | fonctionnement du service d’inventaire et des alertes |
| **Authentification cloud (optionnel)** | identifiant de session ou profil fourni par un fournisseur tiers (ex. **Supabase**) si vous configurez un projet | connexion et fonctions liées au cloud selon votre paramétrage |
| **Données techniques** | jetons de notification push si vous acceptez les notifications, informations de connexion réseau nécessaires au service | rappels (prêts, VGP, seuils), diagnostic de connexion |
| **Configuration** | URL de serveur, paramètres réseau saisis dans l’Application | connexion à votre backend ou à votre cloud |

**Stockage local :** une partie des données est enregistrée **sur l’appareil** (base SQLite et stockage applicatif).

**Synchronisation cloud :** si vous activez un projet **Supabase** (URL + clé d’API « anon » saisie sur l’appareil ou intégrée au build), des données peuvent être **échangées** avec les serveurs de ce fournisseur selon les règles que **vous** configurez (tables, RLS, etc.).

**Photos :** les images peuvent être stockées localement et/ou sur un **stockage distant** (ex. bucket Supabase) si cette fonction est utilisée.

## 3. Bases légales (RGPD)

Nous nous appuyons notamment sur :

- l’**exécution de mesures précontractuelles** ou du **contrat** (mise à disposition et utilisation de l’Application) ;
- l’**intérêt légitime** pour la sécurité du service et la lutte contre les abus, sans préjudice de vos droits ;
- le **consentement** lorsque la réglementation l’exige (par exemple **notifications push** sur l’appareil — accord dans les réglages système / applicatifs) ;
- une **obligation légale** le cas échéant.

Les **notifications** à vocation d’information sur les prêts, VGP ou seuils sont généralement fondées sur l’usage du service ; adaptez avec votre conseil si vous envoyez des messages commerciaux.

## 4. Destinataires et sous-traitants

Les données peuvent être traitées par :

- **Thibaut Sory** ;
- les **sous-traitants techniques** nécessaires au fonctionnement de l’Application, notamment :
  - **Expo / EAS** (builds, mises à jour OTA si activées) — voir les politiques d’Expo ;
  - **Supabase Inc.** si vous utilisez un projet Supabase — voir [https://supabase.com/privacy](https://supabase.com/privacy) ;
  - **Google (Firebase Cloud Messaging)** pour les notifications sur Android, **Apple (APNs)** sur iOS — selon la plateforme ;
  - l’**hébergeur** de toute page web sur laquelle vous publiez la présente politique.

Les **organisations** qui déploient l’Application pour leurs équipes peuvent agir comme **responsables de traitement** distincts pour leurs propres fichiers ; dans ce cas, leurs utilisateurs doivent aussi se référer à la politique interne de la structure.

## 5. Transferts hors UE

Certains prestataires (ex. **Supabase**, **Google**, **Apple**) peuvent traiter des données depuis des pays situés **hors de l’EEE**. Le cas échéant, nous nous appuyons sur les **garanties** prévues par le RGPD (clauses contractuelles types, décisions d’adéquation, etc.) telles que proposées par ces acteurs. Le détail figure dans leurs documentations.

## 6. Durée de conservation

- **Session et compte applicatif local** : tant que vous utilisez l’Application sur l’appareil et, après désinstallation, jusqu’à **effacement** des données par le système ou une nouvelle installation.
- **Données sur serveur tiers (ex. Supabase)** : selon **vos** réglages et la durée de vie du projet côté hébergeur.
- **Données de support** (emails envoyés à **tibosory@gmail.com**) : le temps du traitement de la demande et des **obligations légales** de conservation éventuelles.

## 7. Vos droits

Vous disposez des droits d’**accès**, de **rectification**, d’**effacement**, de **limitation** du traitement, d’**opposition**, de **portabilité** (lorsque applicable), et du droit de **définir des directives** relatives au sort de vos données après votre décès (France).

Pour exercer vos droits : **tibosory@gmail.com** (joindre une copie d’identité si nécessaire pour éviter la fraude).

Vous pouvez introduire une réclamation auprès de la **CNIL** : [www.cnil.fr](https://www.cnil.fr).

## 8. Sécurité

Nous appliquons des mesures **techniques et organisationnelles** raisonnables (dont communication **HTTPS** lorsque vous configurez des services compatibles, stockage local sur l’appareil, contrôle d’accès par rôles dans l’Application). Aucun système n’étant absolument sécurisé, nous ne pouvons garantir une sécurité totale.

## 9. Mineurs

L’Application est destinée à un usage **professionnel ou associatif** (gestion de matériel). Elle n’est pas conçue pour être utilisée par des **mineurs de moins de 15 ans** hors cadre d’encadrement légal ou professionnel. Si vous êtes un parent ou un responsable légal, veillez à l’usage approprié par les mineurs confiés.

## 10. Modifications

Nous pouvons modifier la présente politique. La date de « **Dernière mise à jour** » en tête de document sera révisée. Pour les changements **substantiels**, une information dans l’Application ou par **email** pourra être utilisée lorsque c’est possible.

## 11. Contact

**Responsable du traitement :** Thibaut Sory — 14 rue du Bret, bâtiment 2, 38090 Villefontaine, France.  
**Contact données :** tibosory@gmail.com

---

*Vous êtes actuellement identifié comme **personne physique**. Si vous créez ultérieurement une société ou une micro-entreprise, mettez à jour l’identité du responsable, le numéro SIRET et l’adresse dans ce document et sur les stores.*

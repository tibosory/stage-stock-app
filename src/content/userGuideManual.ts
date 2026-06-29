/**

 * Manuel utilisateur — version française : source métier FR pour l’écran Notice et l’export PDF (langue fr).

 * L’équivalent anglais est dans `userGuideManualEn.ts` (`getUserGuideForLanguage`).

 *

 * → À tenir à jour à chaque évolution UX / fonctionnelle visible (.cursor/rules/stagestock-user-guide.mdc).

 */



export type UserGuideSection = {

  icon: string;

  title: string;

  paragraphs: string[];

  /** Situations concrètes (PDF + notice in-app). */

  examples?: string[];

};



export const USER_GUIDE_META = {

  title: 'CATRACK Pro — Manuel utilisateur',

  subtitle: 'Guide pas à pas avec exemples concrets',

  versionLabel:

    '24 juin 2026 (QR flightcase stock, étiquette contenu)',

};



export const USER_GUIDE_SECTIONS: UserGuideSection[] = [

  {

    icon: '📘',

    title: 'Notice intégrée et export PDF',

    paragraphs: [

      'Ce manuel est accessible dans l’application (écran Notice) et peut être exporté en PDF pour une formation ou une lecture hors ligne.',

      'Après une mise à jour de l’app, rouvrez la Notice pour lire la version correspondant à votre installation.',

      'Le PDF reprend les mêmes sections que l’écran Notice.',

    ],

  },

  {

    icon: '🎯',

    title: 'À quoi sert CATRACK Pro',

    paragraphs: [

      'CATRACK Pro sert à gérer le matériel et les consommables, suivre les prêts, recevoir des alertes (stock bas, retours en retard, maintenance, contrôles VGP) et, si besoin, le suivi de tournées.',

      'L’application fonctionne sans Internet : vos données sont d’abord enregistrées sur le téléphone. La synchronisation envoie ensuite vos modifications vers un seul backend choisi : soit un serveur PC local (Wi‑Fi ou Tailscale), soit Supabase (cloud). Les deux ne fonctionnent jamais en parallèle.',

      'Les actions du quotidien (scanner, stock, consommables) sont sur la barre du bas. L’écran d’accueil regroupe les activités principales en grosses tuiles. L’onglet Menu liste le reste.',

    ],

    examples: [

      'Technicien en régie : ouvrir Scanner, lire un QR, enregistrer une sortie de consommable, puis consulter Alertes pour les retours de prêt du jour.',

    ],

  },

  {

    icon: '🚀',

    title: 'Premier lancement et connexion',

    paragraphs: [

      'À la première installation, un didacticiel vous guide : langue, lieu (facultatif), connexion au serveur PC (recommandée) et profil personnel. Vous pouvez continuer sans serveur : l’app fonctionne hors ligne sur le téléphone.',

      'La connexion se fait avec un code PIN sur l’appareil (administrateur, technicien ou emprunteur). Si le PIN par défaut 1234 est encore actif, l’app demande immédiatement un nouveau code.',

      'Choisissez Français ou English dès le départ ; toute l’interface suit votre choix. Vous pourrez changer de langue plus tard dans Paramètres.',

      'Le bouton Scanner le QR d’appairage connecte le téléphone au PC. L’app teste d’abord l’adresse du QR puis cherche automatiquement le bon port (8091, 8092…). Si le serveur n’est pas disponible, choisissez « Continuer sans serveur » : l’application reste utilisable. Sur le PC, le script backend\\windows\\Fix-StageStockFirewall.ps1 ouvre le port dans le pare-feu si le téléphone ne joint pas le serveur. Diagnostic détaillé : Connexion / Réseau → onglet Diagnostic.',

      'Vous pouvez relancer le didacticiel depuis Paramètres à tout moment.',

    ],

    examples: [

      'Nouveau téléphone : télécharger l’installateur serveur depuis l’assistant, l’installer sur le PC, ouvrir StageStock Local, scanner le QR d’appairage, puis commencer l’inventaire.',

    ],

  },

  {

    icon: '🏠',

    title: 'Écran d’accueil et navigation',

    paragraphs: [

      'Les grosses tuiles ouvrent les espaces principaux : Stock, Consommables, Prêts, etc., selon votre rôle.',

      'La tuile Tout ouvre la barre d’onglets complète (Scanner, Stock, Réseau…).',

      'Le bouton rond accueil dans un espace workspace ramène aux grosses tuiles.',

      'Les emprunteurs voient un menu réduit ; les administrateurs et techniciens accèdent aux écrans de gestion.',

    ],

  },

  {

    icon: '📷',

    title: 'Scanner (QR, codes-barres, NFC)',

    paragraphs: [

      'L’onglet Scanner utilise la caméra pour les QR et codes-barres, ou le NFC si le téléphone le permet.',

      'Caméra : plusieurs codes visibles à l’écran — visez celui voulu, puis touchez l’écran pour lancer la lecture (plus de scan automatique sur le premier code détecté).',

      'QR de jumelage serveur : Connexion / Réseau → « Scanner le QR d’appairage » (ou onglet Scanner) et visez le QR affiché sur la page /pair du PC — pas l’adresse seule sous le QR. Le QR inclut l’URL et la clé API. Si « clé API requise » : rechargez /pair sur le PC et rescannez ; après réinstallation du serveur, l’ancien QR ne sert plus.',

      'Matériel : le code ouvre la fiche ou permet d’en créer une minimale si votre organisation l’autorise.',

      'Flightcase stock : un QR SS-FC:… ouvre la liste des articles rangés dans la caisse (même libellé flightcase + même localisation).',

      'Consommables : entrée ou sortie de stock ; le mode rafale applique la même quantité à chaque scan.',

    ],

    examples: [

      'Sortie consommable : activer Rafale, choisir Sortie, scanner les étiquettes les unes après les autres.',

    ],

  },

  {

    icon: '📦',

    title: 'Stock matériel',

    paragraphs: [

      'Liste filtrable par statut et recherche texte (matériel et consommables depuis la barre de recherche). Touchez un résultat de recherche pour ouvrir sa fiche et la modifier. Appui long sur une ligne ou sur 🗑️ : mode sélection (cocher, tout sélectionner, supprimer en lot ou exporter un PDF).',

      'À la création d’une fiche : le champ « Quantité » remplace l’ancien type. Quantité 1 = pièce unitaire avec son QR. Quantité > 1 = lot (un QR, stock ajustable comme un consommable, bouton ± Ajuster et Scanner).',

      'À l’ajout ou la modification d’une fiche : choisissez une catégorie existante ou créez-en une (parent optionnel pour une sous-catégorie, ex. Éclairage › LED). Sous la localisation (réserve, scène…), vous pouvez préciser un flightcase ou une caisse (ex. FC-Lumière 3) lorsque plusieurs pièces sont rangées ensemble.',

      'Chaque flightcase (même libellé dans la même localisation) possède un QR dédié au format SS-FC:fc_…, distinct du QR de chaque article. Scanner le QR flightcase ouvre la liste du contenu ; scanner le QR d’un article ouvre toujours sa fiche individuelle.',

      'Impression d’étiquettes QR (Stock, Consommables, impression groupée) : chaque étiquette affiche le QR, le nom et la référence de l’article ; la taille du texte s’adapte pour que rien ne soit coupé.',

      'La fiche détail n’affiche que les champs renseignés.',

    ],

  },

  {

    icon: '🛒',

    title: 'Consommables',

    paragraphs: [

      'Liste avec filtre stock sous le seuil et barre de recherche (nom, référence, catégorie, QR…). À l’ajout d’une fiche : sous-catégories et localisations créables sur place (comme dans Stock). Mouvements depuis la fiche, le Scanner ou un import tableur.',

      'Sur chaque tuile, le bouton « ± Ajuster » propose Entrée ou Sortie puis un pavé numérique pour saisir la quantité exacte.',

      'Appui long sur une ligne ou sur 🗑️ : mode sélection (cocher, tout sélectionner, supprimer en lot).',

    ],

  },

  {

    icon: '🧾',

    title: 'Prêts et demandes',

    paragraphs: [

      'Parcours habituel : en demande → en cours → retourné. Feuille de prêt avec signature et export PDF.',

    ],

  },

  {

    icon: '🎪',

    title: 'Tournée (suivi)',

    paragraphs: [

      'Créez une tournée, ajoutez des lieux, affectez du matériel par liste ou par scan. Suivez chaque ligne avec un statut.',

      'Un matériel en tournée ne change de statut que depuis l’écran Tournée.',

      'En fin de tournée (état « terminée » ou « en cours »), ouvrez « Scan retour de tournée » : scannez les QR pour réintégrer le stock, ou recherchez manuellement les articles sans étiquette. L’app affiche les articles manquants par rapport au contenu initial.',

    ],

  },

  {

    icon: '🛎️',

    title: 'Alertes et VGP',

    paragraphs: [

      'Alertes : stocks bas, prêts en retard, maintenance et échéances de contrôle. Notifications configurables dans Paramètres.',

    ],

  },

  {

    icon: '📤',

    title: 'Import / Export',

    paragraphs: [

      'Import et export CSV pour les mises à jour en masse. À l’import matériels : categorie_nom et localisation_nom (ou un libellé dans categorie_id / localisation_id) créent les catégories et localisations absentes ; les chemins « Parent › Enfant » sont supportés pour les catégories. Synchro manuelle depuis Réseau.',

    ],

  },

  {

    icon: '🎭',

    title: 'Conduite et mise technique',

    paragraphs: [

      'Deux outils Régie : la conduite (tops horodatés pour le live) et la mise technique (étapes, positions sur scène, photos d’implantation).',

      'Les textes, tops, étapes et positions se synchronisent avec le serveur PC ou Supabase comme le stock (Envoyer ↑ / Recevoir ↓ dans Réseau).',

      'Les suppressions (conduite, top, étape, objet…) sont propagées au serveur puis aux autres appareils à la prochaine synchronisation.',

      'Les photos de mise technique sont téléversées vers le serveur à l’envoi ↑, puis téléchargées automatiquement sur les autres téléphones au Recevoir ↓.',

      'Activez « Synchro après chaque action » dans Paramètres pour pousser automatiquement après une modification.',

    ],

    examples: [

      'Régisseur sur tablette + chef lumière sur téléphone : même conduite après Recevoir ↓ sur les deux appareils ; le live coche les tops, l’état se propage à la prochaine sync.',

    ],

  },

  {

    icon: '🌐',

    title: 'Réseau, connexion et synchronisation',

    paragraphs: [

      'Ouvrez la tuile Connexion (accueil ou ALL → Connexion). En haut, choisissez comment synchroniser :',

      '• Serveur local sur PC (Wi‑Fi ou Tailscale) — inventaire, prêts, conduites, mises techniques et Accueil Pro passent par le PC.',

      '• Cloud Supabase (Internet) — inventaire, prêts, conduites, mises techniques et Accueil Pro passent par le cloud, sans PC serveur.',

      'Seules les cartes du mode choisi s’affichent en dessous.',

      'En mode local : installez le serveur, jumelez avec le QR, puis Envoyer ↑ et Recevoir ↓.',

      'En mode Supabase : exportez le schéma SQL, renseignez URL + clé anon. Basculez Connexion → « Cloud Supabase » : le QR d’invitation apparaît en tête de l’onglet (carte verte 📲). Partagez-le par e-mail ou scan ; le scan bascule automatiquement en mode cloud sur le téléphone du collègue.',
      'Plusieurs téléphones en cloud : l’appareil qui modifie une quantité fait Envoyer ↑, les autres font Recevoir ↓. Tous doivent afficher « Synchronisation inventaire (Supabase) » (pas « avec le PC »).',
      'Le même Envoyer ↑ / Recevoir ↓ synchronise aussi le lieu (nom du théâtre, adresse, logo, coordonnées admin dans Profil) et les données Accueil Pro (lieux, événements…).',
      'Photos consommable : conservées à la sync, téléversées au cloud à l’Envoyer ↑ (qualité réduite), retéléchargées au Recevoir ↓ si une URL existe. Réassociez une photo si elle manque encore après sync.',

      'En mode local : tuile Connexion → « Serveur local sur PC » (QR jumelage ou adresse PC). Un seul mode actif à la fois ; tous les téléphones doivent utiliser le même.',

    ],

    examples: [

      'Sur le Wi‑Fi de la salle : mode local, jumeler une fois, puis synchroniser depuis Connexion.',

    ],

  },

  {

    icon: '🛰️',

    title: 'Accès distant avec Tailscale',

    paragraphs: [

      'Tailscale relie le PC et les téléphones comme sur un réseau privé, même en 4G/5G. Compte gratuit sur tailscale.com.',

      'Sur le PC : installer Tailscale, noter l’adresse 100.x.x.x, configurer PAIRING_PUBLIC_BASE dans le .env du serveur.',

      'Sur le téléphone : installer Tailscale, rester connecté (ON), jumeler avec le QR ou l’adresse Tailscale.',

    ],

  },

  {

    icon: '⚙️',

    title: 'Paramètres',

    paragraphs: [

      'Langue, notifications, comptes utilisateurs, profils dynamiques, options de synchro.',

      'Relancez le didacticiel d’installation depuis Paramètres si besoin.',

    ],

  },

  {

    icon: '🎭',

    title: 'Accueil Pro (location de salle)',

    paragraphs: [

      'Module pour l’accueil et la location de salles. Bannière Accueil Pro sur l’écran d’accueil.',

      'Lieux, événements, conventions, portail association. Les demandes de location ne passent pas par l’application : créez les événements directement. Sync séparée : Réseau → carte Accueil Pro.',
      'Conventions : onglet Conventions — chaque ligne est rattachée à un événement (nom et date affichés). « + Nouvelle » impose le choix de l’événement. Suppression : lien « Supprimer » à droite de la ligne ou en bas de l’écran de modification. Création rapide aussi depuis la fiche événement (section Conventions).',

      'Lieux : menu Accueil Pro → Lieux. Chaque lieu apparaît en bulle ; en le sélectionnant, les espaces (salles) s’affichent en bulles. Sélectionnez un espace pour le visualiser et le modifier, ou « + Nouvel espace » pour en créer un. Suppression : lien « Supprimer le lieu » ou « Supprimer l’espace » sur la fiche bulles, bouton en bas de l’écran de modification, ou icône poubelle dans la liste « Gérer les espaces ». Plan du lieu : en création ou modification, section « Plan du lieu » — import PDF ou DWG ; consulter depuis la fiche (onglet Réglementation) ou depuis l’édition. Le PDF s’affiche page par page dans l’app (conventions, plans) ; si besoin, « Ouvrir avec une app externe » en bas de l’écran. Le DWG s’ouvre via Partager (AutoCAD, etc.). Après l’enregistrement du lieu, section « Convention de location » : import PDF, texte et signature — visible aussi dans l’onglet Réglementation du lieu.',

      'Organisations : menu Accueil Pro → Organisations. Liste des associations et entreprises enregistrées ; touchez une fiche pour la modifier (coordonnées, contacts, documents). Lien « Créer un événement » sous chaque organisation, ou bouton dédié dans la fiche — l’organisation est pré-sélectionnée dans le formulaire événement.',

      'État des lieux : menu Accueil Pro → État des lieux → onglet « Par événement ». Sélectionnez un événement : pour chaque espace utilisé, boutons Entrée et Sortie (checklist + photos). Onglet Historique pour rouvrir un EDL passé. Rapport des anomalies : PDF (impression / partage) ou résumé par e-mail (points KO, commentaires, EDL manquants).',

      'Événement : lors de la création, section « Dates et horaires » (début/fin + heures), statut (Option, Confirmé, Annulé, Terminé), boutons « + Nouvelle organisation » et « + Nouveau lieu et espaces » sans quitter le formulaire.',

      'Événement ouvert : onglets Aperçu, Équipe et Agenda. Équipe — bouton « Gérer l’équipe » : choisir une fiche dans l’annuaire puis « Ajouter depuis l’annuaire », ou créer une nouvelle fiche (enregistrée dans l’annuaire et ajoutée à l’équipe). « SMS à toute l’équipe » (onglet Équipe ou écran Gérer l’équipe) : rédigez un message (ex. pause repas) ; l’app Messages s’ouvre avec tous les mobiles renseignés — vous validez l’envoi sur le téléphone. Un message confirme l’ajout ; la liste « Équipe assignée » est en bas de l’écran (faites défiler si besoin). L’événement doit avoir un lieu renseigné pour créer une fiche depuis cet écran. Depuis une fiche personnel (Contacts / Équipe) : section « Ajouter à un événement » — la fiche est enregistrée automatiquement si elle est nouvelle. Annuaire (Contacts) — équipe du lieu, contacts organisation et externes ; les membres permanents sont surlignés et en tête de liste. Agenda — créneaux horaires (qui, quoi, où) ; icône poubelle pour supprimer une plage.',

      'Planning du jour : Accueil Pro → Planning du jour (raccourci sur l’accueil). Chaque plage horaire affiche une icône poubelle à droite pour la supprimer (confirmation). Touchez la ligne pour la modifier ; bouton « + » en haut pour ajouter un créneau.',

      'Feuille de route : menu Accueil Pro → Feuille de route. Une feuille par événement (titre = nom + dates), liste triée chronologiquement. Touchez une ligne pour la synthèse (organisation, lieu, espaces, horaires, matériel par espace, équipe, agenda, conventions, EDL, notes régisseur) et l’export PDF. Lien « Ouvrir la feuille de route » aussi depuis la fiche événement (onglet Aperçu). Feuille information : depuis la fiche événement ou la feuille de route, renseignez le matériel nécessaire par salle (ex. « Salle A : 80 chaises, 2 micros HF ») — le texte apparaît sur la feuille de route et le PDF. Le planning du jour reste dans Planning du jour.',

      'Portail organisation : menu Accueil Pro → Portail association. Liste des organisations ayant au moins un événement créé ; sous chaque nom, les événements concernés. Touchez un événement pour y ajouter des fichiers PDF, audio ou vidéo (programme, rider, bandes-son…). Côté association (portail client), la fiche et les documents généraux de l’organisation restent en bas de l’écran.',

      'Ma journée (staff) : section sur l’accueil Accueil Pro avec le score de préparation de chaque événement du jour ; tap → fiche événement. Bannière « Aujourd’hui » → liste filtrée. Événements : filtres Aujourd’hui / Semaine / Tous ; statuts Option, Confirmé, Annulé, Terminé (les annulés sont exclus des comptages jour J). Chaque événement a une couleur fixe (bulles du calendrier Planning, bandeau latéral dans les listes) pour le repérer rapidement. Fiche événement → checklist « Prêt à accueillir » (convention, docs, EDL, équipe + cases briefing et accès). Lien « Comparer EDL entrée / sortie » par espace. Feuille de route PDF : inclut le score de préparation.',

      'Invitations portail (staff, mode Supabase) : fiche Organisation → Inviter au portail cloud.',

    ],

  },

  {

    icon: '💾',

    title: 'Sauvegarde et bonnes pratiques',

    paragraphs: [

      'Synchronisez régulièrement ou exportez avant de changer de téléphone.',

      'Privilégiez un Wi‑Fi stable pour les gros imports.',

    ],

  },

];


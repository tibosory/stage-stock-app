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

    '21 mai 2026 (v1.0.66 : ma journée, statuts, checklist, comparaison EDL)',

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

      'QR de jumelage serveur : dans l’assistant ou Réseau, appuyez sur « Scanner le QR d’appairage » et visez le QR affiché sur le PC (/pair). Le QR inclut l’URL et la clé API : un second scan est nécessaire si le serveur vient d’être réinstallé ou si un message « clé API manquante » s’affiche.',

      'Matériel : le code ouvre la fiche ou permet d’en créer une minimale si votre organisation l’autorise.',

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

      'Liste filtrable par statut et recherche texte. Appui long pour sélectionner plusieurs fiches et exporter un PDF.',

      'Impression d’étiquettes et fiches A4 depuis l’espace Impression.',

      'La fiche détail n’affiche que les champs renseignés.',

    ],

  },

  {

    icon: '🛒',

    title: 'Consommables',

    paragraphs: [

      'Liste avec filtre stock sous le seuil. Mouvements depuis la fiche, le Scanner ou un import tableur.',

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

      'Import et export CSV pour les mises à jour en masse. Synchro manuelle depuis Réseau.',

    ],

  },

  {

    icon: '🌐',

    title: 'Réseau, connexion et synchronisation',

    paragraphs: [

      'Ouvrez l’onglet Réseau. En haut, choisissez comment synchroniser :',

      '• Serveur local sur PC (Wi‑Fi ou Tailscale) — inventaire, prêts et Accueil Pro passent par le PC.',

      '• Cloud Supabase (Internet) — inventaire, prêts et Accueil Pro passent par le cloud, sans PC serveur.',

      'Seules les cartes du mode choisi s’affichent en dessous.',

      'En mode local : installez le serveur, jumelez avec le QR, puis Envoyer ↑ et Recevoir ↓.',

      'En mode Supabase : configurez le projet, connectez-vous, puis Envoyer ↑ et Recevoir ↓.',

      'Tous les téléphones de l’équipe doivent utiliser le même mode.',

    ],

    examples: [

      'Sur le Wi‑Fi de la salle : jumeler une fois, puis synchroniser depuis Réseau.',

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

      'Lieux : menu Accueil Pro → Lieux. Chaque lieu apparaît en bulle ; en le sélectionnant, les espaces (salles) s’affichent en bulles. Sélectionnez un espace pour le visualiser et le modifier, ou « + Nouvel espace » pour en créer un. Après l’enregistrement du lieu, section « Convention de location » : import PDF, texte et signature — visible aussi dans l’onglet Réglementation du lieu.',

      'Organisations : menu Accueil Pro → Organisations. Liste des associations et entreprises enregistrées ; touchez une fiche pour la modifier (coordonnées, contacts, documents). Lien « Créer un événement » sous chaque organisation, ou bouton dédié dans la fiche — l’organisation est pré-sélectionnée dans le formulaire événement.',

      'État des lieux : menu Accueil Pro → État des lieux → onglet « Par événement ». Sélectionnez un événement : pour chaque espace utilisé, boutons Entrée et Sortie (checklist + photos). Onglet Historique pour rouvrir un EDL passé. Rapport des anomalies : PDF (impression / partage) ou résumé par e-mail (points KO, commentaires, EDL manquants).',

      'Événement : lors de la création, section « Dates et horaires » (début/fin + heures), statut (Option, Confirmé, Annulé, Terminé), boutons « + Nouvelle organisation » et « + Nouveau lieu et espaces » sans quitter le formulaire.',

      'Événement ouvert : onglets Aperçu, Équipe et Agenda. Équipe — créer une fiche (prénom, nom, téléphone, e-mail, adresse) : elle rejoint l’annuaire général et l’équipe du jour ; ou ajouter quelqu’un déjà présent dans l’annuaire. Annuaire (Contacts) — équipe du lieu (créée via menu Équipe), contacts organisation et externes ; les membres permanents sont surlignés et en tête de liste (ordre alphabétique), puis les autres (alphabétique). Consulter ou modifier une fiche, « Ajouter à un événement » depuis la fiche. Agenda — créneaux horaires détaillés (qui, quoi, où) comme un planning de journée ; bouton pour importer les horaires de l’événement.',

      'Feuille de route : menu Accueil Pro → Feuille de route. Choisissez la date avec les flèches ou le champ date. En tête : planning global du jour ; puis une synthèse par événement (organisation, lieu, espaces, horaires, description, équipe jour J avec rôles et coordonnées, agenda, conventions, états des lieux). Section lieux & sécurité et notes régisseur en bas. Export PDF pour impression ou partage.',

      'Portail organisation : menu Accueil Pro → Portail association. Liste des organisations ayant au moins un événement créé ; sous chaque nom, les événements concernés. Touchez un événement pour y ajouter des fichiers PDF, audio ou vidéo (programme, rider, bandes-son…). Côté association (portail client), la fiche et les documents généraux de l’organisation restent en bas de l’écran.',

      'Ma journée (staff) : section sur l’accueil Accueil Pro avec le score de préparation de chaque événement du jour ; tap → fiche événement. Bannière « Aujourd’hui » → liste filtrée. Événements : filtres Aujourd’hui / Semaine / Tous ; statuts Option, Confirmé, Annulé, Terminé (les annulés sont exclus des comptages jour J). Fiche événement → checklist « Prêt à accueillir » (convention, docs, EDL, équipe + cases briefing et accès). Lien « Comparer EDL entrée / sortie » par espace. Feuille de route PDF : inclut le score de préparation.',

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


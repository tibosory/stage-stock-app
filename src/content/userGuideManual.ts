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
  subtitle: 'Guide complet avec exemples',
  /** Repère de fraîcheur du texte (à ajuster quand le manuel est réaligné sur l’app). */
  versionLabel:
    '20 mai 2026 (v1.0.43 : Accueil Pro synchronisable via Supabase — tables ap_* + Storage)',
};

export const USER_GUIDE_SECTIONS: UserGuideSection[] = [
  {
    icon: '📘',
    title: 'Notice intégrée et export PDF',
    paragraphs: [
      'Ce manuel est affiché dans l’app (écran Notice / rubrique équivalente selon votre menu) et exportable en PDF pour archivage ou formation hors réseau.',
      'L’interface de l’app utilise une typographie moderne et neutre (Roboto) pour la lecture écran ; les PDF conservent une police documentaire standard pour les échanges administratifs.',
      'L’icône application et l’animation de chargement ont été améliorées pour un rendu plus net et plus fluide à l’ouverture.',
      'Le PDF reprend exactement les mêmes sections : en cas de mise à jour de l’application, rouvrez la notice pour lire la version alignée sur votre build.',
    ],
  },
  {
    icon: '🎯',
    title: 'Objectif de l’application',
    paragraphs: [
      'CATRACK Pro sert à inventorier le matériel et les consommables, gérer les prêts, les alertes (stocks bas, retards, maintenance, VGP) et optionnellement le suivi de tournées.',
      'L’app est pensée pour fonctionner d’abord hors ligne : la base SQLite locale est la source de travail ; la synchronisation aligne les appareils vers **un seul backend** choisi : serveur CATRACK Pro (Wi‑Fi ou Tailscale) **ou** Supabase — jamais les deux en parallèle.',
      'Le démarrage a été optimisé : l’app ouvre plus vite, et les tâches non critiques (notifications, reprogrammations, initialisation cloud) sont décalées après l’affichage initial.',
      'Principe de simplicité : les actions fréquentes (scan, stock, consommables) sont accessibles depuis la barre du bas ; le menu principal à grosses tuiles regroupe les « métiers » ; l’onglet Menu liste le reste.',
    ],
    examples: [
      'Technicien en régie : ouvrir Scanner pour pointer un QR, ajuster une sortie consommable, puis consulter Alertes pour les retours de prêt du jour.',
    ],
  },
  {
    icon: '🚀',
    title: 'Premier lancement et comptes',
    paragraphs: [
      'Après installation (APK), un didacticiel guide la langue, le lieu, le jumelage avec le PC serveur et le profil. L’étape serveur est obligatoire : l’app ne fonctionne pas tant que le PC de la salle ne répond pas au test de connexion.',
      'Connexion sur l’appareil : choisissez un utilisateur et saisissez son code PIN (pas de compte cloud ni Supabase en déploiement V1 LAN). Si le PIN par défaut 1234 est encore actif, l’app demande immédiatement un nouveau code. L’écran d’accueil rappelle ces identifiants au premier lancement.',
      'Le choix de langue se fait dès le didacticiel (Français ou English) et s’applique immédiatement à toute l’interface prise en charge.',
      'Les parcours Connexion/Réseau et installation serveur PC suivent aussi la langue choisie (messages, boutons, alertes, guide).',
      'Le bouton « Connexion automatique (recommandé) » tente une configuration plug-and-play : détection LAN, bascule URL locale, puis vérification de liaison.',
      'Le bouton « Diagnostic guidé » vérifie ensuite l’accessibilité du serveur et la route de synchronisation API, puis affiche un message simple avec la correction à appliquer.',
      'Les rôles (administrateur, technicien, emprunteur) limitent certaines actions : création de fiches, validation de demandes de prêt, tests de notifications, etc.',
      'Vous pouvez relancer le didacticiel depuis Paramètres si besoin.',
    ],
    examples: [
      'Nouveau téléphone : terminer le didacticiel avec l’URL du serveur, tester la connexion dans Réseau, puis attendre la première synchro avant d’inventorier.',
    ],
  },
  {
    icon: '🏠',
    title: 'Menu principal (grosses tuiles) et navigation',
    paragraphs: [
      'En déploiement V1 LAN, le menu secondaire (onglet Menu) ne propose que Alertes, Notice, Connexion/Réseau, Utilisateur et Paramètres — pas d’assistant IA, VGP, import ni tournées depuis ce menu.',
      'Les boutons du menu principal sont en style arrondi à contour coloré pour mieux distinguer chaque espace d’activité.',
      'Sur Android, un espace bas renforcé est appliqué pour éviter tout chevauchement avec les boutons de navigation système.',
      'Le bouton « Tout » ouvre l’application avec la barre d’onglets complète (Scanner, Stock, etc.).',
      'Le rond « accueil » dans les espaces workspace ramène aux grosses tuiles.',
      'Le bouton « Tournée » est visible dans ce menu principal (hors rôle emprunteur) pour créer des tournées et affecter du matériel (liste, QR, NFC).',
      'Depuis l’édition d’une fiche matériel (Stock), un bouton ouvre directement l’éditeur de profils dynamiques pour créer ou ajuster les modèles de champs.',
    ],
  },
  {
    icon: '📷',
    title: 'Scanner (QR, codes-barres, NFC)',
    paragraphs: [
      'L’onglet Scanner utilise la caméra pour lire QR et codes-barres, ou le mode NFC si le téléphone le permet.',
      'QR de jumelage serveur : scannez le QR affiché sur le PC (page /pair) avec l’onglet Scanner — l’app enregistre l’URL et la clé API, puis confirme la connexion. Ne créez pas de fiche matériel pour ce code.',
      'Alternative : sur la page /pair du PC, touchez « Ouvrir dans Stage Stock » ou scannez avec l’appareil photo Android (lien profond).',
      'Pour le matériel : le code reconduit vers la fiche ou permet de créer une fiche minimale si votre organisation l’autorise.',
      'Pour les consommables : entrée/sortie de stock, mode rafale avec quantité fixe ou pavé à chaque scan selon le réglage.',
      'Le mode lot permet d’enchaîner plusieurs matériels pour une liste rapide.',
      'Un vibreur court confirme chaque lecture ; dans Paramètres → Confort (scanner), vous pouvez en plus activer un retour haptique lorsque le code correspond à une fiche matériel ou consommable (utile en intérieur ou avec gants).',
    ],
    examples: [
      'Sortie consommable : activer « Rafale », type Sortie, approcher les étiquettes ; la quantité s’applique à chaque scan ou un pavé demande le nombre selon l’option.',
    ],
  },
  {
    icon: '📦',
    title: 'Stock matériel',
    paragraphs: [
      'Liste filtrable par statut (en stock, en prêt, etc.), recherche texte, pagination progressive pour garder l’interface fluide.',
      'Quand un matériel est affecté à une tournée, son statut passe à « en tournée » (on tour). La liste stock peut afficher le nom de la tournée active.',
      'La zone de liste défilante reste prioritaire à l’écran (environ 40 % minimum de la hauteur visible) pour faciliter la lecture en exploitation.',
      'Appui long sur une ligne : mode sélection pour exporter un PDF multi-fiches (photo, infos, QR).',
      'Étiquettes : formats personnalisables, impression lot QR, étiquettes rayonnage.',
      'Dans l’aperçu de la fiche matériel, les champs vides ne sont plus affichés : seuls les champs réellement renseignés apparaissent.',
      'Fiche détail : photo, notices PDF/photo, NFC, QR par défaut égal à l’id si vide, champs dynamiques selon profil métier.',
    ],
    examples: [
      'Deux projecteurs même nom : différencier par numéro de série, QR ou catégorie ; le bandeau « fiches en stock sous ce libellé » aide au décompte.',
    ],
  },
  {
    icon: '🛒',
    title: 'Consommables',
    paragraphs: [
      'Liste avec filtre stock sous le seuil, recherche, édition selon droits.',
      'Mouvements d’inventaire : via fiche, via Scanner, ou import tableur selon votre procédure.',
    ],
  },
  {
    icon: '🧾',
    title: 'Prêts et demandes',
    paragraphs: [
      'Cycle habituel : en demande → en cours → retourné (ou annulé). Les emprunteurs peuvent signaler un retour.',
      'Feuille de prêt : signature sur appareil, export PDF.',
      'Les administrateurs voient les demandes en attente de validation selon configuration.',
    ],
  },
  {
    icon: '🎪',
    title: 'Tournée (mode suivi)',
    paragraphs: [
      'Accès : menu principal / Menu, Paramètres (raccourcis liste tournées, suivi, journal), puis liste des tournées.',
      'Création : nom + date de début (sélecteur calendrier). Chaque carte de tournée permet d’ouvrir le détail, de changer l’état organisationnel (planifiée, en cours, terminée) et de supprimer la tournée directement depuis la liste (avec confirmation). Un appui long ouvre aussi les actions rapides (détail / état / suppression).',
      'Détail en trois blocs : lieux (noms et adresses), ajout de matériel (listes déroulantes + quantité, ou scan QR / NFC avec confirmation), puis lignes suivies avec pastilles de statut (assigné, en service, rendu, abîmé, perdu) et actions (changer de lieu via le menu des lieux, en service, retour stock, signalements).',
      'Chaque tournée peut maintenant embarquer des documents utiles (plans AutoCAD, PDF techniques, fiches de montage, etc.) importés depuis le téléphone.',
      'Ces documents peuvent être prévisualisés dans l’application (image/PDF), renommés pour clarifier leur usage, puis supprimés si besoin.',
      'Si une tournée est supprimée, ses documents associés sont supprimés aussi (base + fichiers locaux), pour éviter les orphelins.',
      'Quand un matériel est "en tournée", son statut est verrouillé hors écran Tournée : les changements de statut doivent se faire depuis la tournée elle-même.',
      'Le statut "en tournée" affiche aussi le nom de la tournée active pour éviter les ambiguïtés entre plusieurs tournées.',
      'Quand des flightcases sont présents sur la tournée, la sélection se fait via des boutons visuels en forme de caisse avec le numéro (ex. 3/12), pour repérage rapide sur le terrain.',
      'Le matériel peut aussi être ajouté hors flightcase (option « sans flightcase ») pour les éléments transportés à part.',
      'Pour chaque ligne hors flightcase, vous pouvez joindre une photo de conditionnement/chargement (caméra ou galerie), la remplacer ou la retirer.',
      'Chaque bouton flightcase affiche le poids total du contenu (kg), calculé automatiquement depuis le poids des matériels affectés.',
      'Un appui long sur un bouton flightcase ouvre des actions rapides : imprimer la liste du matériel contenu, ou imprimer le QR code du flightcase.',
      'Le QR du flightcase renvoie au contenu du flightcase dans l’app (scan terrain pour consulter rapidement la liste), avec le poids de chaque ligne et le poids total.',
      'L’export PDF du contenu flightcase affiche aussi une colonne de poids par ligne et le poids total du flightcase en bas du document.',
      'Un mode scan rafale permet d’attribuer rapidement une série de matériels dans un flightcase : définissez le nombre d’articles à ajouter, scannez en continu (QR/NFC), puis utilisez « Undo » pour annuler la dernière attribution si besoin.',
      'Une fiche matériel « en stock » = 1 unité ; la quantité affectée ne peut pas dépasser ce qui reste disponible compte tenu des lignes encore actives. Le journal d’activité peut s’ouvrir depuis le détail, filtré sur cette tournée.',
    ],
    examples: [
      'Tournée « Festival été » : créer les lieux « Entrepôt », « Scène A », passer la tournée « en cours », puis affecter les flight cases au fur et à mesure des scans NFC.',
    ],
  },
  {
    icon: '📍',
    title: 'Suivi tournée (vue globale)',
    paragraphs: [
      'Écran dédié (raccourci depuis Paramètres / bloc Tour mode) : tableau des matériels actuellement liés à une tournée, avec filtre par statut d’affectation (tous, assigné, en service, rendu, perdu, abîmé).',
      'Les libellés de statut sont affichés en français ; tirez la liste vers le bas pour actualiser les données.',
    ],
  },
  {
    icon: '📋',
    title: 'Journal d’activité (tournées)',
    paragraphs: [
      'Liste chronologique des événements (affectation, déplacement, retour, contrôle, signalement) avec noms de matériel, tournée et lieu lorsque c’est enregistré.',
      'Filtres par tournée et par matériel ; tirer la liste vers le bas pour rafraîchir. L’ouverture depuis une tournée peut préremplir le filtre tournée.',
    ],
  },
  {
    icon: '🛎️',
    title: 'Alertes et VGP',
    paragraphs: [
      'Alertes regroupe stocks bas consommables, prêts en retard, maintenance et VGP.',
      'L’onglet VGP liste le matériel sous contrôle périodique avec échéances et saisie de visite.',
      'Dans la fiche VGP d’un EPI ou équipement contrôlé, vous pouvez joindre le dernier rapport de contrôle en PDF, l’ouvrir, le remplacer ou le retirer.',
      'Notifications locales : rappels prêts, VGP, seuils — paramétrables ; tests push/e-mail selon profil.',
    ],
  },
  {
    icon: '📜',
    title: 'Historique des mouvements',
    paragraphs: [
      'Historique du stock permet de consulter les mouvements passés (matériel et consommables) avec filtres utiles pour audit.',
    ],
  },
  {
    icon: '📤',
    title: 'Import / Export',
    paragraphs: [
      'Import et export CSV (matériel, consommables, prêts selon les écrans) pour migration ou mise à jour de masse.',
      'Export calendrier (.ics) des prêts pour Outlook ou Google Calendar.',
      'La synchro API (serveur CATRACK Pro) peut être déclenchée depuis l’écran dédié ; une option permet une synchro après chaque action (plus réactif, plus de trafic).',
    ],
    examples: [
      'Reprise d’un fichier Excel : normaliser les colonnes attendues, faire un export modèle depuis l’app si disponible, puis import sur un appareil pilote avant généralisation.',
    ],
  },
  {
    icon: '🌐',
    title: 'Réseau, connexion et synchronisation',
    paragraphs: [
      'Serveur local (Wi-Fi), HTTPS distant, ou tunnel : saisie d’URL, test ping et test synchro snapshot.',
      'Installations serveur officiellement supportées sans aide d’un informaticien : PC Windows 10/11 via l’installateur One-Click, ou Docker (Linux/macOS/Windows WSL2). Autres cas (NAS, ARM, Linux sans Docker) : nécessitent un accompagnement, demandez au support avant de promettre une mise en service rapide.',
      'En déploiement V1 LAN (APK client par défaut), la synchronisation ne cible que le PC serveur : boutons « Envoyer au PC » / « Recevoir du PC » dans Connexion/Réseau. Supabase et comptes cloud sont masqués. Un échec de sync affiche une alerte explicite.',
      'En déploiement avancé, la carte **Backend de données** (Connexion/Réseau) permet de choisir exclusivement le serveur local + Tailscale **ou** Supabase. Les données ne sont pas copiées automatiquement d’un backend à l’autre : tous les téléphones de l’équipe doivent utiliser le même choix.',
      'Mode serveur local : inventaire, prêts, comptes PIN et Accueil Pro (location de salle) transitent par le PC (Wi‑Fi ou Tailscale).',
      'Mode Supabase : inventaire, prêts et Accueil Pro transitent par le cloud. Exécutez la migration SQL `accueilpro_mobile_sync_tables` sur le projet Supabase (tables ap_* + bucket accueilpro-files pour PDF et photos). Les conventions PDF et documents d’organisation s’y téléversent automatiquement.',
      'Découverte automatique possible sur le LAN lorsque le backend local est sélectionné.',
      'Si le backend Supabase est sélectionné et configuré, une tâche quotidienne en arrière-plan tente une synchronisation automatique (push/pull) pour maintenir l’activité du projet, y compris quand l’application n’est pas au premier plan.',
      'Dans l’assistant d’installation serveur (Android), l’app récupère l’installateur Windows `.exe` depuis la release configurée : le nom du fichier peut varier selon la version.',
      'Aide QR de jumelage : ouvrez `/pair` sur le PC, scannez le QR avec l’onglet Scanner (recommandé en V1 LAN) ou touchez « Ouvrir dans Stage Stock » ; l’URL doit être `http://IP:8091` sans suffixe `/pair`.',
      'Si la sync affiche « nginx » ou HTTP 405, l’URL ne pointe pas vers le serveur Stage Stock : vérifiez que le service tourne sur le PC et relancez le jumelage.',
      'Sur installation Windows récente, le port serveur par défaut est 8091 (recommandé) pour simplifier la connexion mobile ; l’ancien 8095 reste encore souvent utilisé après migration.',
      'Sur les installations locales, la page de jumelage détecte le bon port API (sonde `/health` de type Stage Stock) et, si `PAIRING_PUBLIC_BASE` mentionne l’IP LAN avec un port obsolète du `.env`, le serveur force le port réellement écouté pour le QR et le texte affiché.',
      'Sur le PC Windows, les raccourcis bureau « Tableau serveur » et « Jumelage téléphone (QR) » ouvrent le navigateur via un petit script : il teste `/health` (réponse JSON `status: ok`) sur le port du `.env` puis une plage habituelle, pour éviter de viser un autre service qui répondrait simplement en HTTP 200.',
      'Au retour au premier plan, l’app synchronise vers le backend actif (PC si mode local, Supabase si mode cloud). Les modifications locales non encore envoyées ne sont pas écrasées lors d’une réception snapshot.',
      'Le serveur Windows ajoute un raccourci bureau de désinstallation (.lnk vers un script CMD, pas une page navigateur). Windows demande normalement une élévation administrateur : acceptez-la pour retirer la tâche planifiée et les règles pare-feu. La fenêtre se met en pause à la fin pour laisser le temps de lire le résumé (ou en cas d’erreur).',
    ],
    examples: [
      'Sur le Wi‑Fi de la salle : jumelage QR puis sync « Envoyer au PC » / « Recevoir du PC ».',
      'En 5G (hors salle) : activer Tailscale sur le téléphone, puis la même sync — l’URL du serveur reste celle configurée au jumelage (souvent une adresse 100.x.x.x).',
    ],
  },
  {
    icon: '🛰️',
    title: 'Accès distant avec Tailscale (Wi‑Fi ou 5G)',
    paragraphs: [
      'Tailscale est un petit logiciel gratuit qui relie le PC serveur et les téléphones comme s’ils étaient sur le même réseau privé, même en 5G ou depuis une autre box Wi‑Fi. Aucun réglage sur la box Internet n’est nécessaire.',
      'Principe simple : le PC et chaque téléphone se connectent au même compte Tailscale. Le serveur CATRACK Pro reste sur le PC ; le téléphone utilise une adresse du type http://100.x.x.x:8091 (fournie par l’administrateur ou le QR de jumelage).',
      '—— Étape A — Une seule fois sur le PC serveur (administrateur) ——',
      '1) Créer un compte gratuit sur tailscale.com (e-mail de l’organisation ou du responsable technique).',
      '2) Installer « Tailscale » sur le PC Windows où tourne CATRACK Pro (tailscale.com/download/windows).',
      '3) Se connecter avec le compte Tailscale. Noter l’adresse affichée (ex. 100.64.12.34) — c’est l’adresse « distante » du serveur.',
      '4) Dans le fichier .env du serveur (dossier d’installation StageStock), mettre : PAIRING_PUBLIC_BASE=http://100.x.x.x:8091 (remplacer par l’adresse Tailscale réelle). Redémarrer le serveur ou le PC si besoin.',
      '5) Vérifier dans un navigateur sur le PC : http://127.0.0.1:8091/health doit afficher status ok. La page http://100.x.x.x:8091/pair doit afficher le QR de jumelage.',
      '—— Étape B — Sur chaque téléphone (utilisateur) ——',
      '1) Installer l’app « Tailscale » depuis le Play Store (Android) ou l’App Store (iPhone).',
      '2) Se connecter avec le même compte Tailscale que le PC (l’administrateur peut inviter les collègues par e-mail depuis la console tailscale.com).',
      '3) Activer Tailscale : l’interrupteur doit être ON (connecté) avant d’ouvrir CATRACK Pro.',
      '4) Jumelage : scanner le QR sur la page /pair du PC (ou saisir l’URL http://100.x.x.x:8091 dans Connexion/Réseau). Une fois jumelé, l’app retient l’adresse.',
      '5) Tester : couper le Wi‑Fi du téléphone, laisser la 5G, garder Tailscale ON, ouvrir CATRACK Pro → Connexion/Réseau → « Vérifier la connexion » puis sync.',
      '—— Rappels pour les utilisateurs ——',
      'Tailscale doit rester actif (ON) pour accéder au serveur hors du Wi‑Fi de la salle.',
      'Si « connexion impossible » en 5G : vérifier Tailscale ON, que le PC serveur est allumé, puis relancer la vérification dans l’app.',
      'Ne partagez pas le QR /pair publiquement sur Internet : il contient la clé d’accès au serveur (réseau de confiance).',
      'L’administrateur peut créer un compte Tailscale dédié à l’équipe (ex. salle@…) et inviter uniquement les téléphones autorisés.',
    ],
    examples: [
      'Technicien en tournée (5G) : Tailscale ON → ouvrir CATRACK Pro → Recevoir du PC pour mettre à jour l’inventaire.',
      'Administrateur : après changement d’IP Tailscale du PC, mettre à jour PAIRING_PUBLIC_BASE et refaire le jumelage sur les téléphones concernés.',
    ],
  },
  {
    icon: '🧭',
    title: 'Schéma synoptique réseau (PC, routeur, téléphone)',
    paragraphs: [
      'Utilisez ce schéma comme référence de câblage logique pour que CATRACK Pro fonctionne en local :\n\n[Internet optionnel]\n        │\n        ▼\n  [Routeur / Box Wi-Fi]\n      │             │\n      │ LAN/Wi-Fi   │ Wi-Fi\n      ▼             ▼\n[PC Windows]   [Téléphone Android/iOS]\nServeur local  Application CATRACK Pro\nCATRACK Pro   (même réseau local)\nPORT actif     URL: http://IP_PC:PORT\n(8091 / 8095 / 3847\nou 8090-8110)\n\nFlux principal (mode serveur local choisi) :\n1) Le téléphone synchronise inventaire et prêts vers le PC (snapshot / bulk).\n2) Accueil Pro, conventions PDF et fichiers associés passent aussi par ce PC.\n3) Les photos et manuels PDF peuvent utiliser Supabase Storage si le projet cloud est configuré sur l’appareil (option indépendante).',
      'Avec Tailscale (accès distant) :\n\n[Téléphone — Wi‑Fi ou 5G]\n        │\n        ▼\n   [Internet]\n        │\n        ▼\n [Tailscale — tunnel chiffré]\n        │\n        ▼\n[PC Windows + Tailscale]\nServeur CATRACK Pro\nURL : http://100.x.x.x:8091\n\nLe téléphone et le PC doivent être connectés au même compte Tailscale. Le PC doit rester allumé.',
      'Pré-requis réseau minimum : PC et téléphone sur le même réseau local, pare-feu Windows autorisant le port backend, URL API exacte dans l’app (ou jumelage QR).',
      'Si la connexion échoue : vérifier IP du PC, port actif réel, page `/pair` accessible depuis le téléphone, puis relancer le test « Vérifier la connexion ».',
    ],
    examples: [
      'Exemple concret : PC = 192.168.1.77, backend actif = 8091 → URL à saisir dans l’app : http://192.168.1.77:8091',
    ],
  },
  {
    icon: '⚙️',
    title: 'Paramètres',
    paragraphs: [
      'Catégories, localisations, comptes utilisateurs, préférences de notifications, diagnostics synchro (admin), mises à jour, options cloud.',
      'Une section « Langue » permet de changer la langue native à tout moment ; l’interface se met à jour sans réinstallation.',
      'Les statuts techniques de tournée (planifiée, en cours, terminée, assigné, en service, rendu, perdu, abîmé) sont aussi traduits pour éviter les ambiguïtés opérationnelles.',
      'Les écrans Liste tournée / Suivi tournée et leurs messages d’action utilisent désormais ces traductions, y compris en cas d’erreur ou de confirmation.',
      'L’écran Stock et les badges d’état/statut (matériel, prêt, condition) s’alignent aussi sur la langue choisie.',
      'Les écrans Scanner et Connexion/Réseau utilisent aussi la langue sélectionnée pour les titres, actions et messages principaux.',
      'Les écrans Scanner, Connexion/Réseau et Détail tournée couvrent aussi les libellés techniques de saisie, messages de contrôle, et actions d’accessibilité.',
      'Les confirmations d’action du détail tournée (déplacement, retour stock, signalements, scan QR/NFC, photos) suivent également la langue active.',
      'Le didacticiel d’installation (langue, lieu, serveur, profil) utilise aussi la langue active pour les libellés, boutons et validations principales.',
      'Les écrans Consommables, Prêts et Alertes sont également alignés sur la langue active pour les intitulés principaux.',
      'Les formulaires détaillés de Prêts et Consommables (libellés, aides, boutons d’action, messages de contrôle, états techniques) suivent aussi la langue choisie.',
      "Dans Alertes, la préparation d’e-mail d’achat (destinataire, sélection des lignes, actions d’ouverture e-mail) suit aussi la langue choisie.",
      'Profils dynamiques : l’éditeur de profils propose des presets métiers importables en un clic (Costumière, Accessoiriste, Lumière, Audio, Vidéo, Structure / Scène) pour démarrer rapidement avec des champs prêts à l’emploi.',
      'En édition de fiche stock, si aucun profil dynamique n’est sélectionné, la validation reste classique (sans obligation sur des champs dynamiques spécifiques).',
      'Section « Confort (scanner) » : haptique optionnel quand un scan correspond à une fiche (voir aussi la section Scanner).',
      'Lorsque le mode tournée est actif : raccourcis vers la liste des tournées, l’écran de suivi global et le journal d’activité.',
      'Dans la section Projet Supabase (profil utilisateur), un bouton permet de télécharger/partager un fichier `.sql` prêt à coller dans Supabase (menu gauche → SQL Editor). Sur le dépôt, le script court `StageStock/supabase/patch_mobile_sync_tables_timestamps.sql` reprend uniquement les `ALTER`/`UPDATE` pour un projet déjà créé sans `updated_at`. Seul un compte connecté sur votre projet peut exécuter ce SQL (l’assistant ne peut pas le faire à votre place).',
      'Section « Langue » : changement immédiat de la langue d’interface sans redémarrer l’app.',
    ],
  },
  {
    icon: '🧩',
    title: 'Profils dynamiques — comment bien remplir les champs',
    paragraphs: [
      'Un profil dynamique sert à standardiser la saisie sur toutes les fiches d’un même métier. Gardez des IDs internes stables (techniques) et des labels lisibles (utilisateur).',
      'Type Texte : notez des valeurs courtes et utiles (ex. référence, remarques terrain). Type Nombre : saisissez uniquement la valeur (sans unité dans la cellule si l’unité est déjà dans le label).',
      'Type Select : limitez les options à une liste courte et cohérente ; évitez les doublons (ex. « Bon » et « bon »). Type Booléen : utilisez-le pour oui/non simple. Type Date : format calendrier pour contrôles, entretiens, échéances.',
      'Bon réflexe équipe : remplir d’abord les champs obligatoires, puis les champs sécurité/maintenance, puis les notes libres.',
    ],
    examples: [
      'Lumière : « Puissance (W) » = 300 ; « Mode DMX » = 16ch ; « Indice IP » = IP65.',
      'Costumière : « Taille » = M ; « État costume » = Bon ; « Date dernier entretien » = 2026-04-10 ; « Notes habillage » = reprise ourlet manche gauche.',
      'Accessoiriste : « Fragile » = Oui ; « Niveau sécurité » = Élevé ; « Lieu stockage » = Rack B / caisse 4.',
    ],
  },
  {
    icon: '👤',
    title: 'Profil utilisateur',
    paragraphs: [
      'Onglet Utilisateur : informations de session, déconnexion cloud locale, etc.',
    ],
  },
  {
    icon: '🧠',
    title: 'Assistant (IA)',
    paragraphs: [
      'En mode application locale (non SaaS), le bouton « Envoyer » reste actif dès qu’un texte est saisi ; en mode SaaS, il suit le feature flag « saas.ai ».',
      'La zone de recherche du menu principal envoie vers l’assistant quand le réseau est OK, sinon vers la recherche rapide locale.',
      'Modèle IA conseillé côté PC : llama3.2:1b (≈ 1.3 Go, réponse en 1 à 3 secondes même sur machine modeste). À télécharger une fois avec : ollama pull llama3.2:1b. Pour plus de précision (et plus de latence), basculer sur llama3.2:3b ou mistral en éditant OLLAMA_MODEL dans le .env serveur.',
      'En cas de modèle IA lent sur le PC, le serveur tente automatiquement un modèle local plus rapide parmi ceux déjà téléchargés (Ollama) ; sinon message d’erreur clair après un délai (environ deux minutes max côté app). Sur PC très lent, augmentez OLLAMA_TIMEOUT_MS dans le .env du serveur et consultez GET /diagnostic sur le PC.',
    ],
  },
  {
    icon: '🖨️',
    title: 'Impression',
    paragraphs: [
      'Formats d’étiquettes, aperçu HTML, PDF d’étiquettes QR en lot, étiquettes rayonnage, fiches matériel A4.',
      'En mode tournée avec flightcases : export PDF du contenu d’un flightcase (liste lisible) et export PDF des planches d’étiquettes QR des flightcases.',
    ],
  },
  {
    icon: '🔍',
    title: 'Recherche rapide',
    paragraphs: [
      'Écran Recherche locale : résultats instantanés sur la base ; une couche IA peut enrichir en arrière-plan sans bloquer.',
    ],
  },
  {
    icon: '🎭',
    title: 'Accueil Pro (location de salle)',
    paragraphs: [
      '**Deuxième métier** de CATRACK Pro : accueil d’événements et location de salles. Accès : **bannière Accueil Pro** (navy / or, pleine largeur) au menu d’activités — au-dessus des tuiles inventaire — puis espace dédié (onglets **Accueil Pro** + **Réseau**). Interface **navy / or / crème** pensée **terrain** : bandeau **connexion serveur** (en ligne / **jumelage requis** / hors ligne), bannière **Aujourd’hui**, statistiques tactiles, **actions rapides** en défilement horizontal, menu en **grille** (Planning, Feuille de route PDF, Contacts, Organisations, Demandes, Portail association…). Tirer vers le bas ou **Sync** en haut à droite pour actualiser.',
      'Synchronisation **séparée** de l’inventaire : onglet **Réseau** → carte **Accueil Pro** (**↑ Envoyer** / **↓ Recevoir**) ou **Sync** du tableau de bord. Selon le **backend de données** choisi : **serveur local** (jumelage QR **/pair** + clé API — sans clé, HTTP 401) **ou Supabase** (tables ap_* + bucket Storage, sans PC). **Recevoir** fusionne les changements distants **sans effacer** vos saisies locales ; conflits signalés (écran **Conflits de sync**).',
      '**Lieux** : fiche avec onglets **Espaces**, **Équipe**, **Réglementation ERP** (type, catégorie, sécurité incendie, conduite à tenir), **Événements** du lieu.',
      '**État des lieux** : **Entrée** / **Sortie** par **espace** — depuis la fiche événement. Checklist par espace (points de contrôle / vigilance). Photos envoyées sur le **PC** (mode local) ou **Supabase Storage** (mode cloud) à l’enregistrement.',
      '**Contacts** : annuaire filtrable avec boutons **Appeler**, **SMS** et **Mail** (cibles larges, utilisables debout).',
      '**Organisations**, **demandes**, **événements**, **conventions** : création / édition sur mobile ; sync via Réseau → Accueil Pro (PC ou Supabase selon backend).',
      '**Portail association** : fiche, checklist, **documents PDF** (assurance, programme…), **Nouvelle demande**. PDF stockés sur le PC (local) ou Supabase Storage (cloud). Compte **emprunteur** (PIN) : menu réduit ; **admin / technicien** : accès complet.',
      '**Demandes de location** : à la soumission, l’équipe reçoit une **notification push** (si configurée). Validation ou refus → notification locale + proposition **e-mail** vers l’organisation. La validation est **bloquée** si un **conflit de réservation** (même lieu, salle et créneau) est détecté.',
      '**Événements / demandes** : alerte avant enregistrement si chevauchement avec un autre événement confirmé ou une demande en cours (possibilité d’enregistrer quand même).',
      '**Planning du jour** : organisation détaillée de la journée au format **quoi · qui · où · quand** (activité, personne, espace, horaire). Accès depuis le menu Accueil Pro, le **calendrier** (touchez un jour) ou la feuille de route. Bouton **Importer depuis les événements** pour pré-remplir ; notes du régisseur enregistrées sur l’appareil (sync avec le PC).',
      '**Feuille de route** : récap journalier avec navigation jour précédent/suivant, planning détaillé si renseigné, équipe jour J par événement, EDL et conventions du jour ; export PDF enrichi (planning quoi/qui/où/quand, événements, sécurité ERP, notes régisseur).',
      '**Conventions signées** : import PDF, consultation obligatoire, pad signature ; PDF synchronisé (PC ou Supabase selon backend).',
      '**Journal Accueil Pro** (menu staff) : trace locale des actions avec auteur PIN.',
    ],
    examples: [
      'Association en 5G : Tailscale actif, compléter la fiche dans Portail association, **Synchroniser** Accueil Pro, puis l’équipe du lieu valide la demande de location depuis Demandes.',
    ],
  },
  {
    icon: '💾',
    title: 'Sauvegarde et bonnes pratiques',
    paragraphs: [
      'Les données vivent sur l’appareil : planifiez synchro régulière ou export avant changement de téléphone.',
      'Pour de meilleures performances : évitez les synchros inutiles (option « après chaque action »), fermez les listes très longues en filtrant, et privilégiez le Wi-Fi stable pour les gros imports.',
    ],
    examples: [
      'Après une journée de saisie en 4G instable : ouvrir l’app sur le Wi-Fi du bureau, lancer une synchro manuelle depuis Réseau / Import-Export avant de quitter les lieux.',
    ],
  },
];

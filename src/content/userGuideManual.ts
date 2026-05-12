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
    '12 mai 2026 (AccueilPro : invitations portail + rôle organisateur en RLS ; bucket documents ; sync inchangée)',
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
      'L’app est pensée pour fonctionner d’abord hors ligne : la base SQLite locale est la source de travail ; la synchronisation (serveur CATRACK Pro et/ou Supabase selon configuration) aligne les appareils.',
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
      'Après connexion (PIN utilisateur appareil ou compte cloud selon votre déploiement), le didacticiel se lance automatiquement à chaque nouvelle installation de l’app (APK), pour proposer la langue, le lieu, le serveur et le profil ; chaque étape est skippable.',
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
      'Le menu principal regroupe Stock, Consommables, Prêt, Contrôle (VGP), Paramètres, Alertes, Import/Export, Impression selon votre rôle.',
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
      'Découverte automatique possible sur le LAN. Si Supabase est configuré sur l’appareil, la synchronisation cloud (push/pull inventaire) s’exécute dès que l’Internet est disponible ; lorsque le serveur CATRACK Pro (PC) est joignable sur le réseau, une seconde synchro API aligne aussi le PC (pas d’interrupteur supplémentaire). Sans Supabase, seule la sync API CATRACK Pro s’applique ; les photos/notices vers Storage restent optionnelles selon votre câblage.',
      'Si Supabase est configuré, une tâche quotidienne en arrière-plan tente une synchronisation automatique (push/pull) pour maintenir l’activité du projet, y compris quand l’application n’est pas au premier plan.',
      'Dans l’assistant d’installation serveur (Android), l’app récupère l’installateur Windows `.exe` depuis la release configurée : le nom du fichier peut varier selon la version.',
      'Aide QR de jumelage : ouvrez `/pair` (ou `/pair.html`) sur le serveur, scannez le QR puis validez l’ouverture dans l’app ; l’URL réseau est enregistrée automatiquement.',
      'Sur installation Windows récente, le port serveur par défaut est 8091 (recommandé) pour simplifier la connexion mobile ; l’ancien 8095 reste encore souvent utilisé après migration.',
      'Sur les installations locales, la page de jumelage détecte le bon port API (sonde `/health` de type Stage Stock) et, si `PAIRING_PUBLIC_BASE` mentionne l’IP LAN avec un port obsolète du `.env`, le serveur force le port réellement écouté pour le QR et le texte affiché.',
      'Sur le PC Windows, les raccourcis bureau « Tableau serveur » et « Jumelage téléphone (QR) » ouvrent le navigateur via un petit script : il teste `/health` (réponse JSON `status: ok`) sur le port du `.env` puis une plage habituelle, pour éviter de viser un autre service qui répondrait simplement en HTTP 200.',
      'Au retour au premier plan, l’app tente d’abord Supabase (si projet renseigné + en ligne), puis l’API inventaire sur le PC si l’URL répond (silencieux si échec).',
      'Le serveur Windows ajoute un raccourci bureau de désinstallation (.lnk vers un script CMD, pas une page navigateur). Windows demande normalement une élévation administrateur : acceptez-la pour retirer la tâche planifiée et les règles pare-feu. La fenêtre se met en pause à la fin pour laisser le temps de lire le résumé (ou en cas d’erreur).',
    ],
  },
  {
    icon: '🧭',
    title: 'Schéma synoptique réseau (PC, routeur, téléphone)',
    paragraphs: [
      'Utilisez ce schéma comme référence de câblage logique pour que CATRACK Pro fonctionne en local :\n\n[Internet optionnel]\n        │\n        ▼\n  [Routeur / Box Wi-Fi]\n      │             │\n      │ LAN/Wi-Fi   │ Wi-Fi\n      ▼             ▼\n[PC Windows]   [Téléphone Android/iOS]\nServeur local  Application CATRACK Pro\nCATRACK Pro   (même réseau local)\nPORT actif     URL: http://IP_PC:PORT\n(8091 / 8095 / 3847\nou 8090-8110)\n\nFlux principal :\n1) Dès que Supabase est configuré et joignable, l’app synchronise en priorité vers le cloud (selon les options du projet).\n2) Lorsque le PC est sur le LAN et que l’URL API répond, le téléphone exécute aussi une passe vers le serveur CATRACK Pro (snapshot inventaire, prêts, etc.).\n3) Les photos et manuels PDF peuvent utiliser Supabase Storage selon la configuration.',
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
    icon: '🏛️',
    title: 'AccueilPro — portail client (en préparation)',
    paragraphs: [
      'Un second module « AccueilPro » (salles, événements, conventions) est prévu dans la suite. Les associations et entreprises qui travaillent avec votre lieu disposeront d’un compte à accès limité : elles pourront créer et modifier les informations de leur structure, les contacts référents (rôles, coordonnées) et importer leurs documents (assurance, programme, rider, etc.).',
      'Le planning, le détail des événements, les conventions, les états des lieux, les informations techniques des salles et l’équipe du lieu restent en consultation seule pour ces comptes : toute demande de changement passe par l’équipe du lieu.',
      'Les droits effectifs sont appliqués côté serveur (politiques d’accès sur la base Supabase). Le personnel du lieu utilise notamment les rôles admin, régisseur, technicien, accueil. Le portail association / entreprise utilise le rôle client ; le rôle organisateur donne le même périmètre lecture / édition restreinte (événements et conventions liés à l’organisation, pas l’équipe du lieu).',
      'Invitation portail : l’équipe crée une invitation sur le serveur (e-mail + organisation). Sur l’écran de connexion, section Supabase : vérifiez le code, connectez-vous avec le même e-mail que sur l’invitation, puis « Finaliser » pour lier le compte. Les documents importés peuvent aller dans le bucket Storage privé `client-documents` (dossier = identifiant organisation), selon configuration du projet.',
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

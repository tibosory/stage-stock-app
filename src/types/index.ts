// src/types/index.ts

export type AppUserRole = 'admin' | 'technicien' | 'emprunteur';

export type EtatMateriel = 'bon' | 'moyen' | 'usé' | 'hors service';
export type StatutMateriel = 'en stock' | 'en prêt' | 'en réparation' | 'perdu' | 'en tournée';
export type StatutPret = 'en demande' | 'en cours' | 'retourné' | 'en retard' | 'annulé';
export type TourStatus = 'planned' | 'active' | 'completed';
export type AssignmentStatus = 'assigned' | 'in_use' | 'returned' | 'lost' | 'damaged';
export type ActivityLogType = 'ASSIGNED' | 'MOVED' | 'RETURNED' | 'DAMAGED' | 'CHECKED';

export interface Materiel {
  id: string;
  nom: string;
  type?: string;
  /** 1 = lot (un QR, stock ajustable) ; 0 = pièce unitaire */
  gestion_lot?: number | boolean;
  /** Stock courant pour les lots ; 1 pour les pièces unitaires */
  stock_actuel?: number;
  unite?: string;
  seuil_minimum?: number;
  marque?: string;
  numero_serie?: string;
  poids_kg?: number;
  /** Prix de référence (€) — PDF prêts, étiquettes */
  prix_unitaire?: number;
  categorie_id?: string;
  /** Chemin catégorie (affichage / recherche), optionnel */
  categorie_nom?: string;
  localisation_id?: string;
  /** Flightcase / caisse (plusieurs pièces peuvent partager le même libellé). */
  flightcase?: string | null;
  etat: EtatMateriel;
  statut: StatutMateriel;
  date_achat?: string;
  date_validite?: string;
  /** Dernier horodatage d'opération de maintenance (yyyy-MM-dd). */
  prochain_controle?: string;
  /** Fréquence de maintenance (jours) ; vide/null => aucune alerte périodique. */
  intervalle_controle_jours?: number;
  /** Opération / contrôle à effectuer (consignes de maintenance). */
  maintenance_todo?: string;
  /** Commentaire saisi lors de la dernière opération horodatée. */
  maintenance_last_comment?: string;
  technicien?: string;
  qr_code?: string;
  nfc_tag_id?: string;
  photo_url?: string;
  photo_local?: string;
  /** Chemin local (documentDirectory) vers une notice PDF */
  notice_pdf_local?: string | null;
  /** Chemin local vers une photo de la notice (scan / photo) */
  notice_photo_local?: string | null;
  /** URL publique Supabase Storage (notice PDF) pour les autres appareils */
  notice_pdf_url?: string | null;
  /** URL publique Supabase Storage (photo de notice) */
  notice_photo_url?: string | null;
  /** Suivi VGP / contrôles réglementaires (1 en base SQLite) */
  vgp_actif?: number | boolean;
  /** Périodicité en jours entre deux visites contrôles obligatoires */
  vgp_periodicite_jours?: number | null;
  /** Date (ISO yyyy-MM-dd) de la dernière visite / contrôle effectué */
  vgp_derniere_visite?: string | null;
  /** Libellé du type de contrôle (ex. consuel, extincteurs, échafaudage) */
  vgp_libelle?: string | null;
  /** 1 si suivi dans la zone EPI (équipements de protection individuelle — contrôle dédié) */
  vgp_epi?: number | boolean;
  /** Filtre éclairage : référentiel Lee Filters */
  gel_brand?: 'lee' | 'rosco' | null;
  /** Numéro de gel (ex. 201 Lee, 09 Rosco) */
  gel_code?: string | null;
  /** 1 = afficher la pastille couleur gel à la place de la photo principale */
  gel_instead_of_photo?: number | boolean;
  /**
   * Données techniques métier extensibles (JSON sérialisé ou objet),
   * non destructives pour la structure principale du matériel.
   */
  technical_data?: Record<string, string | number | boolean | null> | string | null;
  /** Profil métier appliqué au matériel (éditeur dynamique de schéma). */
  profile_id?: string | null;
  /** Version du schéma appliqué au moment de l'édition. */
  profile_version?: number | null;
  /** État de tracking opérationnel (mode tournée). */
  tracking_state?: 'available' | 'in_tour' | 'returned' | 'lost' | 'damaged' | null;
  current_tour_id?: string | null;
  current_location_id?: string | null;
  created_at: string;
  updated_at: string;
  synced: boolean;
}

export type DynamicFieldType = 'number' | 'text' | 'select' | 'boolean' | 'date';

export interface FieldDefinition {
  id: string;
  label: string;
  type: DynamicFieldType;
  required: boolean;
  unit?: string | null;
  defaultValue?: string | number | boolean | null;
  options?: string[];
  min?: number | null;
  max?: number | null;
  isDeleted: boolean;
}

export interface Profile {
  id: string;
  name: string;
  version: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileSchema {
  profileId: string;
  version: number;
  fields: FieldDefinition[];
  createdAt: string;
  updatedAt: string;
}

export interface Tour {
  id: string;
  name: string;
  status: TourStatus;
  startDate: string;
  endDate?: string | null;
  createdAt: string;
  updatedAt: string;
  synced: boolean;
}

export interface TourLocation {
  id: string;
  name: string;
  address?: string | null;
  dateStart?: string | null;
  dateEnd?: string | null;
  tourId: string;
  createdAt: string;
  updatedAt: string;
  synced: boolean;
}

export interface Assignment {
  id: string;
  materialId: string;
  tourId: string;
  locationId?: string | null;
  flightcaseId?: string | null;
  packagingPhotoLocal?: string | null;
  quantity: number;
  status: AssignmentStatus;
  assignedAt: string;
  returnedAt?: string | null;
  assignedTo?: string | null;
  createdAt: string;
  updatedAt: string;
  synced: boolean;
}

export interface TourFlightcase {
  id: string;
  tourId: string;
  caseNumber: number;
  totalCases: number;
  label: string;
  qrCode: string;
  createdAt: string;
  updatedAt: string;
  synced: boolean;
}

export interface ActivityLog {
  id: string;
  type: ActivityLogType;
  materialId: string;
  tourId?: string | null;
  locationId?: string | null;
  userId?: string | null;
  timestamp: string;
  note?: string | null;
  createdAt: string;
  synced: boolean;
  /** Renseigné par les listes avec jointures (affichage). */
  materialName?: string | null;
  tourName?: string | null;
  locationName?: string | null;
}

export interface TourDocument {
  id: string;
  tourId: string;
  title: string;
  fileName: string;
  mimeType?: string | null;
  fileSize?: number | null;
  localUri: string;
  createdAt: string;
  updatedAt: string;
  synced: boolean;
}

export interface Consommable {
  id: string;
  nom: string;
  reference?: string;
  unite: string;
  stock_actuel: number;
  seuil_minimum: number;
  categorie_id?: string;
  localisation_id?: string;
  fournisseur?: string;
  prix_unitaire?: number;
  qr_code?: string;
  nfc_tag_id?: string;
  photo_url?: string | null;
  photo_local?: string | null;
  /** Filtre éclairage : Lee Filters ou Rosco Supergel */
  gel_brand?: 'lee' | 'rosco' | null;
  gel_code?: string | null;
  /** 1 = afficher la pastille couleur gel à la place de la photo dans les listes */
  gel_instead_of_photo?: number | boolean;
  /** Chemin catégorie (jointure / recherche), affichage seulement */
  categorie_nom?: string;
  localisation_nom?: string;
  created_at: string;
  updated_at: string;
  synced: boolean;
}

export interface Pret {
  id: string;
  numero_feuille?: string;
  statut: StatutPret;
  emprunteur: string;
  organisation?: string;
  telephone?: string;
  email?: string;
  date_depart: string;
  retour_prevu?: string;
  retour_reel?: string;
  valeur_estimee?: number;
  commentaire?: string;
  signature_emprunteur_data?: string;
  signed_at?: string;
  emprunteur_user_id?: string;
  /**
   * Rappel local (9 h) X jours avant la date de retour prévue.
   * Vide / null = 1 jour (équivalent J-1).
   */
  rappel_jours_avant?: number | null;
  created_at: string;
  updated_at: string;
  synced: boolean;
}

export interface PretMateriel {
  id: string;
  pret_id: string;
  materiel_id: string;
  quantite: number;
  retourne: boolean;
  etat_au_retour?: string;
  /** Rempli par jointure (getPretMateriel) pour PDF / affichage */
  materiel_nom?: string;
  materiel_prix_unitaire?: number | null;
  materiel_poids_kg?: number | null;
}

/** Bénéficiaire / emprunteur enregistré pour réutiliser nom + coordonnées sur les feuilles de prêt. */
export interface Beneficiaire {
  id: string;
  nom: string;
  organisation?: string | null;
  telephone?: string | null;
  email?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppUser {
  id: string;
  nom: string;
  email?: string;
  role: AppUserRole;
  pin_hash: string;
  actif: boolean;
  created_at: string;
  /** Jeton Expo Push enregistré sur l’appareil (admin / technicien) pour recevoir les alertes emprunteur */
  expo_push_token?: string | null;
}

export interface MaterielEmpruntHistorique {
  id: string;
  materiel_id: string;
  pret_id: string;
  emprunteur: string;
  organisation?: string;
  date_depart: string;
  retour_prevu?: string;
  retour_reel?: string;
  etat_au_retour?: string;
  statut_pret: string;
  created_at: string;
  numero_feuille?: string;
}

export interface Categorie {
  id: string;
  nom: string;
  /** Catégorie parente (sous-catégories, ex. Scotch → Scotch PVC → …) */
  parent_id?: string | null;
  created_at: string;
}

export interface Localisation {
  id: string;
  nom: string;
  created_at: string;
}

export interface AlerteEmail {
  id: string;
  nom?: string;
  email: string;
  role?: string;
  created_at: string;
}

export interface MouvementStock {
  id: string;
  consommable_id: string;
  type: 'entrée' | 'sortie' | 'ajustement';
  quantite: number;
  note?: string;
  created_at: string;
}

/** Mouvement avec libellé consommable (liste historique). */
export interface MouvementStockDetail extends MouvementStock {
  consommable_nom: string;
  consommable_unite: string;
}

// ============================================================
// Module Régie — Conduite technique
// ============================================================

/** Département auquel appartient une conduite (« générale » = tous départements mélangés). */
export type DepartementConduite = 'lumiere' | 'son' | 'plateau' | 'video' | 'generale';
/** Type d’un top (couleur/icône) ; « autre » par défaut. */
export type TypeTop = 'lumiere' | 'son' | 'plateau' | 'video' | 'autre';

/** Localisation scénique optionnelle de l’action (côté cour, jardin…). null = aucune. */
export type LocalisationTop =
  | 'cour'
  | 'jardin'
  | 'centre'
  | 'cour_face'
  | 'cour_fond'
  | 'jardin_face'
  | 'jardin_fond'
  | 'centre_face'
  | 'centre_fond'
  | 'lointain'
  | 'avant_scene';

/** Une conduite = liste ordonnée de tops pour un spectacle et un département. */
export interface Conduite {
  id: string;
  /** Spectacle en texte libre (StageStock n’a pas de table spectacles). */
  nomSpectacle: string;
  /** Lien optionnel vers une tournée existante (réutilise le concept « spectacle »). */
  tourId: string | null;
  titre: string;
  departement: DepartementConduite;
  notes: string | null;
  /** Nombre de tops (jointure d’affichage, non stocké). */
  topsCount?: number;
  createdAt: string;
  updatedAt: string;
  synced: boolean;
}

/** Un top = un signal de régie minuté dans une conduite. */
export interface Top {
  id: string;
  conduiteId: string;
  numero: number;
  /** Minutage libre « mm:ss » (ex. « 12:45 »). */
  minutage: string | null;
  /** Même valeur en secondes pour tri/calculs. */
  minutageSecondes: number | null;
  departement: TypeTop;
  description: string;
  detail: string | null;
  /** Zone scénique où se déroule l’action (cour, jardin…). null = aucune. */
  localisation: LocalisationTop | null;
  /** Action à exécuter (ex. « descendre lampe »). */
  action: string | null;
  /** Repère / déclencheur (ex. « quand comédien dit : attention !! »). */
  repere: string | null;
  /** Coché en mode live. */
  effectue: boolean;
  createdAt: string;
  updatedAt: string;
  synced: boolean;
}

/** Couleurs associées à chaque type de top (UI + PDF). */
export const COULEURS_TOP: Record<TypeTop, { bg: string; text: string; border: string }> = {
  lumiere: { bg: '#FEF3C7', text: '#92400E', border: '#FBBF24' },
  son: { bg: '#DBEAFE', text: '#1E40AF', border: '#60A5FA' },
  plateau: { bg: '#D1FAE5', text: '#065F46', border: '#34D399' },
  video: { bg: '#EDE9FE', text: '#5B21B6', border: '#A78BFA' },
  autre: { bg: '#F3F4F6', text: '#374151', border: '#9CA3AF' },
};

export const LABELS_DEPARTEMENT: Record<DepartementConduite, string> = {
  lumiere: 'Lumière',
  son: 'Son',
  plateau: 'Plateau',
  video: 'Vidéo',
  generale: 'Générale (tous départements)',
};

export const LABELS_TYPE_TOP: Record<TypeTop, string> = {
  lumiere: 'Lumière',
  son: 'Son',
  plateau: 'Plateau',
  video: 'Vidéo',
  autre: 'Autre',
};

export const LABELS_LOCALISATION_TOP: Record<LocalisationTop, string> = {
  cour: 'Cour',
  jardin: 'Jardin',
  centre: 'Centre',
  cour_face: 'Cour face',
  cour_fond: 'Cour fond',
  jardin_face: 'Jardin face',
  jardin_fond: 'Jardin fond',
  centre_face: 'Centre face',
  centre_fond: 'Centre fond',
  lointain: 'Lointain',
  avant_scene: 'Avant-scène',
};

/** Options du sélecteur de localisation dans le formulaire top. */
export const LOCALISATIONS_TOP_OPTIONS: { label: string; value: LocalisationTop | '' }[] = [
  { label: '— Aucune —', value: '' },
  ...(
    Object.entries(LABELS_LOCALISATION_TOP) as [LocalisationTop, string][]
  ).map(([value, label]) => ({ label, value })),
];

// ============================================================
// Module Régie — Mise technique (plan de scène)
// ============================================================

/** Zone de scène (aide au placement, reste libre via la description). */
export type ZoneScene =
  | 'cour'
  | 'jardin'
  | 'centre'
  | 'cour_face'
  | 'cour_fond'
  | 'jardin_face'
  | 'jardin_fond'
  | 'centre_face'
  | 'centre_fond'
  | 'lointain'
  | 'avant_scene'
  | 'non_definie';

/** Une mise technique = dossier d’implantation d’un spectacle (étapes + positions). */
export interface MiseTechnique {
  id: string;
  nomSpectacle: string;
  tourId: string | null;
  titre: string;
  notes: string | null;
  /** Nombre d’étapes (jointure d’affichage, non stocké). */
  etapesCount?: number;
  createdAt: string;
  updatedAt: string;
  synced: boolean;
}

/** Une étape = un moment du spectacle (début, acte 1, rappel…), nom libre. */
export interface Etape {
  id: string;
  miseTechniqueId: string;
  ordre: number;
  nom: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  synced: boolean;
}

/** Une position = un objet placé à une étape donnée. */
export interface Position {
  id: string;
  etapeId: string;
  /** Lien optionnel vers un matériel du stock. */
  materielId: string | null;
  nomObjet: string;
  descriptionEmplacement: string;
  zone: ZoneScene;
  notes: string | null;
  ordre: number;
  createdAt: string;
  updatedAt: string;
  synced: boolean;
  /** Photos locales (jointure optionnelle). */
  photos?: PositionPhoto[];
}

/** Photo locale illustrant le placement d’une position. */
export interface PositionPhoto {
  id: string;
  positionId: string;
  /** URI de fichier local persistant (offline-first). */
  localUri: string;
  /** URL API serveur après sync (`/api/regie/position-photo-files/…`). */
  photoUrl?: string | null;
  ordre: number;
  createdAt: string;
}

export const LABELS_ZONE: Record<ZoneScene, string> = {
  cour: 'Cour',
  jardin: 'Jardin',
  centre: 'Centre',
  cour_face: 'Cour face',
  cour_fond: 'Cour fond',
  jardin_face: 'Jardin face',
  jardin_fond: 'Jardin fond',
  centre_face: 'Centre face',
  centre_fond: 'Centre fond',
  lointain: 'Lointain',
  avant_scene: 'Avant-scène',
  non_definie: 'Non définie',
};

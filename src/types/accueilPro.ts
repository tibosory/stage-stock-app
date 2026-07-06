/** Modèle métier Accueil Pro (alignement API / SQLite snake_case). */

/** Contrôles EDL dans l’UI (boutons OK / KO / NA). */
export type InspectionTriState = 'ok' | 'ko' | 'na';
export type InspectionVerifications = Record<string, InspectionTriState>;

/** Variante affichée / synchro quelques écrans. */
export type VerificationStatus = 'conforme' | 'non-conforme' | 'n/a' | InspectionTriState;

export type ApEventStatus = 'brouillon' | 'confirmé' | 'annulé' | 'terminé';

/** Case cochée manuellement dans la checklist « Prêt à accueillir ». */
export type ApEventReadinessManualItem = {
  checked: boolean;
  at?: string | null;
  by?: string | null;
};

export type ApEventReadinessManual = {
  briefing_done?: ApEventReadinessManualItem;
  access_ok?: ApEventReadinessManualItem;
};

/** Matériel et consignes par lieu / espace pour la feuille de route. */
export type ApEventFeuilleInfo = {
  venueEquipment?: string;
  spaces: Record<string, string>;
};

export const AP_EVENT_ACTIVE_STATUSES: ApEventStatus[] = ['brouillon', 'confirmé', 'terminé'];
export type ApConventionStatus = 'brouillon' | 'signé';
/** @alias */
export type ApInspectionFlowStatus = 'en cours' | 'terminé';
export type ApInspectionKind = 'entrée' | 'sortie';

/** Alias pour les imports des écrans. */
export type ApInspectionStatus = ApInspectionFlowStatus;
export type ApInspectionType = ApInspectionKind;

export type ApOrganizationStatus = 'actif' | 'suspendu' | 'archivé';

export type ApSpacesMode = 'all' | 'specific';

export type ApRentalStatus = 'soumise' | 'validée' | 'refusée' | 'annulée' | 'brouillon' | 'en_attente';

export type ApPersonnelKind = 'lieu' | 'organisation' | 'externe';

export interface ApVenue {
  id: string;
  name: string;
  address?: string | null;
  cp?: string | null;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
  erp_type?: string | null;
  erp_category?: string | null;
  capacity?: number | null;
  fire_notes?: string | null;
  safety_rules?: string | null;
  plan_local_uri?: string | null;
  plan_filename?: string | null;
  plan_storage_path?: string | null;
  /** Référence lieu CAPI synchronisée (salle / extérieur). */
  capi_lieu_ref_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  synced?: boolean;
}

export interface ApSpace {
  id: string;
  venue_id: string | null;
  name: string;
  type?: string | null;
  capacity?: number | null;
  description?: string | null;
  /** Points de contrôle / vigilance propres à cet espace (checklist EDL). */
  control_points?: ApInspectionControlPoint[] | null;
  /** Référence espace CAPI synchronisée. */
  capi_espace_ref_id?: string | null;
  updated_at?: string | null;
  synced?: boolean;
}

export type ApInspectionPointKind = 'control' | 'vigilance';

export interface ApInspectionControlPoint {
  id: string;
  label: string;
  description?: string | null;
  kind: ApInspectionPointKind;
}

export interface ApOrganization {
  id: string;
  name: string;
  type?: string | null;
  siret?: string | null;
  address?: string | null;
  cp?: string | null;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  supabase_user_id?: string | null;
  status: ApOrganizationStatus;
  notes_internes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  synced?: boolean;
}

export interface ApOrganizationContact {
  id: string;
  organization_id: string;
  name: string;
  role?: string | null;
  phone?: string | null;
  email?: string | null;
  is_primary: boolean;
  capi_contact_ref_id?: string | null;
  capi_contact_kind?: string | null;
  updated_at?: string | null;
  synced?: boolean;
}

export interface ApOrganizationDocument {
  id: string;
  organization_id: string;
  event_id?: string | null;
  title: string;
  category?: string | null;
  storage_path?: string | null;
  public_url?: string | null;
  file_size?: number | null;
  mime_type?: string | null;
  uploaded_by?: string | null;
  created_at?: string | null;
  /** Fichier local (app) avant envoi ou lecture hors ligne. */
  local_uri?: string | null;
  synced?: boolean;
}

export interface ApRentalRequest {
  id: string;
  organization_id: string;
  venue_id?: string | null;
  /** @deprecated utiliser sélection structurée (spaces_mode + selected_space_ids) */
  space_id?: string | null;
  event_name?: string | null;
  date_debut: string;
  date_fin?: string | null;
  heure_debut?: string | null;
  heure_fin?: string | null;
  participants?: number | null;
  motif?: string | null;
  staff_notes?: string | null;
  spaces_mode?: ApSpacesMode | null;
  /** Identifiants d’espaces (mode `specific`). */
  selected_space_ids?: string[] | null;
  status: ApRentalStatus;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  synced?: boolean;
}

export interface ApEvent {
  id: string;
  venue_id?: string | null;
  organization_id?: string | null;
  name: string;
  type?: string | null;
  organisateur?: string | null;
  date_debut: string;
  date_fin?: string | null;
  heure_debut?: string | null;
  heure_fin?: string | null;
  participants?: number | null;
  description?: string | null;
  status: ApEventStatus;
  spaces_mode?: ApSpacesMode | null;
  selected_space_ids?: string[] | null;
  /** Espace principal (sélection simple, hors mode multi). */
  space_id?: string | null;
  /** Checklist manuelle « prêt à accueillir » (JSON local). */
  readiness_manual?: ApEventReadinessManual | null;
  /** Notes régisseur sur la feuille de route de l’événement. */
  feuille_note?: string | null;
  /** Matériel / consignes par espace pour la feuille de route (JSON local). */
  feuille_info?: ApEventFeuilleInfo | null;
  /** Spectacle CAPI (catégories associations / location). */
  capi_spectacle_ref_id?: string | null;
  /** Lieu CAPI lié (prioritaire sur venue_id local si renseigné). */
  capi_lieu_ref_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  synced?: boolean;
}

export interface ApConvention {
  id: string;
  event_id?: string | null;
  /** Modèle ou convention rattachée au lieu (sans événement). */
  venue_id?: string | null;
  titre: string;
  contenu?: string | null;
  status: ApConventionStatus;
  /** PNG base64 (sans préfixe data:). */
  signature_data?: string | null;
  signed_at?: string | null;
  signed_by?: string | null;
  /** PDF convention sur l’appareil (file://). */
  document_local_uri?: string | null;
  /** Chemin relatif côté serveur (`conventions/...`). */
  document_storage_path?: string | null;
  /** Nom affiché du PDF (ex. convention-location.pdf). */
  document_filename?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  synced?: boolean;
}

export type ApActivityLogAction =
  | 'rental.submitted'
  | 'rental.validated'
  | 'rental.refused'
  | 'event.saved'
  | 'convention.signed'
  | 'document.added';

export interface ApActivityLogEntry {
  id: string;
  action: ApActivityLogAction | string;
  entity: string;
  entity_id?: string | null;
  summary: string;
  actor_name?: string | null;
  created_at?: string | null;
}

export interface ApRoomInspection {
  id: string;
  event_id?: string | null;
  space_id?: string | null;
  type: ApInspectionKind;
  status: ApInspectionFlowStatus;
  inspection_date?: string | null;
  representant_lieu?: string | null;
  representant_orga?: string | null;
  /** JSON objet (clés checklist → état). */
  verifications: Record<string, string>;
  commentaire?: string | null;
  photos: string[];
  updated_at?: string | null;
  synced?: boolean;
}

/** Équipe / annuaire du lieu (PostgreSQL `team_members`). */
export interface ApPersonnel {
  id: string;
  venue_id: string;
  name: string;
  first_name?: string | null;
  last_name?: string | null;
  address?: string | null;
  role?: string | null;
  mission?: string | null;
  phone?: string | null;
  email?: string | null;
  kind: ApPersonnelKind;
  role_permanent?: boolean | number | null;
  organization_id?: string | null;
  /** Notes locales (SQLite). */
  notes?: string | null;
  /** URI locale (documentDirectory) — photo de profil. */
  photo_uri?: string | null;
  photo_storage_path?: string | null;
  capi_contact_ref_id?: string | null;
  capi_contact_kind?: string | null;
  updated_at?: string | null;
  synced?: boolean;
}

/** Rattache ponctuel d’une personne à un événement. */
export interface ApEventPersonnel {
  id: string;
  event_id: string;
  source: 'directory' | 'adhoc' | 'jour';
  name: string;
  day_role?: string | null;
  /** Libellé affiché « mission du jour » (alias possible de day_role selon les écrans). */
  day_mission?: string | null;
  phone?: string | null;
  email?: string | null;
  /** Référence optionnelle vers `ap_team_members` si issue de l’annuaire lieu. */
  source_personnel_id?: string | null;
  updated_at?: string | null;
  synced?: boolean;
}

/** Ligne du planning détaillé d’une journée (quoi / qui / où / quand). */
export interface ApDayPlanItem {
  id: string;
  plan_date: string;
  event_id?: string | null;
  time_start?: string | null;
  time_end?: string | null;
  /** Activité (quoi). */
  title: string;
  /** Personne assignée (qui). */
  assignee_name?: string | null;
  /** Espace (où). */
  space_id?: string | null;
  venue_id?: string | null;
  notes?: string | null;
  sort_order?: number | null;
  updated_at?: string | null;
  synced?: boolean;
}

/** Notes libres du régisseur pour une journée. */
export interface ApDayNote {
  plan_date: string;
  note: string;
  updated_at?: string | null;
  synced?: boolean;
}

/** Catalogues CAPI synchronisés pour Accueil Pro. */
export interface ApCapiLieuRef {
  id: string;
  kind: 'salle' | 'exterieur';
  nom: string;
  adresse?: string | null;
  ville?: string | null;
  capiRef: string;
}

export interface ApCapiSpectacleRef {
  id: string;
  titre: string;
  compagnie: string;
  categorieCode: string;
  categorieLibelle: string;
  salleId: string;
  salleNom: string;
  capiLieuRefId: string;
  dateDebut: string;
  dateFin: string;
  capiRef: string;
}

export interface ApCapiContactRef {
  id: string;
  kind: 'personnel' | 'prestataire' | 'contact_utile';
  nom: string;
  role?: string | null;
  organisation?: string | null;
  telephone?: string | null;
  email?: string | null;
  capiRef: string;
}

export interface ApCapiEspaceRef {
  id: string;
  salleId: string;
  capiLieuRefId: string;
  nom: string;
  type?: string | null;
  jauge?: number | null;
  description?: string | null;
  controlPoints?: ApInspectionControlPoint[] | null;
  ordre: number;
  capiRef: string;
}

export interface ApCapiPlanningRef {
  id: string;
  capiSpectacleRefId: string;
  dateKey: string;
  timeStart?: string | null;
  timeEnd?: string | null;
  title: string;
  assigneeName?: string | null;
  capiEspaceRefId?: string | null;
  notes?: string | null;
  sortOrder?: number;
  capiRef: string;
}

export interface ApCapiDocumentRef {
  id: string;
  capiSpectacleRefId: string;
  nom: string;
  cheminDossier?: string | null;
  mimeType?: string | null;
  tailleOctets?: number | null;
  pole?: string | null;
  versionId: string;
  familleId: string;
  capiRef: string;
}

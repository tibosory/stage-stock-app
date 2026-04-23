// src/types/index.ts

export type AppUserRole = 'admin' | 'technicien' | 'emprunteur';

export type EtatMateriel = 'bon' | 'moyen' | 'usé' | 'hors service';
export type StatutMateriel = 'en stock' | 'en prêt' | 'en réparation' | 'perdu';
export type StatutPret = 'en demande' | 'en cours' | 'retourné' | 'en retard' | 'annulé';

export interface Materiel {
  id: string;
  nom: string;
  type?: string;
  marque?: string;
  numero_serie?: string;
  poids_kg?: number;
  /** Prix de référence (€) — PDF prêts, étiquettes */
  prix_unitaire?: number;
  categorie_id?: string;
  /** Chemin catégorie (affichage / recherche), optionnel */
  categorie_nom?: string;
  localisation_id?: string;
  etat: EtatMateriel;
  statut: StatutMateriel;
  date_achat?: string;
  date_validite?: string;
  prochain_controle?: string;
  intervalle_controle_jours?: number;
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
  created_at: string;
  updated_at: string;
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

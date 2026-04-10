// src/types/index.ts

export type AppUserRole = 'admin' | 'technicien' | 'emprunteur';

export type EtatMateriel = 'bon' | 'moyen' | 'usé' | 'hors service';
export type StatutMateriel = 'en stock' | 'en prêt' | 'en réparation' | 'perdu';
export type StatutPret = 'en cours' | 'retourné' | 'en retard' | 'annulé';

export interface Materiel {
  id: string;
  nom: string;
  type?: string;
  marque?: string;
  numero_serie?: string;
  poids_kg?: number;
  categorie_id?: string;
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
}

export interface AppUser {
  id: string;
  nom: string;
  email?: string;
  role: AppUserRole;
  pin_hash: string;
  actif: boolean;
  created_at: string;
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

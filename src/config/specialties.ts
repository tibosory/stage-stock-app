/**
 * Spécialité métier (préférence locale, en plus du compte / rôle).
 * Sert à adapter textes d’aide et mises en avant — sans dupliquer les données.
 */

export type SpecialtyId =
  | 'neutre'
  | 'technicien'
  | 'costumiere'
  | 'accessoiriste'
  | 'accrocheur_rigger'
  | 'logistique_douane';

export type SpecialtyDef = {
  id: SpecialtyId;
  label: string;
  /** Sous-titre dans Paramètres */
  shortDescription: string;
  /** Rappel sous le menu d’activités */
  homeHint: string;
  /** Rappel discret en tête de fiche matériel */
  materielHint: string;
};

export const DEFAULT_SPECIALTY_ID: SpecialtyId = 'neutre';

export const SPECIALTIES: SpecialtyDef[] = [
  {
    id: 'neutre',
    label: 'Neutre',
    shortDescription: 'Aucune mise en avant métier (toutes les fonctions visibles).',
    homeHint: '',
    materielHint: '',
  },
  {
    id: 'technicien',
    label: 'Technicien spectacle',
    shortDescription: 'Son, lumière, vidéo, régie — maintenance, S/N, VGP.',
    homeHint: 'Pensez : Stock, VGP, consommables, alertes maintenance.',
    materielHint:
      'Utile : n° de série, localisation plot / flight case, maintenance horodatée, notices PDF.',
  },
  {
    id: 'costumiere',
    label: 'Costumière / costumes',
    shortDescription: 'Suivi costume, taille, pressing, loge / caisse.',
    homeHint: 'Pensez : photos fiche, localisation (loge, rail), prêts, alertes dates.',
    materielHint:
      'Utile : photo, localisation (loge / caisse / housse), statut prêt, commentaires entretien.',
  },
  {
    id: 'accessoiriste',
    label: 'Accessoiriste',
    shortDescription: 'Armes factices, bagues, accessoires plateau, malles.',
    homeHint: 'Pensez : prêts, alertes, scan QR/NFC pour retrouver vite une pièce.',
    materielHint:
      'Utile : statut (stock / prêt), localisation précise, photo repère, maintenance / commentaires.',
  },
  {
    id: 'accrocheur_rigger',
    label: 'Accrocheur / rigger',
    shortDescription: 'Structures, points d’accroche, sécurité chantier, levage.',
    homeHint: 'Pensez : Stock matériel structure, VGP / contrôles, alertes.',
    materielHint:
      'Utile : poids, n° série, dates validité / contrôle, notices, localisation sur site ou camion.',
  },
  {
    id: 'logistique_douane',
    label: 'Logistique & douane (ATA, tournée)',
    shortDescription: 'Lots, carnets, listes pour frontières — à enrichir sur chaque fiche.',
    homeHint: 'Pensez : poids & S/N sur fiches, export PDF, Import / export.',
    materielHint:
      'Utile : poids (kg), n° série, marque/type, PDF fiche pour dossiers — regroupez par localisation / tournée.',
  },
];

export function isSpecialtyId(raw: string | null | undefined): raw is SpecialtyId {
  return !!raw && SPECIALTIES.some(s => s.id === raw);
}

export function getSpecialtyDef(id: SpecialtyId): SpecialtyDef {
  return SPECIALTIES.find(s => s.id === id) ?? SPECIALTIES[0];
}

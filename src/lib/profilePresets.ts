import type { FieldDefinition } from '../types';

type ProfilePreset = {
  profileName: string;
  description: string;
  fields: FieldDefinition[];
};

function baseField(
  id: string,
  label: string,
  type: FieldDefinition['type'],
  opts?: Partial<FieldDefinition>
): FieldDefinition {
  return {
    id,
    label,
    type,
    required: false,
    unit: null,
    defaultValue: null,
    options: [],
    min: null,
    max: null,
    isDeleted: false,
    ...opts,
  };
}

export const PROFILE_PRESETS: ProfilePreset[] = [
  {
    profileName: 'Costumière',
    description: 'Pack prêt prod (10 champs) pour costumes/habillage.',
    fields: [
      baseField('costume_type', 'Type costume', 'select', {
        required: true,
        options: ['Robe', 'Veste', 'Pantalon', 'Chemise', 'Manteau', 'Uniforme', 'Chaussures', 'Autre'],
      }),
      baseField('costume_personnage_role', 'Personnage / rôle', 'text'),
      baseField('costume_interprete_attribue', 'Interprète attribué', 'text'),
      baseField('costume_taille', 'Taille', 'select', {
        options: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Sur mesure', 'Autre'],
      }),
      baseField('costume_matiere_principale', 'Matière principale', 'select', {
        options: ['Coton', 'Laine', 'Lin', 'Polyester', 'Cuir', 'Synthétique', 'Mixte', 'Autre'],
      }),
      baseField('costume_etat', 'État costume', 'select', {
        options: ['Neuf', 'Très bon', 'Bon', 'Usé', 'À réparer'],
      }),
      baseField('costume_nettoyage_type', 'Nettoyage', 'select', {
        options: ['Lavage machine', 'Lavage main', 'Pressing', 'Nettoyage à sec', 'Interdit'],
      }),
      baseField('costume_date_dernier_entretien', 'Date dernier entretien', 'date'),
      baseField('costume_lieu_rangement', 'Lieu rangement', 'text'),
      baseField('costume_notes_habillage', 'Notes habillage', 'text'),
    ],
  },
  {
    profileName: 'Accessoiriste',
    description: 'Pack prêt prod (10 champs) pour accessoires/props.',
    fields: [
      baseField('accessoire_type', 'Type accessoire', 'select', {
        required: true,
        options: ['Arme factice', 'Bijou', 'Livre', 'Vaisselle', 'Mobilier', 'Décor mobile', 'Outil', 'Autre'],
      }),
      baseField('accessoire_personnage_scene', 'Personnage / scène', 'text'),
      baseField('accessoire_interprete_attribue', 'Interprète attribué', 'text'),
      baseField('accessoire_matiere', 'Matière', 'text'),
      baseField('accessoire_poids_kg', 'Poids (kg)', 'number', { min: 0 }),
      baseField('accessoire_fragile', 'Fragile', 'boolean', { defaultValue: false }),
      baseField('accessoire_niveau_securite', 'Niveau sécurité', 'select', {
        options: ['Faible', 'Moyen', 'Élevé', 'Critique'],
      }),
      baseField('accessoire_etat', 'État accessoire', 'select', {
        options: ['Neuf', 'Très bon', 'Bon', 'Usé', 'À réparer', 'HS'],
      }),
      baseField('accessoire_lieu_stockage', 'Lieu stockage', 'text'),
      baseField('accessoire_notes_plateau', 'Notes plateau', 'text'),
    ],
  },
  {
    profileName: 'Lumière',
    description: 'Pack prêt prod (10 champs) pour parc lumière.',
    fields: [
      baseField('optique_type_source', 'Type source', 'select', {
        required: true,
        options: ['LED', 'Halogène', 'Décharge', 'Laser', 'Autre'],
      }),
      baseField('optique_temperature_k', 'Température couleur (K)', 'number', { min: 0 }),
      baseField('optique_flux_lm', 'Flux lumineux (lm)', 'number', { min: 0 }),
      baseField('optique_angle_faisceau_deg', 'Angle faisceau (°)', 'number', { min: 0 }),
      baseField('lumiere_mode_dmx', 'Mode DMX', 'select', {
        options: ['1ch', '3ch', '5ch', '7ch', '16ch', 'Autre'],
      }),
      baseField('lumiere_adresse_dmx_defaut', 'Adresse DMX par défaut', 'number', { min: 1 }),
      baseField('lumiere_univers_dmx_defaut', 'Univers DMX par défaut', 'number', { min: 1 }),
      baseField('securite_indice_ip', 'Indice IP', 'select', {
        options: ['IP20', 'IP44', 'IP54', 'IP65', 'IP67', 'Autre'],
      }),
      baseField('elec_puissance_w', 'Puissance (W)', 'number', { min: 0 }),
      baseField('doc_remarques_techniques', 'Remarques techniques', 'text'),
    ],
  },
  {
    profileName: 'Audio',
    description: 'Pack prêt prod (10 champs) pour parc audio.',
    fields: [
      baseField('audio_categorie', 'Catégorie audio', 'select', {
        required: true,
        options: ['Enceinte', 'Ampli', 'Console', 'Micro', 'DI', 'Périphérique', 'Autre'],
      }),
      baseField('audio_type_micro', 'Type micro', 'select', {
        options: ['Dynamique', 'Condensateur', 'Ruban', 'HF', 'Lavalier', 'Casque', 'N/A'],
      }),
      baseField('audio_directivite', 'Directivité', 'select', {
        options: ['Omni', 'Cardioïde', 'Supercardioïde', 'Hypercardioïde', 'Figure-8', 'N/A'],
      }),
      baseField('audio_reponse_frequence_hz', 'Réponse fréquence', 'text'),
      baseField('audio_spl_max_db', 'SPL max (dB)', 'number', { min: 0 }),
      baseField('audio_impedance_ohm', 'Impédance (ohms)', 'number', { min: 0 }),
      baseField('audio_io_connectique', 'Entrées / sorties', 'text'),
      baseField('audio_phantom_48v_requise', 'Alimentation fantôme requise', 'boolean', { defaultValue: false }),
      baseField('elec_puissance_w', 'Puissance (W)', 'number', { min: 0 }),
      baseField('doc_remarques_techniques', 'Remarques techniques', 'text'),
    ],
  },
  {
    profileName: 'Vidéo',
    description: 'Pack prêt prod (10 champs) pour parc vidéo/projection.',
    fields: [
      baseField('video_categorie', 'Catégorie vidéo', 'select', {
        required: true,
        options: ['Projecteur', 'Écran', 'Matrice', 'Convertisseur', 'Caméra', 'Moniteur', 'Autre'],
      }),
      baseField('video_resolution_native', 'Résolution native', 'select', {
        options: ['HD', 'Full HD', 'WUXGA', '2K', '4K UHD', 'DCI 4K', 'Autre'],
      }),
      baseField('video_luminosite_ansi_lm', 'Luminosité (ANSI lm)', 'number', { min: 0 }),
      baseField('video_contraste_ratio', 'Contraste', 'text'),
      baseField('video_ratio_image', 'Ratio d’image', 'select', {
        options: ['4:3', '16:9', '16:10', '21:9', 'Autre'],
      }),
      baseField('video_entrees', 'Entrées vidéo', 'text'),
      baseField('video_sorties', 'Sorties vidéo', 'text'),
      baseField('video_throw_ratio', 'Distance de projection', 'text'),
      baseField('elec_puissance_w', 'Puissance (W)', 'number', { min: 0 }),
      baseField('doc_remarques_techniques', 'Remarques techniques', 'text'),
    ],
  },
  {
    profileName: 'Structure / Scène',
    description: 'Pack prêt prod (10 champs) pour levage/structure/scène.',
    fields: [
      baseField('structure_categorie', 'Catégorie structure', 'select', {
        required: true,
        options: ['Poutre', 'Pied', 'Pont', 'Moteur', 'Élingue', 'Manille', 'Accessoire', 'Autre'],
      }),
      baseField('structure_charge_max_kg', 'Charge maximale (kg)', 'number', { min: 0 }),
      baseField('structure_charge_utile_kg', 'Charge utile recommandée (kg)', 'number', { min: 0 }),
      baseField('structure_longueur_utile_mm', 'Longueur utile (mm)', 'number', { min: 0 }),
      baseField('structure_hauteur_max_mm', 'Hauteur max (mm)', 'number', { min: 0 }),
      baseField('structure_norme', 'Norme', 'text'),
      baseField('structure_date_dernier_controle', 'Dernier contrôle levage', 'date'),
      baseField('structure_date_prochain_controle', 'Prochain contrôle levage', 'date'),
      baseField('maintenance_etat_visuel_ok', 'État visuel OK', 'boolean', { defaultValue: true }),
      baseField('doc_remarques_techniques', 'Remarques techniques', 'text'),
    ],
  },
];


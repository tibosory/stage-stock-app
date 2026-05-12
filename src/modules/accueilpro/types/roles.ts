/**
 * Rôles AccueilPro / suite métier (JWT user_metadata.role côté Supabase Auth).
 * Le portail « client » correspond à role absent ou explicitement `client`.
 */
export const ACCUEILPRO_STAFF_ROLES = ['admin', 'régisseur', 'technicien', 'accueil'] as const;
export type AccueilProStaffRole = (typeof ACCUEILPRO_STAFF_ROLES)[number];

export const ACCUEILPRO_CLIENT_ROLE = 'client' as const;

/** Rôle transverse (prompt intégration) : lecture large événements — hors du scope RLS actuel ; à brancher via policies dédiées. */
export const ACCUEILPRO_ORGANISATEUR_ROLE = 'organisateur' as const;

export type AccueilProKnownRole =
  | AccueilProStaffRole
  | typeof ACCUEILPRO_CLIENT_ROLE
  | typeof ACCUEILPRO_ORGANISATEUR_ROLE
  | string;

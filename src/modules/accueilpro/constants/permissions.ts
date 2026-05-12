/**
 * Matrice fonctionnelle portail client (associations / entreprises).
 * Source métier : accès limité — tout ce qui n’est pas listé comme éditable côté client
 * doit être présenté en lecture seule dans l’UI (boutons masqués + bannière).
 */
export const CLIENT_PORTAL_EDIT = {
  organizationProfile: true,
  organizationContacts: true,
  organizationDocuments: true,
} as const;

export const CLIENT_PORTAL_READ_ONLY = {
  planning: true,
  events: true,
  conventions: true,
  roomInspections: true,
  venueTechnicalInfo: true,
  spaces: true,
  eventEquipment: true,
  teamMembersStaff: false,
  otherOrganizations: false,
  dailyRoadmap: false,
  stageStock: false,
} as const;

export type ClientPortalEditKey = keyof typeof CLIENT_PORTAL_EDIT;
export type ClientPortalReadOnlyKey = keyof typeof CLIENT_PORTAL_READ_ONLY;

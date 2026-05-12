export { ACCUEILPRO_STAFF_ROLES, ACCUEILPRO_CLIENT_ROLE, ACCUEILPRO_ORGANISATEUR_ROLE } from './types/roles';
export type { AccueilProStaffRole, AccueilProKnownRole } from './types/roles';
export { CLIENT_PORTAL_EDIT, CLIENT_PORTAL_READ_ONLY } from './constants/permissions';
export {
  CLIENT_PORTAL_CHECKLIST,
  computeClientChecklistProgress,
  type ClientChecklistItem,
  type ClientOrgSnapshot,
} from './constants/clientChecklist';
export { clientPortalTheme } from './theme/clientPortalTheme';
export { useAccueilProRole } from './hooks/useAccueilProRole';
export type { AccueilProAccess } from './hooks/useAccueilProRole';
export { ClientReadOnlyBanner } from './components/ClientReadOnlyBanner';
export { PermissionGuard } from './components/PermissionGuard';

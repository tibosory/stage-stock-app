import { AppUserRole } from '../types';

export type Permission =
  | 'manage_users'
  | 'edit_inventory'
  | 'view_all_prets'
  | 'export_data'
  | 'params_sync'
  | 'delete_pret';

const MATRIX: Record<Permission, AppUserRole[]> = {
  manage_users: ['admin'],
  edit_inventory: ['admin', 'technicien'],
  view_all_prets: ['admin', 'technicien'],
  export_data: ['admin', 'technicien'],
  params_sync: ['admin', 'technicien'],
  delete_pret: ['admin', 'technicien'],
};

export function can(role: AppUserRole | undefined, perm: Permission): boolean {
  if (!role) return false;
  return MATRIX[perm]?.includes(role) ?? false;
}

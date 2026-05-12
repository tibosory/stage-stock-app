import { useMemo } from 'react';
import { useAuth } from '../../../context/AuthProvider';
import { ACCUEILPRO_STAFF_ROLES, type AccueilProKnownRole } from '../types/roles';

export type AccueilProAccess = {
  /** Valeur brute user_metadata.role (défaut `client`). */
  role: AccueilProKnownRole;
  isStaff: boolean;
  /** Compte association / entreprise (portail restreint). */
  isClientPortal: boolean;
};

/**
 * Déduit les capacités UI AccueilPro depuis la session Supabase Auth.
 * Les droits réels sont appliqués par RLS PostgreSQL (migrations Supabase).
 */
export function useAccueilProRole(): AccueilProAccess {
  const { user } = useAuth();
  return useMemo(() => {
    const raw =
      (user?.user_metadata as { role?: string } | undefined)?.role?.trim() || 'client';
    const role = raw as AccueilProKnownRole;
    const isStaff = (ACCUEILPRO_STAFF_ROLES as readonly string[]).includes(raw);
    return {
      role,
      isStaff,
      isClientPortal: !isStaff,
    };
  }, [user]);
}

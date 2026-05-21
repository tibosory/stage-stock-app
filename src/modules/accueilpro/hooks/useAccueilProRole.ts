import { useMemo } from 'react';
import { useAppAuth } from '../../../context/AuthContext';
import type { AppUserRole } from '../../../types';
import {
  ACCUEILPRO_CLIENT_ROLE,
  ACCUEILPRO_ORGANISATEUR_ROLE,
  ACCUEILPRO_STAFF_ROLES,
  type AccueilProKnownRole,
} from '../types/roles';

export type AccueilProAccess = {
  /** Rôle métier déduit (session PIN locale ou portail client). */
  role: AccueilProKnownRole;
  isStaff: boolean;
  /** Compte association / entreprise (portail restreint). */
  isClientPortal: boolean;
  /** Rôle « organisateur » : même périmètre que `client`. */
  isOrganisateur: boolean;
};

function mapAppUserRole(appRole: AppUserRole | undefined): AccueilProKnownRole {
  if (appRole === 'admin') return 'admin';
  if (appRole === 'technicien') return 'technicien';
  if (appRole === 'emprunteur') return ACCUEILPRO_CLIENT_ROLE;
  return ACCUEILPRO_CLIENT_ROLE;
}

/**
 * Capacités UI Accueil Pro depuis la session locale (PIN).
 * En déploiement LAN, admin / technicien = équipe du lieu ; emprunteur = portail association.
 */
export function useAccueilProRole(): AccueilProAccess {
  const { user } = useAppAuth();
  return useMemo(() => {
    const raw = mapAppUserRole(user?.role);
    const isStaff = (ACCUEILPRO_STAFF_ROLES as readonly string[]).includes(raw);
    const isOrganisateur = raw === ACCUEILPRO_ORGANISATEUR_ROLE;
    const isPortailRole = raw === ACCUEILPRO_CLIENT_ROLE || isOrganisateur;
    return {
      role: raw,
      isStaff,
      isClientPortal: isPortailRole && !isStaff,
      isOrganisateur,
    };
  }, [user?.role]);
}

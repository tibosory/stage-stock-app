import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useAccueilProRole } from '../hooks/useAccueilProRole';
import type { AccueilProKnownRole } from '../types/roles';
import { ClientReadOnlyBanner } from './ClientReadOnlyBanner';

type Props = {
  children: React.ReactNode;
  /** Réservé à l’équipe du lieu (admin, technicien, régisseur…). */
  staffOnly?: boolean;
  allowedRoles?: AccueilProKnownRole[];
  fallback?: React.ReactNode;
  /** Si vrai et accès refusé : bandeau lecture seule au-dessus du contenu. */
  showReadOnlyBannerInstead?: boolean;
};

/**
 * Garde d’écran : masque les actions sensibles pour le portail association.
 */
export function PermissionGuard({
  children,
  staffOnly = false,
  allowedRoles,
  fallback,
  showReadOnlyBannerInstead = false,
}: Props) {
  const { role, isStaff } = useAccueilProRole();
  const okByStaff = staffOnly ? isStaff : true;
  const okByRole = allowedRoles ? allowedRoles.map(String).includes(String(role)) : true;
  const ok = okByStaff && okByRole;

  if (ok) {
    return <>{children}</>;
  }

  if (showReadOnlyBannerInstead) {
    return (
      <View style={styles.stack}>
        <ClientReadOnlyBanner />
        {children}
      </View>
    );
  }

  return <>{fallback ?? null}</>;
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
});

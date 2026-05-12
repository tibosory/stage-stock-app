import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useAccueilProRole } from '../hooks/useAccueilProRole';
import type { AccueilProKnownRole } from '../types/roles';
import { ClientReadOnlyBanner } from './ClientReadOnlyBanner';

type Props = {
  children: React.ReactNode;
  allowedRoles: AccueilProKnownRole[];
  /** Si le rôle n’est pas autorisé : bannière seule, contenu masqué, ou les deux selon usage. */
  fallback?: React.ReactNode;
  /** Si vrai et rôle refusé : affiche les enfants mais enveloppés d’un bandeau (préparation écran mixte). */
  showReadOnlyBannerInstead?: boolean;
};

/**
 * Garde d’écran : n’affiche les actions sensibles que pour les rôles listés.
 * Pour le portail client, préférer `allowedRoles` = staff uniquement et `fallback` = null avec boutons désactivés ailleurs.
 */
export function PermissionGuard({
  children,
  allowedRoles,
  fallback,
  showReadOnlyBannerInstead = false,
}: Props) {
  const { role } = useAccueilProRole();
  const ok = allowedRoles.map(String).includes(String(role));

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

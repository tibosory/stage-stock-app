import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { clientPortalTheme } from '../theme/clientPortalTheme';

type Props = {
  /** Texte court ; par défaut message lieu géré par le staff. */
  message?: string;
};

/**
 * Bannière affichée sur les écrans où le compte client n’a pas le droit de modification.
 */
export function ClientReadOnlyBanner({
  message = 'Cette section est gérée par l’équipe du lieu. Pour toute modification, contactez-les.',
}: Props) {
  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <Text style={styles.icon} accessibilityLabel="Lecture seule">
        👁
      </Text>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: clientPortalTheme.readonlyBannerBg,
    borderWidth: 1,
    borderColor: clientPortalTheme.readonlyBannerBorder,
  },
  icon: { fontSize: 16, lineHeight: 20 },
  text: {
    flex: 1,
    color: clientPortalTheme.text,
    fontSize: 14,
    lineHeight: 20,
  },
});

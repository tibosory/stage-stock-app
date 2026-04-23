import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing } from '../theme/spacing';
import { isConsumerApp } from '../config/appMode';
import { useConnection } from '../context/ConnectionContext';

/**
 * Bandeau non bloquant pour l’app consommateur : état connexion serveur.
 * Toucher relance une vérification (debounce côté contexte).
 */
export function ConnectionStatusBanner() {
  const { status, refresh } = useConnection();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  if (!isConsumerApp()) return null;
  if (status === 'ok') return null;

  const isChecking = status === 'checking';

  return (
    <Pressable
      onPress={() => void refresh()}
      style={({ pressed }) => [
        styles.wrap,
        {
          paddingTop: Math.max(insets.top, Spacing.sm),
          opacity: pressed ? 0.92 : 1,
          maxWidth: width,
        },
        isChecking ? styles.bgChecking : styles.bgOffline,
      ]}
      accessibilityRole="button"
      accessibilityLabel={
        isChecking
          ? 'Vérification de la connexion au serveur'
          : 'Serveur inaccessible. Appuyer pour réessayer'
      }
    >
      <View style={styles.row}>
        {isChecking && (
          <ActivityIndicator color={Colors.yellow} size="small" style={styles.spinner} />
        )}
        <Text style={styles.text} numberOfLines={3}>
          {isChecking
            ? 'Vérification du serveur…'
            : 'Hors ligne — impossible de joindre le serveur. Toucher pour réessayer.'}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  bgChecking: {
    backgroundColor: Colors.yellowBg,
  },
  bgOffline: {
    backgroundColor: Colors.redBg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  spinner: {
    marginRight: 2,
  },
  text: {
    ...Typography.bodySecondary,
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
});

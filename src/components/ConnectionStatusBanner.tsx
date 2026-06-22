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
import { effectiveTopInset } from '../lib/deviceSafeArea';
import { useConnection } from '../context/ConnectionContext';
import { useLanguage } from '../context/LanguageContext';

/**
 * Bandeau non bloquant pour l’app consommateur : état connexion serveur.
 * Toucher relance une vérification (debounce côté contexte).
 */
export function ConnectionStatusBanner() {
  const { status, refresh } = useConnection();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  if (!isConsumerApp()) return null;
  if (status === 'ok') return null;

  const isChecking = status === 'checking';
  const needsPairing = status === 'needs_pairing';

  return (
    <Pressable
      onPress={() => void refresh()}
      style={({ pressed }) => [
        styles.wrap,
        {
          paddingTop: effectiveTopInset(insets.top) + Spacing.sm,
          opacity: pressed ? 0.92 : 1,
          maxWidth: width,
        },
        isChecking ? styles.bgChecking : needsPairing ? styles.bgPairing : styles.bgOffline,
      ]}
      accessibilityRole="button"
      accessibilityLabel={
        isChecking
          ? t('network.state.checking')
          : needsPairing
            ? t('network.state.needsPairing')
            : t('network.state.offline')
      }
    >
      <View style={styles.row}>
        {isChecking && (
          <ActivityIndicator color={Colors.yellow} size="small" style={styles.spinner} />
        )}
        <Text style={styles.text} numberOfLines={4}>
          {isChecking
            ? t('network.state.checking')
            : needsPairing
              ? t('network.state.needsPairingBanner')
              : t('network.state.offlineBanner')}
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
  bgPairing: {
    backgroundColor: Colors.yellowBg,
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

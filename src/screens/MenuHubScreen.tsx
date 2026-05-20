import React, { useCallback } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { Typography } from '../theme/typography';
import { ScreenHeader, TabScreenSafeArea } from '../components/UI';
import { useAppAuth } from '../context/AuthContext';
import { isConsumerApp, isV1LanMode } from '../config/appMode';
import { goActivityHome } from '../navigation/goActivityHome';
import {
  getEmprunteurMenuDestinations,
  getStaffMenuDestinations,
} from '../navigation/mainMenuConfig';
import { useFeatureFlags } from '../saas/hooks/useFeatureFlags';
import { useLanguage } from '../context/LanguageContext';

export default function MenuHubScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAppAuth();
  const { t } = useLanguage();
  const { flags: saasFlags } = useFeatureFlags();
  const netLabel = isConsumerApp() ? t('tab.connection') : t('tab.network');
  const tourModeEnabled =
    !isV1LanMode() && Boolean(saasFlags['saas.tourMode']) && user?.role !== 'emprunteur';
  const bottomMenuPad =
    Platform.OS === 'android'
      ? Math.max(insets.bottom, 52) + 72
      : Math.max(insets.bottom, 12) + 24;

  const destinations =
    user?.role === 'emprunteur'
      ? getEmprunteurMenuDestinations(netLabel, t)
      : getStaffMenuDestinations(netLabel, t);

  const confirmLogout = useCallback(() => {
    Alert.alert(t('menu.hub.logoutTitle'), t('menu.hub.logoutBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('menu.hub.logoutConfirm'), style: 'destructive', onPress: () => void logout() },
    ]);
  }, [logout, t]);

  return (
    <TabScreenSafeArea style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomMenuPad }]}
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHeader
          icon={<Text style={styles.headerIcon}>☰</Text>}
          title={t('menu.hub.title')}
          subtitle={t('menu.hub.subtitle')}
        />

        <TouchableOpacity
          style={styles.homeRow}
          onPress={() => goActivityHome(navigation)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={t('menu.mainA11y')}
        >
          <Text style={styles.homeRowText}>{t('menu.main')}</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        {tourModeEnabled ? (
          <TouchableOpacity
            style={styles.tourHero}
            onPress={() => navigation.navigate('TourList' as never)}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="Tournée : créer, scanner ou ajouter du matériel"
          >
            <Text style={styles.tourHeroEmoji}>🎪</Text>
            <Text style={styles.tourHeroTitle}>Tournée — création et suivi</Text>
            <Text style={styles.tourHeroSub}>
              Créer une tournée, ouvrir le détail pour scanner QR / NFC ou ajouter du matériel depuis la liste
            </Text>
            <Text style={styles.tourHeroCta}>Ouvrir la liste des tournées →</Text>
          </TouchableOpacity>
        ) : null}

        {destinations.map(d => (
          <TouchableOpacity
            key={d.name}
            style={styles.row}
            activeOpacity={0.75}
            onPress={() => navigation.navigate(d.name as never)}
            accessibilityRole="button"
            accessibilityLabel={d.label}
          >
            <Text style={styles.rowLabel}>{d.label}</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={styles.logoutRow} onPress={confirmLogout} activeOpacity={0.75}>
          <Text style={styles.logoutText}>{t('menu.hub.logoutRow')}</Text>
        </TouchableOpacity>
        <View style={styles.footerSpacer} />
      </ScrollView>
    </TabScreenSafeArea>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scroll: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 32,
  },
  headerIcon: {
    fontSize: 22,
    color: Colors.textPrimary,
  },
  homeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginHorizontal: 4,
    marginBottom: 14,
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    minHeight: Spacing.touchMin,
  },
  homeRowText: { ...Typography.sectionTitle, fontSize: 15, color: '#A7F3D0' },
  tourHero: {
    paddingVertical: 20,
    paddingHorizontal: 18,
    marginHorizontal: 4,
    marginBottom: 16,
    borderRadius: 18,
    backgroundColor: '#0F766E',
    borderWidth: 2,
    borderColor: 'rgba(52, 211, 153, 0.55)',
    alignItems: 'center',
    minHeight: 128,
    justifyContent: 'center',
  },
  tourHeroEmoji: { fontSize: 36, marginBottom: 4 },
  tourHeroTitle: {
    color: '#ECFDF5',
    fontSize: 19,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
  },
  tourHeroSub: {
    color: 'rgba(236, 253, 245, 0.9)',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 8,
  },
  tourHeroCta: { color: '#6EE7B7', fontSize: 15, fontWeight: '800' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginHorizontal: 4,
    marginBottom: 10,
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: Spacing.touchMin + 6,
  },
  rowLabel: {
    ...Typography.sectionTitle,
    fontSize: 16,
  },
  chevron: {
    color: Colors.textMuted,
    fontSize: 20,
    fontWeight: '300',
  },
  logoutRow: {
    marginTop: 20,
    marginHorizontal: 12,
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  logoutText: {
    color: Colors.red,
    fontSize: 16,
    fontWeight: '600',
  },
  footerSpacer: {
    height: 8,
  },
});

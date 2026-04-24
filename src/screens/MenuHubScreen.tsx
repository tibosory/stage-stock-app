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
import { Typography } from '../theme/typography';
import { ScreenHeader, TabScreenSafeArea } from '../components/UI';
import { useAppAuth } from '../context/AuthContext';
import { isConsumerApp } from '../config/appMode';
import { goActivityHome } from '../navigation/goActivityHome';
import {
  getEmprunteurMenuDestinations,
  getStaffMenuDestinations,
} from '../navigation/mainMenuConfig';

export default function MenuHubScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAppAuth();
  const netLabel = isConsumerApp() ? 'Connexion' : 'Réseau';
  const bottomMenuPad =
    Platform.OS === 'android'
      ? Math.max(insets.bottom, 52) + 72
      : Math.max(insets.bottom, 12) + 24;

  const destinations =
    user?.role === 'emprunteur'
      ? getEmprunteurMenuDestinations(netLabel)
      : getStaffMenuDestinations(netLabel);

  const confirmLogout = useCallback(() => {
    Alert.alert(
      'Déconnexion',
      'Changer d’utilisateur ou de compte : vous reverrez l’écran de connexion.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Se déconnecter', style: 'destructive', onPress: () => void logout() },
      ]
    );
  }, [logout]);

  return (
    <TabScreenSafeArea style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomMenuPad }]}
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHeader
          icon={<Text style={styles.headerIcon}>☰</Text>}
          title="Toutes les rubriques"
        />
        <Text style={styles.hint}>
          Scanner, Stock et Consommables sont accessibles directement dans la barre du bas. Ici : IA, alertes, prêts,
          paramètres…
        </Text>

        <TouchableOpacity
          style={styles.homeRow}
          onPress={() => goActivityHome(navigation)}
          activeOpacity={0.8}
        >
          <Text style={styles.homeRowText}>Menu d’accueil (grandes tuiles d’activité)</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        {destinations.map(d => (
          <TouchableOpacity
            key={d.name}
            style={styles.row}
            activeOpacity={0.75}
            onPress={() => navigation.navigate(d.name as never)}
          >
            <Text style={styles.rowLabel}>{d.label}</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={styles.logoutRow} onPress={confirmLogout} activeOpacity={0.75}>
          <Text style={styles.logoutText}>Se déconnecter…</Text>
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
  hint: {
    ...Typography.bodySecondary,
    paddingHorizontal: 8,
    marginBottom: 12,
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
    minHeight: 48,
  },
  homeRowText: { ...Typography.sectionTitle, fontSize: 15, color: '#A7F3D0' },
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
    minHeight: 54,
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

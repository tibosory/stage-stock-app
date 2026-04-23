import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { TabScreenSafeArea } from '../components/UI';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { useAppAuth } from '../context/AuthContext';
import { useConnection } from '../context/ConnectionContext';
import { isConsumerApp } from '../config/appMode';

/** Couleurs type drapeau arc-en-ciel / inclusive (accessibles sur texte blanc ou texte foncé) */
const PRIDE_TILES_STAFF: { key: string; label: string; route: string; bg: string; textOn: 'light' | 'dark' }[] = [
  { key: 'stock', label: 'Stock', route: 'WorkspaceStock', bg: '#E40303', textOn: 'light' },
  { key: 'conso', label: 'Consommables', route: 'WorkspaceConsommable', bg: '#FF8C00', textOn: 'light' },
  { key: 'pret', label: 'Prêt', route: 'WorkspacePret', bg: '#FFD000', textOn: 'dark' },
  { key: 'ctrl', label: 'Contrôle', route: 'WorkspaceControle', bg: '#008026', textOn: 'light' },
  { key: 'param', label: 'Paramètres', route: 'WorkspaceParams', bg: '#004DFF', textOn: 'light' },
  { key: 'alerte', label: 'Alertes', route: 'WorkspaceAlertes', bg: '#750787', textOn: 'light' },
  { key: 'io', label: 'Import / Export', route: 'WorkspaceImportExport', bg: '#FF6B9D', textOn: 'light' },
  { key: 'print', label: 'Impression', route: 'WorkspaceImpression', bg: '#62C5EA', textOn: 'dark' },
];

const PRIDE_ALL_GRADIENT = ['#E40303', '#FF8C00', '#FFD000', '#008026', '#004DFF', '#750787', '#FF6B9D'] as const;

const PRIDE_TILES_EMPRUNTEUR: { key: string; label: string; route: string; bg: string; textOn: 'light' | 'dark' }[] = [
  { key: 'pret', label: 'Prêt', route: 'WorkspacePret', bg: '#E40303', textOn: 'light' },
  { key: 'compte', label: 'Compte', route: 'WorkspaceCompteEmprunteur', bg: '#FF8C00', textOn: 'light' },
  { key: 'param', label: 'Paramètres', route: 'WorkspaceParams', bg: '#008026', textOn: 'light' },
  { key: 'io', label: 'Import / Export', route: 'WorkspaceImportExport', bg: '#004DFF', textOn: 'light' },
  { key: 'ia', label: 'Assistant (IA)', route: 'WorkspaceAssistant', bg: '#750787', textOn: 'light' },
  { key: 'notice', label: 'Notice', route: 'WorkspaceNotice', bg: '#FF6B9D', textOn: 'light' },
  { key: 'res', label: 'Lien / Réseau', route: 'WorkspaceReseau', bg: '#62C5EA', textOn: 'dark' },
];

export default function ActivityHomeScreen() {
  const navigation = useNavigation<any>();
  const { user, logout } = useAppAuth();
  const { status } = useConnection();
  const { width } = useWindowDimensions();
  const [searchText, setSearchText] = useState('');

  const isEmp = user?.role === 'emprunteur';
  const tiles = isEmp ? PRIDE_TILES_EMPRUNTEUR : PRIDE_TILES_STAFF;
  const gap = 10;
  const col = 2;
  const tileW = (width - 16 * 2 - gap) / col;

  const iaReachable = !isConsumerApp() || status === 'ok';

  const onSearchSubmit = useCallback(() => {
    const q = searchText.trim();
    if (!q) {
      Alert.alert('Recherche', 'Saisissez un mot-clé pour lancer la recherche locale, ou la question pour l’IA.');
      return;
    }
    if (iaReachable) {
      navigation.navigate('WorkspaceAssistant' as never, {
        screen: 'WsIaMain',
        params: { prefill: q },
      } as never);
    } else {
      navigation.navigate('QuickSearch' as never, { q } as never);
    }
  }, [navigation, searchText, iaReachable]);

  const searchPlaceholder = useMemo(
    () =>
      iaReachable
        ? 'Question IA ou mot-clé (Entrée pour lancer)…'
        : 'Recherche locale (sans serveur) — mot-clé…',
    [iaReachable]
  );

  const confirmLogout = useCallback(() => {
    Alert.alert('Déconnexion', 'Retour à l’écran de connexion ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnecter', style: 'destructive', onPress: () => void logout() },
    ]);
  }, [logout]);

  return (
    <TabScreenSafeArea style={s.safe}>
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={s.topRow}>
          <Text style={s.title} accessibilityRole="header">
            {isEmp ? 'Espace prêts' : 'Choisir une activité'}
          </Text>
          <TouchableOpacity onPress={confirmLogout} style={s.logoutPill} activeOpacity={0.85}>
            <Text style={s.logoutPillText}>Déconnexion</Text>
          </TouchableOpacity>
        </View>
        <Text style={s.subtitle}>
          Gros boutons : un domaine et le scan (onglet) à côté. « Tout » ouvre l’app avec la barre d’onglets complète.
        </Text>

        <View style={s.searchBlock}>
          <Text style={s.searchLabel}>{iaReachable ? 'Recherche assistant (réseau OK)' : 'Recherche locale'}</Text>
          <View style={s.searchRow}>
            <Text style={s.searchIcon}>{iaReachable ? '✦' : '🔍'}</Text>
            <TextInput
              value={searchText}
              onChangeText={setSearchText}
              placeholder={searchPlaceholder}
              placeholderTextColor={Colors.textMuted}
              style={s.searchInput}
              returnKeyType="search"
              onSubmitEditing={onSearchSubmit}
            />
            <TouchableOpacity onPress={onSearchSubmit} style={s.searchGo} accessibilityLabel="Lancer la recherche">
              <Text style={s.searchGoText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[s.grid, { width: width - 32 }]}>
          {tiles.map(t => (
            <TouchableOpacity
              key={t.key}
              style={[s.tile, { width: tileW, backgroundColor: t.bg }]}
              onPress={() => navigation.navigate(t.route as never)}
              activeOpacity={0.88}
            >
              <Text style={[s.tileText, t.textOn === 'dark' && s.tileTextDark]}>{t.label}</Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            onPress={() => navigation.navigate('FullApp' as never)}
            style={[s.tile, s.tileAll, { width: '100%' }]}
            activeOpacity={0.9}
          >
            <LinearGradient colors={[...PRIDE_ALL_GRADIENT]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.tileAllGrad}>
              <Text style={s.tileText}>ALL</Text>
              <Text style={s.tileAllHint}>Onglets complets</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <Text style={s.footerNote}>
          Retour ici : bouton rond « ⌂ » en haut à gauche dans chaque espace, ou entrer dans l’onglet « Menu » depuis
          « Tout ».
        </Text>
      </ScrollView>
    </TabScreenSafeArea>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  title: { ...Typography.screenTitle, fontSize: 20, flex: 1, marginRight: 8 },
  subtitle: { ...Typography.caption, color: Colors.textMuted, marginBottom: 12, lineHeight: 18 },
  logoutPill: {
    borderWidth: 1,
    borderColor: Colors.red,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  logoutPillText: { color: Colors.red, fontWeight: '700', fontSize: 13 },
  searchBlock: { marginBottom: 14 },
  searchLabel: { ...Typography.caption, color: Colors.textSecondary, marginBottom: 4 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingLeft: 10,
  },
  searchIcon: { fontSize: 16, color: Colors.green, marginRight: 4 },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 15,
    paddingVertical: 10,
    minHeight: 44,
  },
  searchGo: { paddingHorizontal: 12, paddingVertical: 10 },
  searchGoText: { color: Colors.green, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'stretch' },
  tile: {
    minHeight: 100,
    borderRadius: 16,
    padding: 12,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  tileAll: { width: '100%', padding: 0, overflow: 'hidden', borderColor: 'rgba(255,255,255,0.2)' },
  tileAllGrad: { flex: 1, minHeight: 88, padding: 14, justifyContent: 'center', alignItems: 'center' },
  tileText: { color: '#fff', fontSize: 17, fontWeight: '900', textAlign: 'center' },
  tileTextDark: { color: '#111' },
  tileAllHint: { color: 'rgba(255,255,255,0.95)', fontSize: 12, marginTop: 4, fontWeight: '600' },
  footerNote: { ...Typography.caption, color: Colors.textMuted, marginTop: 16, lineHeight: 16 },
});

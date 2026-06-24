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
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { TabScreenSafeArea } from '../components/UI';
import { Colors, Shadow, AccueilProColors } from '../theme/colors';
import { HitSlop, Spacing } from '../theme/spacing';
import { Typography } from '../theme/typography';
import { useAppAuth } from '../context/AuthContext';
import { useConnection } from '../context/ConnectionContext';
import { isConsumerApp } from '../config/appMode';
import { useLanguage } from '../context/LanguageContext';

type MainTile = {
  key: string;
  label: string;
  route: string;
  accent: string;
  tint: string;
};

type TileTemplate = Omit<MainTile, 'label'> & { labelKey: string };

const ACCUEIL_PRO_GRADIENT = [AccueilProColors.navy, '#243556', '#2F4268'] as const;

const PRIDE_TILE_DEFS_STAFF: TileTemplate[] = [
  { key: 'stock', labelKey: 'stock.title', route: 'WorkspaceStock', accent: '#EF4444', tint: 'rgba(239,68,68,0.12)' },
  {
    key: 'conso',
    labelKey: 'consumables.title',
    route: 'WorkspaceConsommable',
    accent: '#F59E0B',
    tint: 'rgba(245,158,11,0.12)',
  },
  { key: 'pret', labelKey: 'home.tile.loanHub', route: 'WorkspacePret', accent: '#EAB308', tint: 'rgba(234,179,8,0.12)' },
  {
    key: 'ctrl',
    labelKey: 'home.tile.inspectionHub',
    route: 'WorkspaceControle',
    accent: '#10B981',
    tint: 'rgba(16,185,129,0.12)',
  },
  {
    key: 'res',
    labelKey: 'home.tile.network',
    route: 'WorkspaceReseau',
    accent: '#06B6D4',
    tint: 'rgba(6,182,212,0.12)',
  },
  { key: 'param', labelKey: 'tab.settings', route: 'WorkspaceParams', accent: '#3B82F6', tint: 'rgba(59,130,246,0.12)' },
  { key: 'alerte', labelKey: 'tab.alerts', route: 'WorkspaceAlertes', accent: '#8B5CF6', tint: 'rgba(139,92,246,0.12)' },
  {
    key: 'io',
    labelKey: 'tab.importExport',
    route: 'WorkspaceImportExport',
    accent: '#EC4899',
    tint: 'rgba(236,72,153,0.12)',
  },
  {
    key: 'print',
    labelKey: 'home.tile.print',
    route: 'WorkspaceImpression',
    accent: '#06B6D4',
    tint: 'rgba(6,182,212,0.12)',
  },
];

const PRIDE_ALL_GRADIENT = ['#E40303', '#FF8C00', '#FFD000', '#008026', '#004DFF', '#750787', '#FF6B9D'] as const;

const PRIDE_TILE_DEFS_EMPRUNTEUR: TileTemplate[] = [
  { key: 'pret', labelKey: 'home.tile.loanHub', route: 'WorkspacePret', accent: '#EF4444', tint: 'rgba(239,68,68,0.12)' },
  {
    key: 'compte',
    labelKey: 'tab.account',
    route: 'WorkspaceCompteEmprunteur',
    accent: '#F59E0B',
    tint: 'rgba(245,158,11,0.12)',
  },
  { key: 'param', labelKey: 'tab.settings', route: 'WorkspaceParams', accent: '#10B981', tint: 'rgba(16,185,129,0.12)' },
  {
    key: 'io',
    labelKey: 'tab.importExport',
    route: 'WorkspaceImportExport',
    accent: '#3B82F6',
    tint: 'rgba(59,130,246,0.12)',
  },
  { key: 'ia', labelKey: 'home.tile.aiFull', route: 'WorkspaceAssistant', accent: '#8B5CF6', tint: 'rgba(139,92,246,0.12)' },
  {
    key: 'notice',
    labelKey: 'tab.notice',
    route: 'WorkspaceNotice',
    accent: '#EC4899',
    tint: 'rgba(236,72,153,0.12)',
  },
  {
    key: 'res',
    labelKey: 'home.tile.network',
    route: 'WorkspaceReseau',
    accent: '#06B6D4',
    tint: 'rgba(6,182,212,0.12)',
  },
];

export default function ActivityHomeScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAppAuth();
  const { status } = useConnection();
  const { width } = useWindowDimensions();
  const [searchText, setSearchText] = useState('');
  const { t } = useLanguage();

  const isEmp = user?.role === 'emprunteur';
  const tourModeEnabled = !isEmp;
  const accueilProEnabled = !isEmp;
  const tiles = useMemo(
    (): MainTile[] =>
      (isEmp ? PRIDE_TILE_DEFS_EMPRUNTEUR : PRIDE_TILE_DEFS_STAFF).map(d => ({
        ...d,
        label: t(d.labelKey),
      })),
    [isEmp, t]
  );
  const gap = 10;
  const col = 2;
  const tileW = (width - 16 * 2 - gap) / col;
  const bottomMenuPad =
    Platform.OS === 'android'
      ? Math.max(insets.bottom, 52) + 72
      : Math.max(insets.bottom, 12) + 24;

  const iaReachable = !isConsumerApp() || status === 'ok';

  const onSearchSubmit = useCallback(() => {
    const q = searchText.trim();
    if (!q) {
      Alert.alert(t('home.search.emptyTitle'), t('home.search.emptyBody'));
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
  }, [navigation, searchText, iaReachable, t]);

  const searchPlaceholder = useMemo(
    () => (iaReachable ? t('home.placeholderIa') : t('home.placeholderLocal')),
    [iaReachable, t]
  );

  const confirmLogout = useCallback(() => {
    Alert.alert(t('home.logoutConfirmTitle'), t('home.logoutConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('home.logoutConfirmDestructive'), style: 'destructive', onPress: () => void logout() },
    ]);
  }, [logout, t]);

  return (
    <TabScreenSafeArea style={s.safe}>
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: bottomMenuPad }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={s.topRow}>
          <Text style={s.title} accessibilityRole="header">
            {isEmp ? t('home.title.borrower') : t('home.title.staff')}
          </Text>
          <TouchableOpacity onPress={confirmLogout} style={s.logoutPill} activeOpacity={0.85}>
            <Text style={s.logoutPillText}>{t('home.logout')}</Text>
          </TouchableOpacity>
        </View>
        <Text style={s.subtitle}>{t('home.subtitle')}</Text>

        <View style={s.searchBlock}>
          <Text style={s.searchLabel}>
            {iaReachable ? t('home.search.labelIa') : t('home.search.labelLocal')}
          </Text>
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
            <TouchableOpacity
              onPress={onSearchSubmit}
              style={s.searchGo}
              hitSlop={HitSlop}
              accessibilityRole="button"
              accessibilityLabel={t('home.search.a11y')}
            >
              <Text style={s.searchGoText}>{t('common.ok')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {tourModeEnabled ? (
          <TouchableOpacity
            style={[s.tourHero, { width: width - 32 }]}
            onPress={() => navigation.navigate('TourList' as never)}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel={t('home.tourHero.a11y')}
          >
            <Text style={s.tourHeroEmoji}>🎪</Text>
            <Text style={s.tourHeroTitle}>{t('home.tourHero.title')}</Text>
            <Text style={s.tourHeroSub}>{t('home.tourHero.sub')}</Text>
            <Text style={s.tourHeroCta}>{t('home.tourHero.cta')}</Text>
          </TouchableOpacity>
        ) : null}

        {accueilProEnabled ? (
          <TouchableOpacity
            style={[s.apHero, { width: width - 32 }]}
            onPress={() => navigation.navigate('WorkspaceAccueilPro' as never)}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel={t('home.accueilProHero.a11y')}
          >
            <LinearGradient
              colors={[...ACCUEIL_PRO_GRADIENT]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.apHeroGrad}
            >
              <View style={s.apHeroBadge}>
                <Text style={s.apHeroBadgeText}>{t('home.accueilProHero.badge')}</Text>
              </View>
              <Text style={s.apHeroEmoji}>🏛️</Text>
              <Text style={s.apHeroTitle}>{t('home.tile.accueilPro')}</Text>
              <Text style={s.apHeroSub}>{t('home.accueilProHero.sub')}</Text>
              <Text style={s.apHeroCta}>{t('home.accueilProHero.cta')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : null}

        <View style={[s.regieRow, { width: width - 32 }]}>
          <TouchableOpacity
            style={s.regieCard}
            onPress={() => navigation.navigate('ConduiteList' as never)}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="Ouvrir les conduites techniques"
          >
            <Text style={s.regieEmoji}>🎬</Text>
            <Text style={s.regieTitle}>Conduites</Text>
            <Text style={s.regieSub}>Tops & mode live</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.regieCard}
            onPress={() => navigation.navigate('MiseTechniqueList' as never)}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="Ouvrir la mise technique"
          >
            <Text style={s.regieEmoji}>🗺️</Text>
            <Text style={s.regieTitle}>Mise technique</Text>
            <Text style={s.regieSub}>Plan de scène & photos</Text>
          </TouchableOpacity>
        </View>

        <View style={[s.grid, { width: width - 32 }]}>
          {tiles.map(tile => (
            <TouchableOpacity
              key={tile.key}
              style={[
                s.tile,
                {
                  width: tileW,
                  backgroundColor: tile.tint,
                  borderColor: tile.accent,
                },
              ]}
              onPress={() => navigation.navigate(tile.route as never)}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityLabel={t('home.tile.openA11y').replace('{{label}}', tile.label)}
            >
              <View style={[s.tileAccentDot, { backgroundColor: tile.accent }]} />
              <Text style={[s.tileText, { color: tile.accent }]}>{tile.label}</Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            onPress={() => navigation.navigate('FullApp' as never)}
            style={[s.tile, s.tileAll, { width: '100%' }]}
            activeOpacity={0.9}
          >
            <LinearGradient colors={[...PRIDE_ALL_GRADIENT]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.tileAllGrad}>
              <Text style={s.tileText}>{t('home.tileAll')}</Text>
              <Text style={s.tileAllHint}>{t('home.tileAllHint')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <Text style={s.footerNote}>{t('home.footerNote')}</Text>
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
  subtitle: { ...Typography.screenIntro, marginBottom: Spacing.md },
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
    borderColor: Colors.borderStrong,
    borderRadius: 16,
    paddingLeft: 10,
    minHeight: Spacing.touchMin,
  },
  searchIcon: { fontSize: 16, color: Colors.green, marginRight: 4 },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 15,
    paddingVertical: 10,
    minHeight: 44,
  },
  searchGo: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: Spacing.touchMin,
    justifyContent: 'center',
  },
  searchGoText: { color: Colors.green, fontWeight: '800' },
  tourHero: {
    alignSelf: 'center',
    marginBottom: 16,
    paddingVertical: 22,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: '#0F766E',
    borderWidth: 2,
    borderColor: 'rgba(52, 211, 153, 0.55)',
    alignItems: 'center',
    minHeight: 132,
    justifyContent: 'center',
  },
  tourHeroEmoji: { fontSize: 40, marginBottom: 6 },
  tourHeroTitle: {
    color: '#ECFDF5',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  tourHeroSub: {
    color: 'rgba(236, 253, 245, 0.92)',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 10,
  },
  tourHeroCta: { color: '#6EE7B7', fontSize: 16, fontWeight: '800' },
  apHero: {
    alignSelf: 'center',
    marginBottom: 16,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: AccueilProColors.gold,
    ...Shadow.card,
  },
  apHeroGrad: {
    paddingVertical: 22,
    paddingHorizontal: 20,
    alignItems: 'center',
    minHeight: 148,
    justifyContent: 'center',
  },
  apHeroBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(200, 151, 58, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(200, 151, 58, 0.55)',
  },
  apHeroBadgeText: {
    color: AccueilProColors.gold,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  apHeroEmoji: { fontSize: 38, marginBottom: 6 },
  apHeroTitle: {
    color: AccueilProColors.cream,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  apHeroSub: {
    color: 'rgba(247, 244, 238, 0.88)',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 10,
    paddingHorizontal: 8,
  },
  apHeroCta: { color: AccueilProColors.gold, fontSize: 16, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'stretch' },
  tile: {
    minHeight: 108,
    borderRadius: 22,
    padding: 14,
    justifyContent: 'center',
    borderWidth: 2,
    ...Shadow.card,
  },
  regieRow: { flexDirection: 'row', gap: 12, marginBottom: 12, alignSelf: 'center' },
  regieCard: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.green,
    borderRadius: 16,
    padding: 16,
    minHeight: 96,
    justifyContent: 'center',
    ...Shadow.card,
  },
  regieEmoji: { fontSize: 24, marginBottom: 6 },
  regieTitle: { ...Typography.sectionTitle, color: Colors.green },
  regieSub: { ...Typography.caption, marginTop: 2 },
  tileAll: { width: '100%', padding: 0, overflow: 'hidden', borderColor: 'rgba(255,255,255,0.2)' },
  tileAllGrad: { flex: 1, minHeight: 88, padding: 14, justifyContent: 'center', alignItems: 'center' },
  tileAccentDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    alignSelf: 'center',
    marginBottom: 8,
  },
  tileText: { fontSize: 17, fontWeight: '900', textAlign: 'center' },
  tileAllHint: { color: 'rgba(255,255,255,0.95)', fontSize: 12, marginTop: 4, fontWeight: '600' },
  footerNote: { ...Typography.caption, color: Colors.textMuted, marginTop: 16, lineHeight: 16 },
});

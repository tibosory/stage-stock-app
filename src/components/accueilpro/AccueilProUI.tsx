import React, { PropsWithChildren, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewStyle,
  type KeyboardTypeOptions,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, parse } from 'date-fns';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useConnection } from '../../context/ConnectionContext';
import { useLanguage } from '../../context/LanguageContext';
import { moduleAccueilPro } from '../../theme/tokens';
import { DateField as BaseDateField, SelectPicker as BaseSelectPicker } from '../UI';

export const AccueilProColors = moduleAccueilPro;

const apElevation = {
  shadowColor: AccueilProColors.navy,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 10,
  elevation: 2,
};

export const apStyles = StyleSheet.create({
  scroll: { flex: 1 },
  hero: {
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: AccueilProColors.card,
    borderRadius: AccueilProColors.radiusLg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: AccueilProColors.borderSubtle,
    ...apElevation,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: AccueilProColors.navy,
    marginBottom: 10,
    marginTop: 4,
  },
  hint: {
    fontSize: 14,
    color: AccueilProColors.textMuted,
    marginBottom: 10,
    lineHeight: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '800',
    color: AccueilProColors.navy,
    marginBottom: 10,
    letterSpacing: 0.15,
  },
  detailLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 4,
  },
  detailLabel: { fontWeight: '800', color: AccueilProColors.navy, fontSize: 15 },
  list: { gap: 8, paddingHorizontal: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: AccueilProColors.touchMin,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: AccueilProColors.borderSubtle,
    gap: 12,
  },
  rowTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: AccueilProColors.textPrimary },
  rowMeta: { fontSize: 13, color: AccueilProColors.textMuted, marginTop: 2 },
  rowActions: { flexDirection: 'row', gap: 8, flexShrink: 0 },
  rowChevron: { fontSize: 22, color: AccueilProColors.textMuted, fontWeight: '300', marginLeft: 4 },
  empty: {
    padding: 28,
    textAlign: 'center',
    fontSize: 15,
    color: AccueilProColors.textMuted,
    lineHeight: 22,
  },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, gap: 10 },
  checkLabel: { fontSize: 15, fontWeight: '600', color: AccueilProColors.textPrimary },
  checkSub: { fontSize: 13, color: AccueilProColors.textMuted, marginTop: 2 },
  tri: { flexDirection: 'row', gap: 8, flexShrink: 0 },
  triBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: AccueilProColors.borderSubtle,
    backgroundColor: AccueilProColors.card,
    justifyContent: 'center',
  },
  triOn: { borderColor: AccueilProColors.gold, backgroundColor: AccueilProColors.cream },
  triText: { fontSize: 12, color: AccueilProColors.textSecondary, fontWeight: '700' },
  inspBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 40,
    borderRadius: 10,
    backgroundColor: AccueilProColors.surfaceMuted,
    justifyContent: 'center',
  },
  inspDone: { backgroundColor: 'rgba(46,125,90,0.14)' },
  inspText: { fontSize: 13, fontWeight: '700', color: AccueilProColors.navy },
  sectionHeader: { fontWeight: '800', color: AccueilProColors.navy, marginTop: 12, marginBottom: 8, fontSize: 16 },
  sectionLink: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingVertical: 8,
    paddingHorizontal: 2,
    borderBottomWidth: 1,
    borderBottomColor: AccueilProColors.gold,
  },
  actionOk: { color: AccueilProColors.statusConfirme, fontWeight: '700', fontSize: 14 },
  actionNo: { color: AccueilProColors.statusAnnule, fontWeight: '700', fontSize: 14 },
  actionText: { fontSize: 14, color: AccueilProColors.navy, fontWeight: '600' },
  back: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 2,
    marginBottom: 4,
    minHeight: 44,
    justifyContent: 'center',
  },
  backText: { fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  formCard: {
    backgroundColor: AccueilProColors.card,
    borderRadius: AccueilProColors.radiusLg,
    padding: 16,
    marginBottom: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: AccueilProColors.borderSubtle,
    ...apElevation,
  },
  apInput: {
    backgroundColor: AccueilProColors.surfaceMuted,
    borderWidth: 1,
    borderColor: AccueilProColors.borderSubtle,
    borderRadius: AccueilProColors.radiusMd,
    color: AccueilProColors.textPrimary,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: AccueilProColors.touchMin,
    fontSize: 16,
  },
  contactPill: {
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  navTile: {
    width: '48%',
    minHeight: 80,
    backgroundColor: AccueilProColors.card,
    borderRadius: AccueilProColors.radiusLg,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: AccueilProColors.borderSubtle,
    ...apElevation,
  },
  navTileIcon: { fontSize: 26, marginBottom: 8 },
  navTileLabel: { fontWeight: '700', fontSize: 14, color: AccueilProColors.textPrimary, lineHeight: 18 },
});

type ScreenLayoutProps = PropsWithChildren<{
  headerTitle: string;
  headerSubtitle?: string;
  headerIcon?: React.ReactNode;
  headerRightLabel?: string;
  onHeaderRight?: () => void;
  loading?: boolean;
  scroll?: boolean;
  footer?: React.ReactNode;
  backLabel?: string;
  onBack?: () => void;
  contentContainerStyle?: ViewStyle;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Bandeau connexion / mode terrain en tête de contenu. */
  showFieldStrip?: boolean;
}>;

export function AccueilProFieldStrip() {
  const { status } = useConnection();
  const { t } = useLanguage();
  const online = status === 'ok';
  const needsPairing = status === 'needs_pairing';
  const checking = status === 'checking';

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor:
          checking ? 'rgba(64,104,224,0.1)'
          : needsPairing ? 'rgba(200,151,58,0.14)'
          : online ? 'rgba(46,125,90,0.12)'
          : 'rgba(181,74,69,0.12)',
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: AccueilProColors.radiusMd,
        marginBottom: 14,
        borderWidth: 1,
        borderColor:
          checking ? 'rgba(64,104,224,0.2)'
          : needsPairing ? 'rgba(200,151,58,0.35)'
          : online ? 'rgba(46,125,90,0.25)'
          : 'rgba(181,74,69,0.25)',
      }}
    >
      <View
        style={{
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor:
            checking ? AccueilProColors.primary
            : needsPairing ? AccueilProColors.gold
            : online ? AccueilProColors.statusConfirme
            : AccueilProColors.statusAnnule,
        }}
      />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: AccueilProColors.navy }}>
          {checking ? t('accueilpro.field.checking')
            : needsPairing ? t('accueilpro.field.needsPairing')
            : online ? t('accueilpro.field.online')
            : t('accueilpro.field.offline')}
        </Text>
        <Text style={{ fontSize: 12, color: AccueilProColors.textMuted, marginTop: 2 }}>
          {needsPairing ? t('accueilpro.field.needsPairingHint')
            : online ? t('accueilpro.field.onlineHint')
            : t('accueilpro.field.offlineHint')}
        </Text>
      </View>
    </View>
  );
}

export function AccueilProScreenLayout({
  headerTitle,
  headerSubtitle,
  headerIcon,
  headerRightLabel,
  onHeaderRight,
  loading,
  scroll = true,
  footer,
  backLabel,
  onBack,
  children,
  contentContainerStyle,
  refreshing,
  onRefresh,
  showFieldStrip = false,
}: ScreenLayoutProps) {
  const contentLead = (
    <>
      {showFieldStrip ? <AccueilProFieldStrip /> : null}
      {children}
    </>
  );

  const body =
    loading ? (
      <View style={{ flex: 1, justifyContent: 'center', padding: 18 }}>
        <ActivityIndicator color={AccueilProColors.gold} />
      </View>
    ) : scroll ? (
      <ScrollView
        keyboardShouldPersistTaps="handled"
        refreshControl={
          refreshing != null && onRefresh ?
            <RefreshControl refreshing={refreshing} onRefresh={() => onRefresh()} tintColor={AccueilProColors.gold} />
          : undefined
        }
        contentContainerStyle={[{ padding: 16, paddingBottom: 24 }, contentContainerStyle]}
        style={apStyles.scroll}
      >
        {contentLead}
      </ScrollView>
    ) : (
      <View style={[{ flex: 1, padding: 16 }, contentContainerStyle]}>{contentLead}</View>
    );

  return (
    <View style={{ flex: 1, backgroundColor: AccueilProColors.cream }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: AccueilProColors.navy }}>
        <View style={{ paddingHorizontal: 16, paddingBottom: 14, paddingTop: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, marginRight: 12 }}>
              {backLabel ?
                <TouchableOpacity accessibilityRole="button" onPress={onBack} style={apStyles.back} hitSlop={8}>
                  <Text style={apStyles.backText}>{backLabel}</Text>
                </TouchableOpacity>
              : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {headerIcon ? <>{headerIcon}</> : null}
                <View style={{ flexShrink: 1 }}>
                  <Text style={{ fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.3 }}>{headerTitle}</Text>
                  {headerSubtitle ?
                    <Text style={{ marginTop: 4, fontSize: 14, color: 'rgba(255,255,255,0.78)', lineHeight: 20 }}>
                      {headerSubtitle}
                    </Text>
                  : null}
                </View>
              </View>
            </View>
            {headerRightLabel && onHeaderRight ?
              <TouchableOpacity
                accessibilityRole="button"
                onPress={onHeaderRight}
                style={{ paddingTop: backLabel ? 0 : 8, minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 }}
                hitSlop={8}
              >
                <Text style={{ color: AccueilProColors.gold, fontWeight: '700', fontSize: 15 }}>{headerRightLabel}</Text>
              </TouchableOpacity>
            : null}
          </View>
        </View>
      </SafeAreaView>
      {body}
      {footer ?
        <SafeAreaView edges={['bottom']} style={{ backgroundColor: AccueilProColors.card, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: AccueilProColors.borderSubtle }}>
          <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>{footer}</View>
        </SafeAreaView>
      : null}
    </View>
  );
}

export function AccueilProPrimaryButton(props: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  style?: ViewStyle;
}) {
  return (
    <TouchableOpacity
      onPress={() => props.onPress()}
      disabled={props.loading}
      activeOpacity={0.88}
      style={[
        {
          backgroundColor: AccueilProColors.gold,
          paddingVertical: 16,
          borderRadius: AccueilProColors.radiusMd,
          alignItems: 'center',
          minHeight: AccueilProColors.touchMin,
          justifyContent: 'center',
        },
        props.style,
      ]}
    >
      {props.loading ?
        <ActivityIndicator color={AccueilProColors.navy} />
      : <Text style={{ fontWeight: '800', color: AccueilProColors.navy, fontSize: 16 }}>{props.label}</Text>}
    </TouchableOpacity>
  );
}

export function AccueilProChip(props: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={props.onPress}
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: 14,
        paddingVertical: 10,
        minHeight: 40,
        borderRadius: 20,
        borderWidth: 1,
        marginRight: 8,
        marginBottom: 8,
        borderColor: props.selected ? AccueilProColors.gold : AccueilProColors.borderSubtle,
        backgroundColor: props.selected ? AccueilProColors.cream : AccueilProColors.card,
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontWeight: '700', color: AccueilProColors.textPrimary, fontSize: 14 }}>{props.label}</Text>
    </TouchableOpacity>
  );
}

export function AccueilProEmpty(props: { message: string; emoji?: string }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 20 }}>
      {props.emoji ? <Text style={{ fontSize: 36, marginBottom: 10 }}>{props.emoji}</Text> : null}
      <Text style={apStyles.empty}>{props.message}</Text>
    </View>
  );
}

export function AccueilProHeroCard(props: { emoji: string; title: string; subtitle: string }) {
  return (
    <View style={apStyles.hero}>
      <Text style={{ fontSize: 36 }}>{props.emoji}</Text>
      <Text style={{ marginTop: 10, fontSize: 22, fontWeight: '900', color: AccueilProColors.textPrimary }}>
        {props.title}
      </Text>
      <Text style={{ marginTop: 8, fontSize: 14, color: AccueilProColors.textMuted, textAlign: 'center', lineHeight: 20, paddingHorizontal: 12 }}>
        {props.subtitle}
      </Text>
    </View>
  );
}

export function AccueilProLinkButton(props: {
  label: string;
  onPress: () => void;
  style?: ViewStyle;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={props.onPress}
      style={[apStyles.sectionLink, props.style]}
    >
      <Text style={{ fontWeight: '700', color: AccueilProColors.navy, fontSize: 14 }}>{props.label}</Text>
    </TouchableOpacity>
  );
}

export function AccueilProFormCard(props: PropsWithChildren<{ style?: ViewStyle }>) {
  return <View style={[apStyles.formCard, props.style]}>{props.children}</View>;
}

export function AccueilProInput(props: {
  label?: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  required?: boolean;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  editable?: boolean;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      {props.label ?
        <Text style={apStyles.label}>
          {props.label}
          {props.required ? <Text style={{ color: AccueilProColors.gold }}> *</Text> : null}
        </Text>
      : null}
      <TextInput
        style={[apStyles.apInput, props.multiline ? { minHeight: 96, textAlignVertical: 'top' } : null]}
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={AccueilProColors.textMuted}
        keyboardType={props.keyboardType}
        multiline={props.multiline}
        editable={props.editable !== false}
      />
    </View>
  );
}

export function AccueilProChecklistCard(props: {
  title: string;
  progressLabel: string;
  items: { id: string; label: string; done: boolean }[];
}) {
  const doneCount = props.items.filter(i => i.done).length;
  const ratio = props.items.length ? doneCount / props.items.length : 0;

  return (
    <View style={[apStyles.formCard, { marginBottom: 14 }]}>
      <Text style={apStyles.sectionTitle}>{props.title}</Text>
      <View style={{ height: 6, backgroundColor: AccueilProColors.surfaceMuted, borderRadius: 3, marginBottom: 10, overflow: 'hidden' }}>
        <View style={{ height: '100%', width: `${Math.round(ratio * 100)}%`, backgroundColor: AccueilProColors.gold, borderRadius: 3 }} />
      </View>
      <Text style={{ color: AccueilProColors.textMuted, marginBottom: 12, fontSize: 14 }}>{props.progressLabel}</Text>
      {props.items.map(item => (
        <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10, minHeight: 36 }}>
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: item.done ? 'rgba(46,125,90,0.15)' : AccueilProColors.surfaceMuted,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: item.done ? AccueilProColors.statusConfirme : AccueilProColors.textMuted }}>
              {item.done ? '✓' : ''}
            </Text>
          </View>
          <Text style={{ flex: 1, fontSize: 15, color: item.done ? AccueilProColors.statusConfirme : AccueilProColors.textSecondary }}>
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function AccueilProTodayBanner(props: { count: number; title: string; subtitle: string; onPress?: () => void }) {
  if (props.count <= 0) return null;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.9}
      onPress={props.onPress}
      disabled={!props.onPress}
      style={{
        backgroundColor: AccueilProColors.navy,
        borderRadius: AccueilProColors.radiusLg,
        padding: 16,
        marginBottom: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        ...apElevation,
      }}
    >
      <Text style={{ fontSize: 28 }}>📅</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: AccueilProColors.gold, fontWeight: '800', fontSize: 13, letterSpacing: 0.5 }}>{props.title}</Text>
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 17, marginTop: 4, lineHeight: 22 }}>{props.subtitle}</Text>
      </View>
      {props.onPress ? <Text style={[apStyles.rowChevron, { color: 'rgba(255,255,255,0.6)' }]}>›</Text> : null}
    </TouchableOpacity>
  );
}

/** Rangée tactile type liste (titres événements, espaces, personnel…). */
export function AccueilProListRow(props: {
  title: string;
  meta?: string;
  subtitle?: string;
  onPress?: () => void;
  rightAccessory?: React.ReactNode;
  showChevron?: boolean;
  /** Mise en avant équipe permanente du lieu (annuaire / menu Équipe). */
  variant?: 'default' | 'permanentStaff';
  /** Bandeau latéral (ex. couleur événement). */
  accentColor?: string;
}) {
  const showChevron = props.showChevron ?? !!props.onPress;
  const isPermanent = props.variant === 'permanentStaff';
  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.85}
      onPress={props.onPress}
      style={[
        apStyles.row,
        isPermanent ?
          {
            backgroundColor: '#FBF6EA',
            borderLeftWidth: 4,
            borderLeftColor: AccueilProColors.gold,
            paddingLeft: 12,
          }
        : props.accentColor ?
          {
            borderLeftWidth: 4,
            borderLeftColor: props.accentColor,
            paddingLeft: 12,
          }
        : null,
      ]}
      disabled={!props.onPress}
    >
      <View style={{ flex: 1 }}>
        <Text style={[apStyles.rowTitle, isPermanent ? { color: AccueilProColors.navy } : null]}>{props.title}</Text>
        {props.meta ? <Text style={apStyles.rowMeta}>{props.meta}</Text> : null}
        {props.subtitle ? <Text style={[apStyles.rowMeta, { marginTop: 4 }]}>{props.subtitle}</Text> : null}
      </View>
      {props.rightAccessory ?? null}
      {showChevron && props.onPress ? <Text style={apStyles.rowChevron}>›</Text> : null}
    </TouchableOpacity>
  );
}

export function AccueilProLoading(props: { message: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
      <ActivityIndicator color={AccueilProColors.gold} />
      <Text style={{ ...apStyles.empty, flex: undefined }}>{props.message}</Text>
    </View>
  );
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  confirmé: { bg: 'rgba(46,125,90,0.14)', text: AccueilProColors.statusConfirme },
  brouillon: { bg: 'rgba(200,151,58,0.18)', text: AccueilProColors.statusBrouillon },
  annulé: { bg: 'rgba(181,74,69,0.14)', text: AccueilProColors.statusAnnule },
  'en cours': { bg: 'rgba(64,104,224,0.14)', text: AccueilProColors.statusEnCours },
  terminé: { bg: 'rgba(90,103,120,0.14)', text: AccueilProColors.statusTermine },
  signé: { bg: 'rgba(26,39,68,0.1)', text: AccueilProColors.statusSigné },
};

export function AccueilProStatusBadge(props: { status: string }) {
  const c = STATUS_COLORS[props.status] ?? STATUS_COLORS.brouillon;
  const label = props.status.charAt(0).toUpperCase() + props.status.slice(1);
  return (
    <View style={{ backgroundColor: c.bg, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 }}>
      <Text style={{ color: c.text, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

const TYPE_COLORS: Record<string, string> = {
  Spectacle: AccueilProColors.eventSpectacle,
  Concert: AccueilProColors.eventConcert,
  Réunion: AccueilProColors.eventRéunion,
  Formation: AccueilProColors.eventFormation,
  Conférence: AccueilProColors.eventConférence,
  Séminaire: AccueilProColors.eventSéminaire,
  Mariage: AccueilProColors.eventMariage,
};

export function AccueilProTypeBadge(props: { type?: string | null }) {
  const t = props.type?.trim() || 'Autre';
  const col = TYPE_COLORS[t] ?? AccueilProColors.eventAutre;
  return (
    <View style={{ backgroundColor: col + '18', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 }}>
      <Text style={{ color: col, fontSize: 12, fontWeight: '700' }}>{t}</Text>
    </View>
  );
}

export function AccueilProStatTile(props: {
  icon: string;
  value: number | string;
  label: string;
  color: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.88}
      onPress={props.onPress}
      disabled={!props.onPress}
      style={{
        flex: 1,
        minWidth: '46%',
        backgroundColor: AccueilProColors.card,
        borderRadius: AccueilProColors.radiusLg,
        padding: 16,
        minHeight: 108,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: AccueilProColors.borderSubtle,
        ...apElevation,
      }}
    >
      <Text style={{ fontSize: 26, marginBottom: 8 }}>{props.icon}</Text>
      <Text style={{ fontSize: 30, fontWeight: '800', color: props.color, lineHeight: 32 }}>{props.value}</Text>
      <Text style={{ marginTop: 4, fontSize: 13, color: AccueilProColors.textMuted, fontWeight: '600' }}>{props.label}</Text>
    </TouchableOpacity>
  );
}

export function AccueilProSectionCard(
  props: PropsWithChildren<{ title: string; actionLabel?: string; onAction?: () => void; style?: ViewStyle }>
) {
  return (
    <View
      style={{
        backgroundColor: AccueilProColors.card,
        borderRadius: AccueilProColors.radiusLg,
        padding: 16,
        marginBottom: 14,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: AccueilProColors.borderSubtle,
        ...apElevation,
        ...props.style,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text style={{ fontSize: 17, fontWeight: '700', color: AccueilProColors.navy }}>{props.title}</Text>
        {props.actionLabel && props.onAction ?
          <TouchableOpacity onPress={props.onAction} hitSlop={8} style={{ minHeight: 36, justifyContent: 'center' }}>
            <Text style={{ color: AccueilProColors.gold, fontWeight: '700', fontSize: 13 }}>{props.actionLabel}</Text>
          </TouchableOpacity>
        : null}
      </View>
      {props.children}
    </View>
  );
}

export function AccueilProQuickAction(props: { label: string; color: string; icon?: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={props.onPress}
      activeOpacity={0.88}
      style={{
        backgroundColor: props.color + '12',
        borderColor: props.color + '30',
        borderWidth: 1.5,
        borderRadius: AccueilProColors.radiusMd,
        paddingVertical: 14,
        paddingHorizontal: 16,
        marginBottom: 8,
        minHeight: AccueilProColors.touchMin,
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontWeight: '700', color: props.color, fontSize: 15 }}>
        {props.icon ? `${props.icon}  ` : ''}{props.label}
      </Text>
    </TouchableOpacity>
  );
}

export function AccueilProQuickActionsRow(props: {
  actions: { label: string; color: string; icon?: string; onPress: () => void }[];
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 10, paddingVertical: 4, paddingRight: 4 }}
    >
      {props.actions.map((a, i) => (
        <TouchableOpacity
          key={i}
          onPress={a.onPress}
          activeOpacity={0.88}
          style={{
            minWidth: 148,
            minHeight: AccueilProColors.touchMin,
            backgroundColor: a.color + '12',
            borderColor: a.color + '30',
            borderWidth: 1.5,
            borderRadius: AccueilProColors.radiusMd,
            paddingVertical: 12,
            paddingHorizontal: 14,
            justifyContent: 'center',
          }}
        >
          {a.icon ? <Text style={{ fontSize: 20, marginBottom: 4 }}>{a.icon}</Text> : null}
          <Text style={{ fontWeight: '700', color: a.color, fontSize: 14 }}>{a.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

export function AccueilProNavTile(props: { icon: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity accessibilityRole="button" activeOpacity={0.88} onPress={props.onPress} style={apStyles.navTile}>
      <Text style={apStyles.navTileIcon}>{props.icon}</Text>
      <Text style={apStyles.navTileLabel}>{props.label}</Text>
    </TouchableOpacity>
  );
}

export function AccueilProNavGrid(props: {
  items: { key: string; icon: string; label: string; onPress: () => void }[];
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' }}>
      {props.items.map(item => (
        <AccueilProNavTile key={item.key} icon={item.icon} label={item.label} onPress={item.onPress} />
      ))}
    </View>
  );
}

/** DateField avec libellés Accueil Pro renforcés (taille, gras, contraste). */
export function AccueilProFormDateField(props: React.ComponentProps<typeof BaseDateField>) {
  return <BaseDateField {...props} labelStyle={apStyles.label} />;
}

/** SelectPicker avec libellés Accueil Pro renforcés. */
export function AccueilProFormSelectPicker(props: React.ComponentProps<typeof BaseSelectPicker>) {
  return <BaseSelectPicker {...props} labelStyle={apStyles.label} />;
}

function parseAccueilProTime(value: string): Date {
  const t = value.trim();
  if (/^\d{1,2}:\d{2}$/.test(t)) {
    try {
      return parse(t, 'HH:mm', new Date());
    } catch {
      /* fall through */
    }
  }
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  return d;
}

/** Sélecteur d’heure (format HH:mm). */
export function AccueilProFormTimeField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const { label, value, onChange, required } = props;
  const [androidOpen, setAndroidOpen] = useState(false);
  const [iosOpen, setIosOpen] = useState(false);
  const [iosDraft, setIosDraft] = useState(() => parseAccueilProTime(value));

  const display = value.trim() || '—';

  const open = () => {
    setIosDraft(parseAccueilProTime(value));
    if (Platform.OS === 'android') setAndroidOpen(true);
    else setIosOpen(true);
  };

  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={apStyles.label}>
        {label}
        {required ? <Text style={{ color: AccueilProColors.gold }}> *</Text> : null}
      </Text>
      <TouchableOpacity
        accessibilityRole="button"
        style={[apStyles.apInput, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
        onPress={open}
        activeOpacity={0.85}
      >
        <Text style={{ color: value.trim() ? AccueilProColors.textPrimary : AccueilProColors.textMuted, fontSize: 15 }}>
          {display}
        </Text>
        <Text style={{ fontSize: 18 }}>🕐</Text>
      </TouchableOpacity>

      {Platform.OS === 'android' && androidOpen ?
        <DateTimePicker
          value={parseAccueilProTime(value)}
          mode="time"
          is24Hour
          display="default"
          onChange={(event, date) => {
            setAndroidOpen(false);
            if (event.type === 'dismissed' || !date) return;
            onChange(format(date, 'HH:mm'));
          }}
        />
      : null}

      {Platform.OS === 'ios' ?
        <Modal visible={iosOpen} transparent animationType="slide" onRequestClose={() => setIosOpen(false)}>
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}
            activeOpacity={1}
            onPress={() => setIosOpen(false)}
          >
            <TouchableOpacity activeOpacity={1} onPress={e => e.stopPropagation()}>
              <View
                style={{
                  backgroundColor: AccueilProColors.card,
                  borderTopLeftRadius: 16,
                  borderTopRightRadius: 16,
                  paddingBottom: 20,
                }}
              >
                <DateTimePicker
                  value={iosDraft}
                  mode="time"
                  is24Hour
                  display="spinner"
                  onChange={(_, date) => {
                    if (date) setIosDraft(date);
                  }}
                />
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, paddingHorizontal: 16 }}>
                  <TouchableOpacity onPress={() => setIosOpen(false)}>
                    <Text style={{ color: AccueilProColors.textMuted, fontWeight: '600' }}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      onChange(format(iosDraft, 'HH:mm'));
                      setIosOpen(false);
                    }}
                  >
                    <Text style={{ color: AccueilProColors.navy, fontWeight: '800' }}>OK</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      : null}
    </View>
  );
}

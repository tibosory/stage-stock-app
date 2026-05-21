// src/components/UI.tsx
import React, { ReactNode } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal,
  ScrollView, StyleSheet, ActivityIndicator, ViewStyle, type StyleProp, type TextStyle,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, parseISO, isValid } from 'date-fns';
import { Colors, Shadow } from '../theme/colors';
import { HitSlop, Radius, Spacing } from '../theme/spacing';
import { Typography } from '../theme/typography';
import { EtatMateriel, StatutMateriel, StatutPret } from '../types';
import { getDateFnsLocale, getDatePickerLocaleTag } from '../i18n/dateLocales';
import { getRuntimeLanguage, tRuntime } from '../i18n/runtime';

/**
 * Même logique que DockTabBar : sur Android (souvent 3 boutons), `insets.bottom` peut être 0
 * alors que la zone système existe — les modales plein écran doivent quand même dégager le bas.
 */
const ANDROID_BOTTOM_INSET_MIN_DP = 64;

function useModalBottomInset(): number {
  const insets = useSafeAreaInsets();
  return Platform.OS === 'android'
    ? Math.max(insets.bottom, ANDROID_BOTTOM_INSET_MIN_DP)
    : Math.max(insets.bottom, 12);
}

// ── Badge état ──────────────────────────────────────────────────────
const etatColors: Record<string, string> = {
  bon: Colors.etatBon,
  moyen: Colors.etatMoyen,
  usé: Colors.etatUse,
  'hors service': Colors.etatHorsService,
};

export const EtatBadge = ({ etat }: { etat: EtatMateriel }) => (
  <View style={[badge.base, { backgroundColor: etatColors[etat] ?? Colors.textMuted }]}>
    <Text style={badge.text}>
      {etat === 'bon'
        ? tRuntime('status.condition.good')
        : etat === 'moyen'
          ? tRuntime('status.condition.medium')
          : etat === 'usé'
            ? tRuntime('status.condition.worn')
            : etat === 'hors service'
              ? tRuntime('status.condition.out_of_service')
              : `${String(etat).charAt(0).toUpperCase()}${String(etat).slice(1)}`}
    </Text>
  </View>
);

const statutBg: Record<string, string> = {
  'en stock': Colors.statutEnStock,
  'en prêt': Colors.statutEnPret,
  'en réparation': Colors.yellow,
  perdu: Colors.red,
  'en tournée': Colors.blue,
};

export const StatutBadge = ({ statut }: { statut: StatutMateriel }) => (
  <View style={[badge.base, { backgroundColor: statutBg[statut] ?? Colors.textMuted }]}>
    <Text style={badge.text}>
      {statut === 'en stock'
        ? tRuntime('status.material.in_stock')
        : statut === 'en prêt'
          ? tRuntime('status.material.on_loan')
          : statut === 'en tournée'
            ? tRuntime('status.material.on_tour')
            : statut === 'en réparation'
              ? tRuntime('status.material.in_repair')
              : statut === 'perdu'
                ? tRuntime('status.material.lost')
                : `${String(statut).charAt(0).toUpperCase()}${String(statut).slice(1)}`}
    </Text>
  </View>
);

const pretColors: Record<string, string> = {
  'en demande': Colors.yellow,
  'en cours': Colors.blue,
  retourné: Colors.green,
  'en retard': Colors.red,
  annulé: Colors.textMuted,
};

export const PretStatutBadge = ({ statut }: { statut: StatutPret }) => (
  <View style={[badge.base, { backgroundColor: pretColors[statut] ?? Colors.textMuted }]}>
    <Text style={badge.text}>
      {statut === 'en demande'
        ? tRuntime('status.loan.pending')
        : statut === 'en cours'
          ? tRuntime('status.loan.active')
          : statut === 'retourné'
            ? tRuntime('status.loan.returned')
            : statut === 'en retard'
              ? tRuntime('status.loan.late')
              : statut === 'annulé'
                ? tRuntime('status.loan.cancelled')
                : `${String(statut).charAt(0).toUpperCase()}${String(statut).slice(1)}`}
    </Text>
  </View>
);

export const StockBadge = ({ actuel, seuil, unite }: { actuel: number; seuil: number; unite: string }) => {
  const low = actuel <= seuil;
  return (
    <View style={[badge.base, { backgroundColor: low ? Colors.red : Colors.bgCardAlt }]}>
      <Text style={[badge.text, { fontSize: 12 }]}>{actuel} {unite}</Text>
    </View>
  );
};

const badge = StyleSheet.create({
  base: {
    borderRadius: 100,
    paddingHorizontal: 11,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  text: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});

type SafeAreaEdges = ('top' | 'right' | 'bottom' | 'left')[];

/** Écrans dans les bottom tabs : évite le double padding bas (barre d’onglets gère la zone). */
export function TabScreenSafeArea({
  children,
  style,
  edges,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Par défaut : haut + côtés (pas le bas). */
  edges?: SafeAreaEdges;
}) {
  return (
    <SafeAreaView style={style} edges={edges ?? ['top', 'left', 'right']}>
      {children}
    </SafeAreaView>
  );
}

/** Login / écrans plein écran sans barre d’onglets. */
export function FullScreenSafeArea({
  children,
  style,
  edges,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  edges?: SafeAreaEdges;
}) {
  return (
    <SafeAreaView style={style} edges={edges ?? ['top', 'right', 'bottom', 'left']}>
      {children}
    </SafeAreaView>
  );
}

// ── Card ────────────────────────────────────────────────────────────
export const Card = ({ children, style, onPress }: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) => {
  if (onPress) {
    return (
      <TouchableOpacity style={[card.base, style]} onPress={onPress} activeOpacity={0.8}>
        {children}
      </TouchableOpacity>
    );
  }
  return <View style={[card.base, style]}>{children}</View>;
};

const card = StyleSheet.create({
  base: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.card,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    ...Shadow.card,
  },
});

// ── Input ───────────────────────────────────────────────────────────
interface InputProps {
  label?: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: any;
  multiline?: boolean;
  style?: ViewStyle;
  required?: boolean;
  suffix?: ReactNode;
  secureTextEntry?: boolean;
  onSubmitEditing?: () => void;
  onBlur?: () => void;
  returnKeyType?: 'done' | 'go' | 'next' | 'search' | 'send' | 'default';
  blurOnSubmit?: boolean;
  /** false = lecture seule (TextInput non éditable) */
  editable?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  labelStyle?: TextStyle;
}

export const Input = ({
  label, value, onChangeText, placeholder, keyboardType, multiline, style, required, suffix,
  secureTextEntry, onSubmitEditing, onBlur, returnKeyType, blurOnSubmit,
  editable = true,
  autoCapitalize,
  labelStyle,
}: InputProps) => {
  const a11yLabel =
    label != null && label !== ''
      ? `${label}${required ? ', obligatoire' : ''}`
      : placeholder;
  return (
    <View style={[input.wrap, style]}>
      {label && (
        <Text style={[input.label, labelStyle]}>
          {label}{required && <Text style={{ color: Colors.green }}> *</Text>}
        </Text>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <TextInput
          style={[
            input.field,
            { flex: 1 },
            !multiline && input.fieldSingleLine,
            multiline && { height: 80, textAlignVertical: 'top' },
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          keyboardType={keyboardType}
          multiline={multiline}
          secureTextEntry={secureTextEntry}
          onSubmitEditing={onSubmitEditing}
          onBlur={onBlur}
          returnKeyType={returnKeyType}
          blurOnSubmit={blurOnSubmit}
          editable={editable}
          autoCapitalize={autoCapitalize}
          accessibilityLabel={a11yLabel}
        />
        {suffix}
      </View>
    </View>
  );
};

const input = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: { ...Typography.label, marginBottom: 8 },
  field: {
    backgroundColor: Colors.bgInput,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    color: Colors.textPrimary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    lineHeight: 20,
  },
  fieldSingleLine: {
    minHeight: Spacing.touchMin,
    paddingVertical: 13,
  },
});

function parseDateString(value: string): Date {
  if (!value?.trim()) return new Date();
  const d = value.includes('T') ? parseISO(value) : parseISO(`${value.trim()}T12:00:00`);
  return isValid(d) ? d : new Date();
}

/** Saisie de date au format AAAA-MM-JJ via le calendrier natif (Android / iOS). */
export const DateField = ({
  label,
  value,
  onChange,
  required,
  minimumDate,
  maximumDate,
  allowClear,
  style,
  disabled,
  labelStyle,
}: {
  label: string;
  value: string;
  onChange: (yyyyMmDd: string) => void;
  required?: boolean;
  minimumDate?: Date;
  maximumDate?: Date;
  allowClear?: boolean;
  style?: StyleProp<ViewStyle>;
  /** true = affichage date sans ouverture du calendrier */
  disabled?: boolean;
  labelStyle?: TextStyle;
}) => {
  const [androidOpen, setAndroidOpen] = React.useState(false);
  const [iosOpen, setIosOpen] = React.useState(false);
  const [iosDraft, setIosDraft] = React.useState<Date>(() => parseDateString(value));
  const modalBottomInset = useModalBottomInset();

  React.useEffect(() => {
    if (iosOpen) setIosDraft(parseDateString(value));
  }, [iosOpen, value]);

  const lng = getRuntimeLanguage();
  const dfLocale = getDateFnsLocale(lng);

  const display =
    value?.trim() && isValid(parseDateString(value))
      ? format(parseDateString(value), 'd MMMM yyyy', { locale: dfLocale })
      : disabled
        ? tRuntime('common.dash')
        : tRuntime('dateField.tapPrompt');

  const open = () => {
    if (disabled) return;
    if (Platform.OS === 'android') setAndroidOpen(true);
    else setIosOpen(true);
  };

  const fieldStyle = [
    input.field,
    { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const },
    disabled && { opacity: 0.9 },
  ];

  return (
    <View style={[input.wrap, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={[input.label, labelStyle]}>
          {label}
          {required && <Text style={{ color: Colors.green }}> *</Text>}
        </Text>
        {allowClear && !!value?.trim() && !disabled && (
          <TouchableOpacity onPress={() => onChange('')} hitSlop={HitSlop}>
            <Text style={{ color: Colors.textMuted, fontSize: 12 }}>{tRuntime('dateField.clear')}</Text>
          </TouchableOpacity>
        )}
      </View>
      {disabled ? (
        <View style={fieldStyle}>
          <Text style={{ color: value?.trim() ? Colors.white : Colors.textMuted, fontSize: 14, flex: 1 }} numberOfLines={1}>
            {display}
          </Text>
        </View>
      ) : (
        <TouchableOpacity style={fieldStyle} onPress={open} activeOpacity={0.75}>
          <Text style={{ color: value?.trim() ? Colors.white : Colors.textMuted, fontSize: 14, flex: 1 }} numberOfLines={1}>
            {display}
          </Text>
          <Text style={{ fontSize: 18, marginLeft: 8 }}>📅</Text>
        </TouchableOpacity>
      )}

      {Platform.OS === 'android' && androidOpen && (
        <DateTimePicker
          value={parseDateString(value)}
          mode="date"
          display="default"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={(event, date) => {
            setAndroidOpen(false);
            if (event.type === 'dismissed') return;
            if (date) onChange(format(date, 'yyyy-MM-dd'));
          }}
        />
      )}

      {Platform.OS === 'ios' && (
        <Modal visible={iosOpen} transparent animationType="slide" onRequestClose={() => setIosOpen(false)}>
          <TouchableOpacity
            style={df.overlay}
            activeOpacity={1}
            onPress={() => setIosOpen(false)}
          >
            <TouchableOpacity activeOpacity={1} onPress={e => e.stopPropagation()}>
              <View style={[df.sheet, { paddingBottom: 16 + modalBottomInset }]}>
                <DateTimePicker
                  value={iosDraft}
                  mode="date"
                  display="spinner"
                  locale={getDatePickerLocaleTag(lng)}
                  minimumDate={minimumDate}
                  maximumDate={maximumDate}
                  onChange={(_, date) => {
                    if (date) setIosDraft(date);
                  }}
                  themeVariant="dark"
                />
                <View style={df.iosBtns}>
                  <TouchableOpacity style={df.iosBtnGhost} onPress={() => setIosOpen(false)}>
                    <Text style={{ color: Colors.textSecondary, fontWeight: '600' }}>
                      {tRuntime('common.cancel')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={df.iosBtnOk}
                    onPress={() => {
                      onChange(format(iosDraft, 'yyyy-MM-dd'));
                      setIosOpen(false);
                    }}
                  >
                    <Text style={{ color: Colors.white, fontWeight: '700' }}>{tRuntime('common.ok')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
};

const df = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.bgElevated,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
  iosBtns: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  iosBtnGhost: { paddingVertical: 12, paddingHorizontal: 16 },
  iosBtnOk: {
    backgroundColor: Colors.green,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    ...Shadow.card,
  },
});

// ── Select ──────────────────────────────────────────────────────────
export const SelectPicker = ({
  label, value, options, onChange, required, disabled, labelStyle
}: {
  label?: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
  required?: boolean;
  disabled?: boolean;
  labelStyle?: TextStyle;
}) => {
  const [open, setOpen] = React.useState(false);
  const selected = options.find(o => o.value === value);
  const modalBottomInset = useModalBottomInset();

  return (
    <View style={{ marginBottom: 12 }}>
      {label && (
        <Text style={[input.label, labelStyle]}>
          {label}{required && <Text style={{ color: Colors.green }}> *</Text>}
        </Text>
      )}
      <TouchableOpacity
        style={[
          input.field,
          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
          disabled && { opacity: 0.85 },
        ]}
        onPress={() => { if (!disabled) setOpen(true); }}
        disabled={disabled}
      >
        <Text style={{ color: selected ? Colors.white : Colors.textMuted, fontSize: 14 }}>
          {selected?.label ?? tRuntime('common.choose')}
        </Text>
        {!disabled && <Text style={{ color: Colors.textMuted }}>▾</Text>}
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade">
        <View style={sel.overlay}>
          <TouchableOpacity style={sel.overlayDim} activeOpacity={1} onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel={tRuntime('common.closeList')} />
          <View style={[sel.sheet, { paddingBottom: 20 + modalBottomInset }]}>
          <Text style={sel.title}>{label ?? tRuntime('common.choose')}</Text>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={sel.scrollContent}>
              {options.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[sel.option, opt.value === value && sel.optionActive]}
                  onPress={() => { onChange(opt.value); setOpen(false); }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: opt.value === value }}
                >
                  <Text style={{ color: opt.value === value ? Colors.green : Colors.white, fontSize: 15 }}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const sel = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  },
  overlayDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: Colors.bgElevated,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 20,
    paddingHorizontal: 20,
    maxHeight: '60%',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  title: {
    ...Typography.sectionTitle,
    marginBottom: 12,
  },
  option: {
    minHeight: Spacing.touchMin,
    paddingVertical: 14,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  optionActive: {
    backgroundColor: Colors.greenBg, borderRadius: 8, paddingHorizontal: 8,
  },
});

// ── BottomSheet Modal ────────────────────────────────────────────────
export const BottomModal = ({
  visible, onClose, title, children
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) => {
  const modalBottomInset = useModalBottomInset();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={bm.overlay}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} accessibilityRole="button" accessibilityLabel={tRuntime('common.close')} />
        <View style={[bm.sheet, { paddingBottom: 22 + modalBottomInset }]}>
          <View style={bm.header}>
            <Text style={bm.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={HitSlop} accessibilityRole="button" accessibilityLabel={tRuntime('common.closeWindow')}>
              <Text style={{ color: Colors.textMuted, fontSize: 20 }}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            contentContainerStyle={bm.scrollContent}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const bm = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.bgElevated,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 22,
    paddingHorizontal: 22,
    maxHeight: '92%',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  scrollContent: {
    paddingBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  title: {
    ...Typography.sectionTitle,
    fontSize: 18,
  },
});

// ── Boutons ─────────────────────────────────────────────────────────
export const BtnPrimary = ({
  label, onPress, loading, style
}: {
  label: string; onPress: () => void; loading?: boolean; style?: ViewStyle;
}) => (
  <TouchableOpacity
    style={[btn.primary, style]}
    onPress={onPress}
    disabled={loading}
    activeOpacity={0.8}
  >
    {loading
      ? <ActivityIndicator color="#fff" />
      : <Text style={btn.primaryText}>{label}</Text>
    }
  </TouchableOpacity>
);

export const BtnSecondary = ({ label, onPress }: { label: string; onPress: () => void }) => (
  <TouchableOpacity style={btn.secondary} onPress={onPress} activeOpacity={0.8}>
    <Text style={btn.secondaryText}>{label}</Text>
  </TouchableOpacity>
);

export const BtnIcon = ({
  onPress, children, color, bg, accessibilityLabel
}: {
  onPress: () => void; children: ReactNode; color?: string; bg?: string;
  accessibilityLabel?: string;
}) => (
  <TouchableOpacity
    onPress={onPress}
    hitSlop={HitSlop}
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel}
    style={{
      minWidth: Spacing.touchMin,
      minHeight: Spacing.touchMin,
      padding: 8,
      borderRadius: Radius.sm,
      backgroundColor: bg ?? 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
    }}
    activeOpacity={0.7}
  >
    {children}
  </TouchableOpacity>
);

const btn = StyleSheet.create({
  primary: {
    backgroundColor: Colors.green,
    borderWidth: 0,
    borderRadius: 14,
    paddingVertical: 16,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginLeft: 8,
    ...Shadow.card,
  },
  primaryText: { color: Colors.white, ...Typography.button, fontWeight: '700' },
  secondary: {
    backgroundColor: 'transparent',
    borderRadius: 14,
    paddingVertical: 16,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginRight: 8,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
  },
  secondaryText: { color: Colors.textPrimary, ...Typography.button },
});

// ── Row boutons formulaire ───────────────────────────────────────────
export const FormButtons = ({
  onCancel, onSave, loading
}: {
  onCancel: () => void; onSave: () => void; loading?: boolean;
}) => (
  <View style={{ flexDirection: 'row', marginTop: 16, marginBottom: 8 }}>
    <BtnSecondary label={tRuntime('common.cancel')} onPress={onCancel} />
    <BtnPrimary label={tRuntime('common.save')} onPress={onSave} loading={loading} />
  </View>
);

// ── Screen header ────────────────────────────────────────────────────
export const ScreenHeader = ({
  icon,
  title,
  subtitle,
  rightLabel,
  onRightPress,
  titleAccessibilityLabel,
  rightAccessibilityLabel,
  rightAccessibilityHint,
}: {
  icon: ReactNode;
  title: string;
  /** Texte d’aide sous le titre (pleine largeur). */
  subtitle?: string;
  rightLabel?: string;
  onRightPress?: () => void;
  /** Par défaut = title (VoiceOver / TalkBack). */
  titleAccessibilityLabel?: string;
  /** Par défaut = « Ajouter » + rightLabel. */
  rightAccessibilityLabel?: string;
  rightAccessibilityHint?: string;
}) => (
  <View style={sh.wrap}>
    <View style={sh.row}>
      <View style={sh.left}>
        <View style={sh.iconTitleRow}>
          {icon}
          <Text
            style={sh.title}
            numberOfLines={2}
            accessibilityRole="header"
            accessibilityLabel={titleAccessibilityLabel ?? title}
          >
            {title}
          </Text>
        </View>
      </View>
      {rightLabel ? (
        <TouchableOpacity
          style={sh.btn}
          onPress={onRightPress}
          hitSlop={HitSlop}
          accessibilityRole="button"
          accessibilityLabel={rightAccessibilityLabel ?? `${tRuntime('common.add')} ${rightLabel}`}
          accessibilityHint={rightAccessibilityHint ?? 'Ouvre le formulaire pour créer un nouvel élément'}
        >
          <Text style={sh.btnText}>＋ {rightLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
    {subtitle ? (
      <Text style={sh.subtitle} accessibilityRole="text">
        {subtitle}
      </Text>
    ) : null}
  </View>
);

const sh = StyleSheet.create({
  wrap: {
    marginBottom: 18,
    paddingHorizontal: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  left: {
    flex: 1,
    minWidth: 0,
  },
  iconTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    ...Typography.screenTitle,
    flex: 1,
    flexShrink: 1,
  },
  subtitle: {
    ...Typography.screenIntro,
    marginTop: Spacing.sm,
  },
  btn: {
    backgroundColor: Colors.greenMuted,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  btnText: { color: Colors.green, fontWeight: '600', fontSize: 14, letterSpacing: 0.1 },
});

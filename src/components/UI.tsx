// src/components/UI.tsx
import React, { ReactNode } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal,
  ScrollView, StyleSheet, ActivityIndicator, ViewStyle, type StyleProp,
} from 'react-native';
import { Colors } from '../theme/colors';
import { EtatMateriel, StatutMateriel, StatutPret } from '../types';

// ── Badge état ──────────────────────────────────────────────────────
const etatColors: Record<string, string> = {
  bon: Colors.etatBon,
  moyen: Colors.etatMoyen,
  usé: Colors.etatUse,
  'hors service': Colors.etatHorsService,
};

export const EtatBadge = ({ etat }: { etat: EtatMateriel }) => (
  <View style={[badge.base, { backgroundColor: etatColors[etat] ?? Colors.textMuted }]}>
    <Text style={badge.text}>{etat.charAt(0).toUpperCase() + etat.slice(1)}</Text>
  </View>
);

const statutBg: Record<string, string> = {
  'en stock': Colors.statutEnStock,
  'en prêt': Colors.statutEnPret,
  'en réparation': Colors.yellow,
  perdu: Colors.red,
};

export const StatutBadge = ({ statut }: { statut: StatutMateriel }) => (
  <View style={[badge.base, { backgroundColor: statutBg[statut] ?? Colors.textMuted }]}>
    <Text style={badge.text}>
      {statut.charAt(0).toUpperCase() + statut.slice(1)}
    </Text>
  </View>
);

const pretColors: Record<string, string> = {
  'en cours': Colors.blue,
  retourné: Colors.green,
  'en retard': Colors.red,
  annulé: Colors.textMuted,
};

export const PretStatutBadge = ({ statut }: { statut: StatutPret }) => (
  <View style={[badge.base, { backgroundColor: pretColors[statut] ?? Colors.textMuted }]}>
    <Text style={badge.text}>{statut.charAt(0).toUpperCase() + statut.slice(1)}</Text>
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
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  text: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
});

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
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
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
}

export const Input = ({
  label, value, onChangeText, placeholder, keyboardType, multiline, style, required, suffix,
  secureTextEntry,
}: InputProps) => (
  <View style={[input.wrap, style]}>
    {label && (
      <Text style={input.label}>
        {label}{required && <Text style={{ color: Colors.green }}> *</Text>}
      </Text>
    )}
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <TextInput
        style={[input.field, { flex: 1 }, multiline && { height: 80, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        keyboardType={keyboardType}
        multiline={multiline}
        secureTextEntry={secureTextEntry}
      />
      {suffix}
    </View>
  </View>
);

const input = StyleSheet.create({
  wrap: { marginBottom: 12 },
  label: { color: Colors.textPrimary, fontSize: 13, fontWeight: '500', marginBottom: 6 },
  field: {
    backgroundColor: Colors.bgInput,
    borderWidth: 1,
    borderColor: Colors.bgInputBorder,
    borderRadius: 10,
    color: Colors.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
});

// ── Select ──────────────────────────────────────────────────────────
export const SelectPicker = ({
  label, value, options, onChange, required
}: {
  label?: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
  required?: boolean;
}) => {
  const [open, setOpen] = React.useState(false);
  const selected = options.find(o => o.value === value);

  return (
    <View style={{ marginBottom: 12 }}>
      {label && (
        <Text style={input.label}>
          {label}{required && <Text style={{ color: Colors.green }}> *</Text>}
        </Text>
      )}
      <TouchableOpacity
        style={[input.field, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
        onPress={() => setOpen(true)}
      >
        <Text style={{ color: selected ? Colors.white : Colors.textMuted, fontSize: 14 }}>
          {selected?.label ?? 'Choisir...'}
        </Text>
        <Text style={{ color: Colors.textMuted }}>▾</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade">
        <TouchableOpacity style={sel.overlay} onPress={() => setOpen(false)}>
          <View style={sel.sheet}>
            <Text style={sel.title}>{label ?? 'Choisir'}</Text>
            <ScrollView>
              {options.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[sel.option, opt.value === value && sel.optionActive]}
                  onPress={() => { onChange(opt.value); setOpen(false); }}
                >
                  <Text style={{ color: opt.value === value ? Colors.green : Colors.white, fontSize: 15 }}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const sel = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.bgCard, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, maxHeight: '60%',
  },
  title: {
    color: Colors.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 12,
  },
  option: {
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border,
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
}) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={bm.overlay}>
      <TouchableOpacity style={{ flex: 1 }} onPress={onClose} />
      <View style={bm.sheet}>
        <View style={bm.header}>
          <Text style={bm.title}>{title}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={{ color: Colors.textMuted, fontSize: 20 }}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </View>
    </View>
  </Modal>
);

const bm = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    padding: 20, maxHeight: '92%',
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20,
  },
  title: {
    color: Colors.white, fontSize: 18, fontWeight: '700',
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
  onPress, children, color, bg
}: {
  onPress: () => void; children: ReactNode; color?: string; bg?: string;
}) => (
  <TouchableOpacity
    onPress={onPress}
    style={{ padding: 8, borderRadius: 8, backgroundColor: bg ?? 'transparent' }}
    activeOpacity={0.7}
  >
    {children}
  </TouchableOpacity>
);

const btn = StyleSheet.create({
  primary: {
    backgroundColor: Colors.green,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    flex: 1,
    marginLeft: 8,
  },
  primaryText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
  secondary: {
    backgroundColor: Colors.bgInput,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryText: { color: Colors.textPrimary, fontWeight: '600', fontSize: 15 },
});

// ── Row boutons formulaire ───────────────────────────────────────────
export const FormButtons = ({
  onCancel, onSave, loading
}: {
  onCancel: () => void; onSave: () => void; loading?: boolean;
}) => (
  <View style={{ flexDirection: 'row', marginTop: 16, marginBottom: 8 }}>
    <BtnSecondary label="Annuler" onPress={onCancel} />
    <BtnPrimary label="Enregistrer" onPress={onSave} loading={loading} />
  </View>
);

// ── Screen header ────────────────────────────────────────────────────
export const ScreenHeader = ({
  icon, title, rightLabel, onRightPress
}: {
  icon: ReactNode; title: string; rightLabel?: string; onRightPress?: () => void;
}) => (
  <View style={sh.row}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      {icon}
      <Text style={sh.title}>{title}</Text>
    </View>
    {rightLabel && (
      <TouchableOpacity style={sh.btn} onPress={onRightPress}>
        <Text style={sh.btnText}>＋ {rightLabel}</Text>
      </TouchableOpacity>
    )}
  </View>
);

const sh = StyleSheet.create({
  row: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  title: { color: Colors.white, fontSize: 22, fontWeight: '800' },
  btn: {
    backgroundColor: Colors.green, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  btnText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
});

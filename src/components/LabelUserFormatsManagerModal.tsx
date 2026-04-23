import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SelectPicker, TabScreenSafeArea } from './UI';
import { Colors } from '../theme/colors';
import {
  createDraftFormat,
  getFormatsByKind,
  loadUserLabelFormats,
  normalizeUserLabelFormat,
  removeUserLabelFormat,
  upsertUserLabelFormat,
  type LabelFormatKind,
  type UserLabelFormat,
} from '../lib/labelUserFormatsStorage';
import { LABEL_FONT_CHOICES, LABEL_TEXT_COLOR_CHOICES } from '../lib/labelCustomPdf';

type Props = {
  visible: boolean;
  kind: LabelFormatKind;
  onClose: () => void;
  onSaved?: () => void;
};

const FONT_OPTIONS = LABEL_FONT_CHOICES.map(f => ({ value: f.id, label: f.label }));
const COLOR_OPTIONS = LABEL_TEXT_COLOR_CHOICES.map(c => ({ value: c.id, label: c.label }));
const DEFAULT_COLOR_ID = LABEL_TEXT_COLOR_CHOICES[0].id;

function colorIdFromHex(hex: string): string {
  const hit = LABEL_TEXT_COLOR_CHOICES.find(c => c.hex.toLowerCase() === hex.toLowerCase());
  return hit?.id ?? DEFAULT_COLOR_ID;
}

function colorHexFromId(id: string): string {
  return LABEL_TEXT_COLOR_CHOICES.find(c => c.id === id)?.hex ?? LABEL_TEXT_COLOR_CHOICES[0].hex;
}

function parseMm(s: string, fallback: number): number {
  const n = parseFloat(s.replace(',', '.'));
  if (!Number.isFinite(n)) return fallback;
  return n;
}

function parseIntSafe(s: string, fallback: number, min: number, max: number): number {
  const n = parseInt(s, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export default function LabelUserFormatsManagerModal({
  visible,
  kind,
  onClose,
  onSaved,
}: Props) {
  const [list, setList] = useState<UserLabelFormat[]>([]);
  const [editing, setEditing] = useState<UserLabelFormat | null>(null);
  const [name, setName] = useState('');
  const [wStr, setWStr] = useState('100');
  const [hStr, setHStr] = useState('50');
  const [mPctStr, setMPctStr] = useState('50');
  const [fontId, setFontId] = useState('inter');
  const [textColorId, setTextColorId] = useState(DEFAULT_COLOR_ID);
  const [bold, setBold] = useState(true);

  const reload = useCallback(async () => {
    const all = await loadUserLabelFormats();
    setList(getFormatsByKind(all, kind));
  }, [kind]);

  useEffect(() => {
    if (!visible) return;
    void reload();
    setEditing(null);
  }, [visible, kind, reload]);

  const openNew = () => {
    const d = createDraftFormat(kind);
    setEditing(d);
    setName(d.name);
    setWStr(String(d.widthMm));
    setHStr(String(d.heightMm));
    setMPctStr(String(d.marginPercent));
    setFontId(d.fontId);
    setTextColorId(colorIdFromHex(d.textColor));
    setBold(d.bold);
  };

  const openEdit = (f: UserLabelFormat) => {
    setEditing(f);
    setName(f.name);
    setWStr(String(f.widthMm));
    setHStr(String(f.heightMm));
    setMPctStr(String(f.marginPercent));
    setFontId(f.fontId);
    setTextColorId(colorIdFromHex(f.textColor));
    setBold(f.bold);
  };

  const saveCurrent = async () => {
    if (!editing) return;
    const w = parseMm(wStr, editing.widthMm);
    const h = parseMm(hStr, editing.heightMm);
    const mp = parseIntSafe(mPctStr, editing.marginPercent, 0, 100);
    const next: UserLabelFormat = {
      ...editing,
      name: name.trim() || 'Sans nom',
      widthMm: w,
      heightMm: h,
      marginPercent: mp,
      fontId,
      textColor: colorHexFromId(textColorId),
      bold,
    };
    const norm = normalizeUserLabelFormat(next);
    await upsertUserLabelFormat(norm);
    onSaved?.();
    await reload();
    setEditing(null);
  };

  const del = (f: UserLabelFormat) => {
    Alert.alert('Supprimer', `Supprimer « ${f.name} » ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          await removeUserLabelFormat(f.id);
          onSaved?.();
          await reload();
          if (editing?.id === f.id) setEditing(null);
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <TabScreenSafeArea style={s.safe} edges={['top', 'bottom']}>
        <View style={s.head}>
          <Text style={s.title}>
            {kind === 'qr' ? 'Formats d’étiquette QR' : 'Formats rayonnage / bacs'}
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Text style={s.close}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={s.toolbar}>
          <TouchableOpacity style={s.addBtn} onPress={openNew}>
            <Text style={s.addBtnText}>+ Nouveau format</Text>
          </TouchableOpacity>
        </View>

        {editing ? (
          <ScrollView
            style={s.form}
            contentContainerStyle={s.formContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={s.formTitle}>
              {list.some(x => x.id === editing.id) ? 'Modifier' : 'Créer'}
            </Text>
            <Text style={s.lab}>Nom (pour le retrouver)</Text>
            <TextInput
              style={s.inp}
              value={name}
              onChangeText={setName}
              placeholder="Ex. Bac atelier"
              placeholderTextColor={Colors.textMuted}
            />
            <View style={s.row2}>
              <View style={s.half}>
                <Text style={s.lab}>Largeur (mm)</Text>
                <TextInput
                  style={s.inp}
                  value={wStr}
                  onChangeText={setWStr}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={s.half}>
                <Text style={s.lab}>Hauteur (mm)</Text>
                <TextInput
                  style={s.inp}
                  value={hStr}
                  onChangeText={setHStr}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
            <Text style={s.lab}>Marge intérieure (0–100 %)</Text>
            <Text style={s.hintSmall}>
              0 % = marge minimale ; 100 % = marge max (10 % de la largeur d’étiquette).
            </Text>
            <TextInput
              style={s.inp}
              value={mPctStr}
              onChangeText={t => setMPctStr(t.replace(/[^0-9]/g, '').slice(0, 3))}
              keyboardType="number-pad"
            />
            <SelectPicker
              label="Police"
              value={fontId}
              options={FONT_OPTIONS}
              onChange={v => setFontId(v)}
            />
            <SelectPicker
              label="Couleur du texte"
              value={textColorId}
              options={COLOR_OPTIONS}
              onChange={v => setTextColorId(v)}
            />
            <View style={s.boldRow}>
              <Text style={s.lab}>Texte en gras</Text>
              <Switch
                value={bold}
                onValueChange={setBold}
                trackColor={{ true: Colors.green, false: '#444' }}
                thumbColor={Colors.white}
              />
            </View>
            <View style={s.formActions}>
              <TouchableOpacity style={s.cancel} onPress={() => setEditing(null)}>
                <Text style={s.cancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.save} onPress={() => void saveCurrent()}>
                <Text style={s.saveText}>Enregistrer</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        ) : (
          <FlatList
            data={list}
            keyExtractor={item => item.id}
            contentContainerStyle={s.listPad}
            ListEmptyComponent={
              <Text style={s.empty}>
                Aucun format enregistré. Appuie sur « Nouveau format » : largeur, hauteur, marge,
                style du texte.
              </Text>
            }
            renderItem={({ item }) => (
              <View style={s.card}>
                <TouchableOpacity
                  onPress={() => openEdit(item)}
                  style={s.cardMain}
                  accessibilityRole="button"
                >
                  <Text style={s.cardName} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={s.cardDim}>
                    {item.widthMm}×{item.heightMm} mm — marge {item.marginPercent} %
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => del(item)}
                  style={s.trash}
                  hitSlop={8}
                  accessibilityLabel="Supprimer"
                >
                  <Text style={s.trashText}>🗑</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        )}
      </TabScreenSafeArea>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: { flex: 1, color: Colors.white, fontSize: 17, fontWeight: '800' },
  close: { color: Colors.textMuted, fontSize: 24 },
  toolbar: { padding: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  addBtn: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.green,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  addBtnText: { color: Colors.white, fontWeight: '800', fontSize: 14 },
  listPad: { padding: 12, paddingBottom: 24, flexGrow: 1 },
  empty: { color: Colors.textMuted, fontSize: 14, lineHeight: 20, marginTop: 16 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
  },
  cardMain: { flex: 1, padding: 12 },
  cardName: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  cardDim: { color: Colors.textMuted, fontSize: 12, marginTop: 4 },
  trash: { padding: 12 },
  trashText: { fontSize: 20, opacity: 0.8 },
  form: { flex: 1 },
  formContent: { padding: 16, paddingBottom: 32 },
  formTitle: { color: Colors.green, fontSize: 15, fontWeight: '800', marginBottom: 12 },
  lab: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600', marginTop: 10, marginBottom: 4 },
  hintSmall: { color: Colors.textMuted, fontSize: 11, lineHeight: 15, marginBottom: 4 },
  inp: {
    backgroundColor: Colors.bgInput,
    borderWidth: 1,
    borderColor: Colors.bgInputBorder,
    borderRadius: 10,
    color: Colors.white,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 16,
  },
  row2: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  boldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancel: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelText: { color: Colors.textSecondary, fontWeight: '800' },
  save: { flex: 1, backgroundColor: Colors.green, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  saveText: { color: Colors.white, fontWeight: '800' },
});

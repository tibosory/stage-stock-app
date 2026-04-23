import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors } from '../theme/colors';
import {
  exportShelfLabelsPdfCustom,
  buildCustomShelfLabelsHtml,
} from '../lib/labelCustomPdf';
import { buildPdfOrgHeaderHtml, getPdfBranding } from '../lib/theatreBranding';
import {
  getFormatsByKind,
  loadUserLabelFormats,
  type UserLabelFormat,
} from '../lib/labelUserFormatsStorage';
import { SelectPicker, TabScreenSafeArea } from './UI';
import LabelUserFormatsManagerModal from './LabelUserFormatsManagerModal';
import LabelHtmlPreviewModal from './LabelHtmlPreviewModal';

export type ShelfLabelItem = {
  id: string;
  title: string;
  subtitle?: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  items: ShelfLabelItem[];
};

type RowState = {
  selected: boolean;
  text: string;
  formatId: string;
};

export default function ShelfLabelsModal({
  visible,
  onClose,
  items,
  title = 'Étiquettes rayonnage',
}: Props) {
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [busy, setBusy] = useState(false);
  const [defaultFormatId, setDefaultFormatId] = useState('');
  const [shelfFormats, setShelfFormats] = useState<UserLabelFormat[]>([]);
  const [managerOpen, setManagerOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoad, setPreviewLoad] = useState(false);

  const loadFormats = useCallback(async () => {
    const all = await loadUserLabelFormats();
    const sh = getFormatsByKind(all, 'shelf');
    setShelfFormats(sh);
    setDefaultFormatId(prev => {
      if (prev && sh.some(f => f.id === prev)) return prev;
      return sh[0]?.id ?? '';
    });
    return sh;
  }, []);

  useEffect(() => {
    if (!visible) return;
    void (async () => {
      const sh = await loadFormats();
      const defId = sh[0]?.id ?? '';
      const init: Record<string, RowState> = {};
      for (const item of items) {
        init[item.id] = {
          selected: true,
          text: item.title,
          formatId: defId,
        };
      }
      setRows(init);
    })();
  }, [visible, items, loadFormats]);

  const formatOptions = useMemo(
    () =>
      shelfFormats.map(f => ({
        value: f.id,
        label: `${f.name} (${f.widthMm}×${f.heightMm} mm)`,
      })),
    [shelfFormats]
  );

  const byId = useCallback(
    (id: string): UserLabelFormat | null => shelfFormats.find(f => f.id === id) ?? null,
    [shelfFormats]
  );

  const resolveFormat = useCallback(
    (row: RowState): UserLabelFormat | null => {
      if (!defaultFormatId) return null;
      const id = row.formatId || defaultFormatId;
      return byId(id) ?? byId(defaultFormatId);
    },
    [defaultFormatId, byId]
  );

  const selectedCount = useMemo(
    () => Object.values(rows).filter(r => r.selected).length,
    [rows]
  );

  const setRow = (id: string, patch: Partial<RowState>) => {
    setRows(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const applyDefaultFormat = () => {
    if (!defaultFormatId) return;
    setRows(prev => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        if (next[key].selected) next[key] = { ...next[key], formatId: defaultFormatId };
      }
      return next;
    });
  };

  const buildPayload = useCallback(() => {
    return items
      .map(item => {
        const state = rows[item.id];
        if (!state?.selected) return null;
        const text = state.text.trim();
        if (!text) return null;
        const fmt = resolveFormat(state);
        if (!fmt) return null;
        return {
          text,
          subtitle: item.subtitle,
          format: fmt,
        };
      })
      .filter(Boolean) as { text: string; subtitle?: string; format: UserLabelFormat }[];
  }, [items, rows, resolveFormat]);

  const runPreview = async () => {
    const payload = buildPayload();
    if (!payload.length) {
      Alert.alert('Aucune étiquette', 'Sélectionne au moins une ligne avec un texte non vide et un format.');
      return;
    }
    setPreviewOpen(true);
    setPreviewLoad(true);
    setPreviewHtml(null);
    try {
      const branding = await getPdfBranding();
      const orgHeader = buildPdfOrgHeaderHtml(branding);
      const html = buildCustomShelfLabelsHtml(
        payload.map(p => ({ text: p.text, subtitle: p.subtitle, format: p.format })),
        orgHeader
      );
      setPreviewHtml(html);
    } catch (e: any) {
      Alert.alert('Aperçu', e?.message ?? 'Impossible d’afficher l’aperçu');
    } finally {
      setPreviewLoad(false);
    }
  };

  const handleGenerate = async () => {
    const payload = buildPayload();
    if (!payload.length) {
      Alert.alert('Aucune étiquette', 'Sélectionne au moins une ligne avec un texte non vide.');
      return;
    }

    setBusy(true);
    try {
      await exportShelfLabelsPdfCustom(
        payload.map(p => ({ text: p.text, subtitle: p.subtitle, format: p.format }))
      );
      setPreviewOpen(false);
      setPreviewHtml(null);
    } catch (e: any) {
      Alert.alert('PDF', e?.message ?? 'Erreur pendant la génération');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <TabScreenSafeArea style={s.safe} edges={['top', 'bottom']}>
          <View style={s.head}>
            <Text style={s.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={s.close}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={s.controls}>
            {formatOptions.length ? (
              <SelectPicker
                label="Format par défaut"
                value={defaultFormatId}
                options={formatOptions}
                onChange={v => setDefaultFormatId(v)}
              />
            ) : (
              <Text style={s.warn}>
                Aucun format enregistré. Ouvre « Gérer les formats » pour définir largeur, hauteur, marge et style.
              </Text>
            )}
            <TouchableOpacity style={s.manage} onPress={() => setManagerOpen(true)}>
              <Text style={s.manageText}>Gérer les formats rayonnage…</Text>
            </TouchableOpacity>
            <Text style={s.hint}>
              Seuls tes formats enregistrés apparaissent ici. Police, couleur, gras et marge (0–100 %) s’appliquent à chaque étiquette.
            </Text>
            <View style={s.btnRow}>
              <TouchableOpacity
                style={s.chipBtn}
                onPress={() =>
                  setRows(prev =>
                    Object.fromEntries(Object.entries(prev).map(([id, row]) => [id, { ...row, selected: true }]))
                  )
                }
              >
                <Text style={s.chipText}>Tout sélectionner</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.chipBtn}
                onPress={() =>
                  setRows(prev =>
                    Object.fromEntries(Object.entries(prev).map(([id, row]) => [id, { ...row, selected: false }]))
                  )
                }
              >
                <Text style={s.chipText}>Aucun</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.chipBtnPrimary} onPress={applyDefaultFormat}>
                <Text style={s.chipTextPrimary}>Appliquer format par défaut</Text>
              </TouchableOpacity>
            </View>
          </View>

          <FlatList
            data={items}
            keyExtractor={item => item.id}
            contentContainerStyle={{ padding: 12, paddingBottom: 20 }}
            renderItem={({ item }) => {
              const row = rows[item.id];
              if (!row) return null;
              return (
                <View style={s.row}>
                  <TouchableOpacity
                    style={[s.check, row.selected && s.checkOn]}
                    onPress={() => setRow(item.id, { selected: !row.selected })}
                  >
                    {row.selected ? <Text style={s.checkMark}>✓</Text> : null}
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowTitle}>{item.title}</Text>
                    {item.subtitle ? <Text style={s.rowSub}>{item.subtitle}</Text> : null}
                    <TextInput
                      style={s.input}
                      value={row.text}
                      onChangeText={t => setRow(item.id, { text: t })}
                      placeholder="Texte de l'étiquette"
                      placeholderTextColor={Colors.textMuted}
                    />
                    {formatOptions.length ? (
                      <SelectPicker
                        label={undefined}
                        value={row.formatId || defaultFormatId}
                        options={formatOptions}
                        onChange={v => setRow(item.id, { formatId: v })}
                      />
                    ) : null}
                  </View>
                </View>
              );
            }}
          />

          <View style={s.footer}>
            <TouchableOpacity style={s.prevBtn} onPress={() => void runPreview()}>
              <Text style={s.prevText}>Aperçu</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
              <Text style={s.cancelText}>Fermer</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.genBtn, (busy || !defaultFormatId) && { opacity: 0.65 }]}
              onPress={handleGenerate}
              disabled={busy || !defaultFormatId}
            >
              {busy ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={s.genText}>Générer PDF ({selectedCount})</Text>
              )}
            </TouchableOpacity>
          </View>
        </TabScreenSafeArea>
      </Modal>

      <LabelUserFormatsManagerModal
        visible={managerOpen}
        onClose={() => {
          setManagerOpen(false);
          void loadFormats();
        }}
        kind="shelf"
        onSaved={() => void loadFormats()}
      />

      <LabelHtmlPreviewModal
        visible={previewOpen}
        onClose={() => {
          setPreviewOpen(false);
          setPreviewHtml(null);
        }}
        title="Rayonnage"
        fullHtml={previewHtml}
        loading={previewLoad}
        onGeneratePdf={previewHtml && !previewLoad ? handleGenerate : undefined}
        generateLabel="Générer le PDF (partage)"
      />
    </>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: { color: Colors.white, fontSize: 18, fontWeight: '800', flex: 1 },
  close: { color: Colors.textMuted, fontSize: 22 },
  controls: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  warn: { color: Colors.yellow, fontSize: 13, lineHeight: 18, marginBottom: 8 },
  manage: { marginBottom: 6, paddingVertical: 4 },
  manageText: { color: Colors.green, fontSize: 14, fontWeight: '700' },
  hint: {
    color: Colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 6,
    marginBottom: 2,
  },
  btnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chipBtn: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  chipBtnPrimary: {
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.textSecondary,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  chipText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  chipTextPrimary: { color: Colors.white, fontSize: 12, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 10,
    backgroundColor: Colors.bgCard,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  checkOn: { borderColor: Colors.white, backgroundColor: Colors.bgElevated },
  checkMark: { color: Colors.white, fontWeight: '800' },
  rowTitle: { color: Colors.white, fontWeight: '700', fontSize: 14 },
  rowSub: { color: Colors.textMuted, fontSize: 11, marginTop: 2, marginBottom: 6 },
  input: {
    backgroundColor: Colors.bgInput,
    borderWidth: 1,
    borderColor: Colors.bgInputBorder,
    borderRadius: 10,
    color: Colors.white,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    padding: 12,
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  prevBtn: {
    flexBasis: '100%',
    borderWidth: 1,
    borderColor: Colors.textSecondary,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  prevText: { color: Colors.white, fontWeight: '800' },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  cancelText: { color: Colors.textSecondary, fontWeight: '700' },
  genBtn: {
    flex: 2,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.textSecondary,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    minWidth: 120,
  },
  genText: { color: Colors.white, fontWeight: '800' },
});

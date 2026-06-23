import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  SectionList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SelectPicker, TabScreenSafeArea } from './UI';
import { Colors } from '../theme/colors';
import { Consommable, Materiel } from '../types';
import {
  exportBulkQrLabelsPdfCustom,
  buildCustomBulkQrHtml,
  bulkQrItemFromConsommable,
  bulkQrItemFromMateriel,
  type BulkQrLabelEntry,
  type BulkQrPrintItem,
} from '../lib/labelCustomPdf';
import { getPdfBranding } from '../lib/theatreBranding';
import {
  getFormatsByKind,
  loadUserLabelFormats,
  type UserLabelFormat,
} from '../lib/labelUserFormatsStorage';
import type { BulkLayoutMode, BulkPaperSize } from '../lib/pdfEtiquetteBulk';
import LabelUserFormatsManagerModal from './LabelUserFormatsManagerModal';
import LabelHtmlPreviewModal from './LabelHtmlPreviewModal';

const PAPER_OPTIONS: { value: BulkPaperSize; label: string }[] = [
  { value: 'A4', label: 'A4 (210 × 297 mm)' },
  { value: 'A3', label: 'A3 (297 × 420 mm)' },
];

const LAYOUT_OPTIONS: { value: BulkLayoutMode; label: string }[] = [
  { value: 'flex', label: 'Flux (remplissage naturel)' },
  {
    value: 'grid_strict',
    label: 'Grille stricte (pages découpées, pas à cheval)',
  },
];

type Props = {
  visible: boolean;
  onClose: () => void;
  materiels: Materiel[];
  consommables?: Consommable[];
};

type ListSection = { title: string; data: BulkQrPrintItem[] };

export default function BulkQrPrintModal({
  visible,
  onClose,
  materiels,
  consommables = [],
}: Props) {
  const [paper, setPaper] = useState<BulkPaperSize>('A4');
  const [defaultFormatId, setDefaultFormatId] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [formatById, setFormatById] = useState<Partial<Record<string, string>>>({});
  const [busy, setBusy] = useState(false);
  const [layoutMode, setLayoutMode] = useState<BulkLayoutMode>('flex');
  const [qrFormats, setQrFormats] = useState<UserLabelFormat[]>([]);
  const [managerOpen, setManagerOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoad, setPreviewLoad] = useState(false);

  const printItems = useMemo(
    (): BulkQrPrintItem[] => [
      ...materiels.map(bulkQrItemFromMateriel),
      ...consommables.map(bulkQrItemFromConsommable),
    ],
    [materiels, consommables]
  );

  const sections = useMemo((): ListSection[] => {
    const out: ListSection[] = [];
    const matItems = materiels.map(bulkQrItemFromMateriel);
    const consoItems = consommables.map(bulkQrItemFromConsommable);
    if (matItems.length) out.push({ title: 'Stock (matériel)', data: matItems });
    if (consoItems.length) out.push({ title: 'Consommables', data: consoItems });
    return out;
  }, [materiels, consommables]);

  const loadFormats = useCallback(async () => {
    const all = await loadUserLabelFormats();
    const qr = getFormatsByKind(all, 'qr');
    setQrFormats(qr);
    setDefaultFormatId(prev => {
      if (prev && qr.some(f => f.id === prev)) return prev;
      return qr[0]?.id ?? '';
    });
  }, []);

  useEffect(() => {
    if (!visible) return;
    setSelectedIds(new Set());
    setFormatById({});
    setPaper('A4');
    setLayoutMode('flex');
    void loadFormats();
  }, [visible, loadFormats]);

  const formatOptions = useMemo(
    () =>
      qrFormats.map(f => ({
        value: f.id,
        label: `${f.name} (${f.widthMm}×${f.heightMm} mm)`,
      })),
    [qrFormats]
  );

  const byId = useCallback(
    (id: string): UserLabelFormat | null => {
      return qrFormats.find(f => f.id === id) ?? null;
    },
    [qrFormats]
  );

  const resolveFormat = useCallback(
    (mId: string): UserLabelFormat | null => {
      if (!defaultFormatId) return null;
      const id = formatById[mId] ?? defaultFormatId;
      return byId(id) ?? byId(defaultFormatId);
    },
    [formatById, defaultFormatId, byId]
  );

  const toggle = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(printItems.map(i => i.id)));
  }, [printItems]);

  const selectNone = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const applyDefaultToSelected = useCallback(() => {
    if (!defaultFormatId) return;
    setFormatById(prev => {
      const next = { ...prev };
      for (const id of selectedIds) {
        next[id] = defaultFormatId;
      }
      return next;
    });
  }, [selectedIds, defaultFormatId]);

  const setFormatFor = useCallback((id: string, fmt: string) => {
    setFormatById(prev => ({ ...prev, [id]: fmt }));
  }, []);

  const buildSelectedEntries = useCallback((): BulkQrLabelEntry[] => {
    const entries: BulkQrLabelEntry[] = [];
    for (const item of printItems) {
      if (!selectedIds.has(item.id)) continue;
      const f = resolveFormat(item.id);
      if (!f) continue;
      entries.push({ item, format: f });
    }
    return entries;
  }, [printItems, selectedIds, resolveFormat]);

  const runPreview = useCallback(async () => {
    if (selectedIds.size === 0) {
      Alert.alert('Sélection', 'Cochez au moins un article (stock ou consommable).');
      return;
    }
    if (!defaultFormatId || qrFormats.length === 0) {
      Alert.alert('Formats', 'Créez d’abord un format d’étiquette (QR) dans Gérer les formats.');
      return;
    }
    setPreviewOpen(true);
    setPreviewLoad(true);
    setPreviewHtml(null);
    try {
      const items = buildSelectedEntries();
      if (!items.length) throw new Error('Format manquant');
      const brand = await getPdfBranding();
      const html = buildCustomBulkQrHtml(items, paper, brand, layoutMode);
      setPreviewHtml(html);
    } catch (e: any) {
      Alert.alert('Aperçu', e?.message ?? 'Impossible d’afficher l’aperçu');
    } finally {
      setPreviewLoad(false);
    }
  }, [
    selectedIds,
    buildSelectedEntries,
    defaultFormatId,
    qrFormats.length,
    paper,
    layoutMode,
  ]);

  const handleExport = async () => {
    if (selectedIds.size === 0) {
      Alert.alert('Sélection', 'Cochez au moins un article (stock ou consommable).');
      return;
    }
    if (!defaultFormatId || qrFormats.length === 0) {
      Alert.alert('Formats', 'Créez d’abord un format d’étiquette (QR).');
      return;
    }
    const items = buildSelectedEntries();
    if (!items.length) {
      Alert.alert('PDF', 'Aucun format valide pour la sélection.');
      return;
    }
    setBusy(true);
    try {
      await exportBulkQrLabelsPdfCustom(items, paper, layoutMode);
      setPreviewOpen(false);
      setPreviewHtml(null);
    } catch (e: any) {
      Alert.alert('PDF', e?.message ?? 'Export impossible');
    } finally {
      setBusy(false);
    }
  };

  const headerRight = useMemo(
    () => (
      <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
        <Text style={s.close}>✕</Text>
      </TouchableOpacity>
    ),
    [onClose]
  );

  const renderRow = useCallback(
    ({ item }: { item: BulkQrPrintItem }) => {
      const on = selectedIds.has(item.id);
      return (
        <View style={s.row}>
          <TouchableOpacity
            onPress={() => toggle(item.id)}
            style={[s.check, on && s.checkOn]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
          >
            {on && <Text style={s.checkMark}>✓</Text>}
          </TouchableOpacity>
          <View style={s.rowText}>
            <Text style={s.rowName} numberOfLines={2}>
              {item.nom}
            </Text>
            <Text style={s.rowSub} numberOfLines={1}>
              {item.metaLine}
            </Text>
          </View>
          <View style={s.rowPicker}>
            {formatOptions.length ? (
              <SelectPicker
                label={undefined}
                value={formatById[item.id] ?? defaultFormatId}
                options={formatOptions}
                onChange={v => setFormatFor(item.id, v)}
              />
            ) : null}
          </View>
        </View>
      );
    },
    [selectedIds, toggle, formatById, defaultFormatId, setFormatFor, formatOptions]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: ListSection }) => (
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>{section.title}</Text>
        <Text style={s.sectionCount}>{section.data.length}</Text>
      </View>
    ),
    []
  );

  return (
    <>
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <TabScreenSafeArea style={s.safe} edges={['top', 'bottom']}>
          <View style={s.topBar}>
            <Text style={s.title}>Impression QR groupée</Text>
            {headerRight}
          </View>

          <View style={s.settings}>
            <SelectPicker
              label="Format de feuille"
              value={paper}
              options={PAPER_OPTIONS}
              onChange={v => setPaper(v as BulkPaperSize)}
            />
            <SelectPicker
              label="Disposition sur la feuille"
              value={layoutMode}
              options={LAYOUT_OPTIONS}
              onChange={v => setLayoutMode(v as BulkLayoutMode)}
            />
            {formatOptions.length ? (
              <SelectPicker
                label="Format d’étiquette (défaut)"
                value={defaultFormatId}
                options={formatOptions}
                onChange={v => setDefaultFormatId(v)}
              />
            ) : (
              <Text style={s.warn}>
                Aucun format enregistré. Ouvre « Gérer les formats » pour en créer (largeur, hauteur, marge, style).
              </Text>
            )}
            <TouchableOpacity style={s.manage} onPress={() => setManagerOpen(true)}>
              <Text style={s.manageText}>Gérer les formats d’étiquette (QR)…</Text>
            </TouchableOpacity>
            <View style={s.btnRow}>
              <TouchableOpacity style={s.chipBtn} onPress={selectAll}>
                <Text style={s.chipBtnText}>Tout sélectionner</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.chipBtn} onPress={selectNone}>
                <Text style={s.chipBtnText}>Aucun</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.chipBtnPrimary} onPress={applyDefaultToSelected}>
                <Text style={s.chipBtnPrimaryText}>Appliquer défaut aux cochés</Text>
              </TouchableOpacity>
            </View>
            <Text style={s.hint}>
              Chaque article (stock ou consommable) peut utiliser l’un de tes formats enregistrés. Vérifie d’abord l’aperçu, puis génère le PDF.
            </Text>
            <Text style={s.hint}>
              {layoutMode === 'grid_strict'
                ? `Grille stricte : chaque page ${paper} a une grille d’emplacements (selon la plus grande étiquette de la page). L’en-tête organisme n’apparaît que sur la première page.`
                : `Mode flux : les étiquettes se placent côte à côte ; le moteur essaie d’éviter de couper une étiquette entre deux feuilles.`}
            </Text>
          </View>

          <SectionList
            sections={sections}
            keyExtractor={item => item.id}
            renderItem={renderRow}
            renderSectionHeader={renderSectionHeader}
            style={s.list}
            contentContainerStyle={s.listContent}
            keyboardShouldPersistTaps="handled"
            stickySectionHeadersEnabled
            ListEmptyComponent={
              <Text style={s.empty}>Aucun article dans le stock ni les consommables.</Text>
            }
          />

          <View style={s.footer}>
            <TouchableOpacity
              style={s.prevBtn}
              onPress={() => void runPreview()}
            >
              <Text style={s.prevText}>Aperçu (sélection)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.exportBtn, (busy || !defaultFormatId) && s.exportBtnDisabled]}
              onPress={handleExport}
              disabled={busy || !defaultFormatId}
            >
              {busy ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={s.exportBtnText}>Générer le PDF ({selectedIds.size})</Text>
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
        kind="qr"
        onSaved={() => void loadFormats()}
      />

      <LabelHtmlPreviewModal
        visible={previewOpen}
        onClose={() => {
          setPreviewOpen(false);
          setPreviewHtml(null);
        }}
        title="Groupe"
        fullHtml={previewHtml}
        loading={previewLoad}
        onGeneratePdf={previewHtml && !previewLoad ? handleExport : undefined}
        generateLabel="Générer le PDF (partage)"
      />
    </>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: { color: Colors.white, fontSize: 18, fontWeight: '700', flex: 1 },
  close: { color: Colors.textMuted, fontSize: 22, padding: 4 },
  settings: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  warn: {
    color: Colors.yellow,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  manage: { marginBottom: 8, paddingVertical: 6 },
  manageText: { color: Colors.green, fontSize: 14, fontWeight: '700' },
  btnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chipBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipBtnText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  chipBtnPrimary: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: Colors.greenBg,
    borderWidth: 1,
    borderColor: Colors.green,
  },
  chipBtnPrimaryText: { color: Colors.green, fontSize: 12, fontWeight: '700' },
  hint: {
    color: Colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    marginBottom: 8,
  },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 12, paddingBottom: 12 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginTop: 4,
    backgroundColor: Colors.bg,
  },
  sectionTitle: { color: Colors.green, fontSize: 13, fontWeight: '700' },
  sectionCount: { color: Colors.textMuted, fontSize: 12, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 8,
  },
  check: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    marginTop: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: {
    backgroundColor: Colors.greenBg,
    borderColor: Colors.green,
  },
  checkMark: { color: Colors.green, fontSize: 16, fontWeight: '800' },
  rowText: { flex: 1, minWidth: 0, paddingRight: 4 },
  rowName: { color: Colors.white, fontSize: 14, fontWeight: '600' },
  rowSub: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  rowPicker: { width: 168, transform: [{ scale: 0.92 }], marginRight: -8 },
  empty: { color: Colors.textMuted, textAlign: 'center', marginTop: 24 },
  footer: {
    padding: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 10,
  },
  prevBtn: {
    borderWidth: 1,
    borderColor: Colors.textSecondary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  prevText: { color: Colors.white, fontSize: 15, fontWeight: '700' },
  exportBtn: {
    backgroundColor: Colors.green,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  exportBtnDisabled: { opacity: 0.6 },
  exportBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
});

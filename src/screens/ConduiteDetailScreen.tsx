import React, { useCallback, useMemo, useState } from 'react';
import { Alert, ListRenderItemInfo, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import ReorderableList, {
  reorderItems,
  useReorderableDrag,
  type ReorderableListReorderEvent,
} from 'react-native-reorderable-list';
import { BottomModal, BtnPrimary, Card, FullScreenSafeArea, Input, SelectPicker } from '../components/UI';
import { Colors, Shadow } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing } from '../theme/spacing';
import { COULEURS_TOP, LABELS_DEPARTEMENT, LABELS_LOCALISATION_TOP, LABELS_TYPE_TOP, LOCALISATIONS_TOP_OPTIONS } from '../types';
import type { Conduite, LocalisationTop, Top, TypeTop } from '../types';
import {
  addTop,
  deleteConduite,
  deleteTop,
  dupliquerConduite,
  getConduite,
  listTops,
  nextTopNumero,
  renumeroterTops,
  updateTop,
} from '../db/conduiteDb';
import { exportConduitePdf } from '../lib/pdfConduite';

const TYPE_OPTIONS: { label: string; value: TypeTop }[] = [
  { label: 'Lumière', value: 'lumiere' },
  { label: 'Son', value: 'son' },
  { label: 'Plateau', value: 'plateau' },
  { label: 'Vidéo', value: 'video' },
  { label: 'Autre', value: 'autre' },
];

const FILTRES: { label: string; value: TypeTop | 'tous' }[] = [
  { label: 'Tous', value: 'tous' },
  { label: '💡 Lumière', value: 'lumiere' },
  { label: '🔊 Son', value: 'son' },
  { label: '🎭 Plateau', value: 'plateau' },
  { label: '📹 Vidéo', value: 'video' },
];

type TopDraft = {
  id: string | null;
  numero: string;
  minutage: string;
  departement: TypeTop;
  description: string;
  detail: string;
  localisation: LocalisationTop | '';
  action: string;
  repere: string;
};

const EMPTY_DRAFT: TopDraft = {
  id: null,
  numero: '1',
  minutage: '',
  departement: 'autre',
  description: '',
  detail: '',
  localisation: '',
  action: '',
  repere: '',
};

/** Ligne d’un top, avec poignée de réordonnancement (drag) quand l’ordre est libre. */
const TopItem = React.memo(function TopItem({
  top,
  reorderEnabled,
  onEdit,
  onDelete,
}: {
  top: Top;
  reorderEnabled: boolean;
  onEdit: (t: Top) => void;
  onDelete: (t: Top) => void;
}) {
  const drag = useReorderableDrag();
  const c = COULEURS_TOP[top.departement];
  return (
    <Card onPress={() => onEdit(top)}>
      <View style={s.topRow}>
        {reorderEnabled ? (
          <Pressable
            onLongPress={drag}
            delayLongPress={150}
            hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
            accessibilityRole="button"
            accessibilityLabel={`Déplacer le top ${top.numero}`}
            style={s.dragHandle}
          >
            <Text style={s.dragHandleText}>≡</Text>
          </Pressable>
        ) : null}
        <View style={[s.numBox, { backgroundColor: c.bg, borderColor: c.border }]}>
          <Text style={[s.numText, { color: c.text }]}>{top.numero}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={s.topHead}>
            <Text style={s.topMin}>{top.minutage || '—'}</Text>
            <View style={[s.typeBadge, { backgroundColor: c.bg, borderColor: c.border }]}>
              <Text style={[s.typeBadgeText, { color: c.text }]}>{LABELS_TYPE_TOP[top.departement]}</Text>
            </View>
          </View>
          <Text style={s.topDesc}>{top.description}</Text>
          {top.localisation ? (
            <View style={s.locBadge}>
              <Text style={s.locBadgeText}>📍 {LABELS_LOCALISATION_TOP[top.localisation]}</Text>
            </View>
          ) : null}
          {top.repere ? (
            <Text style={s.topRepere} numberOfLines={2}>
              Repère : {top.repere}
            </Text>
          ) : null}
          {top.action ? (
            <Text style={s.topAction} numberOfLines={2}>
              Action : {top.action}
            </Text>
          ) : null}
          {top.detail ? (
            <Text style={s.topDetail} numberOfLines={2}>
              {top.detail}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity
          onPress={() => onDelete(top)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={`Supprimer le top ${top.numero}`}
        >
          <Text style={s.delTop}>✕</Text>
        </TouchableOpacity>
      </View>
    </Card>
  );
});

export default function ConduiteDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const conduiteId: string = route.params?.conduiteId;

  const [conduite, setConduite] = useState<Conduite | null>(null);
  const [tops, setTops] = useState<Top[]>([]);
  const [filtre, setFiltre] = useState<TypeTop | 'tous'>('tous');
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<TopDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [c, t] = await Promise.all([getConduite(conduiteId), listTops(conduiteId)]);
    setConduite(c);
    setTops(t);
  }, [conduiteId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const isGenerale = conduite?.departement === 'generale';
  const reorderEnabled = filtre === 'tous';
  const visibleTops = useMemo(
    () => (isGenerale && filtre !== 'tous' ? tops.filter(t => t.departement === filtre) : tops),
    [tops, filtre, isGenerale]
  );

  const openCreate = async () => {
    const numero = await nextTopNumero(conduiteId);
    setDraft({ ...EMPTY_DRAFT, numero: String(numero) });
    setModalOpen(true);
  };

  const openEdit = useCallback((top: Top) => {
    setDraft({
      id: top.id,
      numero: String(top.numero),
      minutage: top.minutage ?? '',
      departement: top.departement,
      description: top.description,
      detail: top.detail ?? '',
      localisation: top.localisation ?? '',
      action: top.action ?? '',
      repere: top.repere ?? '',
    });
    setModalOpen(true);
  }, []);

  const saveTop = async () => {
    if (!draft.description.trim()) {
      Alert.alert('Champ requis', 'La description du top est obligatoire.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        numero: Math.max(1, Math.floor(Number(draft.numero) || 1)),
        minutage: draft.minutage,
        departement: draft.departement,
        description: draft.description,
        detail: draft.detail,
        localisation: draft.localisation || null,
        action: draft.action,
        repere: draft.repere,
      };
      if (draft.id) {
        await updateTop(draft.id, payload);
      } else {
        await addTop({ conduiteId, ...payload });
      }
      setModalOpen(false);
      await load();
    } catch (e: unknown) {
      Alert.alert('Enregistrement impossible', e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteTop = useCallback(
    (top: Top) => {
      Alert.alert('Supprimer ce top ?', `Top ${top.numero} — ${top.description}`, [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => void deleteTop(top.id).then(load),
        },
      ]);
    },
    [load]
  );

  /** Réordonne les tops par glisser-déposer puis renumérote 1..n et persiste. */
  const handleReorder = useCallback(
    ({ from, to }: ReorderableListReorderEvent) => {
      if (from === to) return;
      setTops(prev => {
        const next = reorderItems(prev, from, to).map((t, i) => ({ ...t, numero: i + 1 }));
        void renumeroterTops(next.map(t => ({ id: t.id, numero: t.numero }))).catch((e: unknown) =>
          Alert.alert('Réordonnancement non sauvegardé', e instanceof Error ? e.message : String(e))
        );
        return next;
      });
    },
    []
  );

  const onDuplicate = () => {
    if (!conduite) return;
    void dupliquerConduite({
      conduiteId,
      nouveauTitre: `${conduite.titre} (copie)`,
      nouveauSpectacle: conduite.nomSpectacle,
    })
      .then(() => Alert.alert('Conduite dupliquée', 'Une copie a été créée avec tous ses tops.'))
      .then(load)
      .catch((e: unknown) => Alert.alert('Duplication impossible', e instanceof Error ? e.message : String(e)));
  };

  const onExportPdf = () => {
    if (!conduite) return;
    void exportConduitePdf(conduite, tops).catch((e: unknown) =>
      Alert.alert('Export impossible', e instanceof Error ? e.message : String(e))
    );
  };

  const onDeleteConduite = () => {
    Alert.alert('Supprimer la conduite ?', 'Cette action supprime aussi tous ses tops.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => void deleteConduite(conduiteId).then(() => navigation.goBack()),
      },
    ]);
  };

  const openMenu = () => {
    Alert.alert(conduite?.titre ?? 'Conduite', undefined, [
      { text: 'Dupliquer cette conduite', onPress: onDuplicate },
      { text: 'Exporter en PDF', onPress: onExportPdf },
      { text: 'Supprimer la conduite', style: 'destructive', onPress: onDeleteConduite },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Top>) => (
      <TopItem top={item} reorderEnabled={reorderEnabled} onEdit={openEdit} onDelete={confirmDeleteTop} />
    ),
    [reorderEnabled, openEdit, confirmDeleteTop]
  );

  const ListHeader = (
    <View>
      <Text style={s.title} numberOfLines={2}>
        {conduite?.titre}
      </Text>
      <View style={s.metaRow}>
        <Text style={s.spectacle}>{conduite?.nomSpectacle}</Text>
        {conduite ? (
          <View style={[s.pill, { borderColor: Colors.green }]}>
            <Text style={[s.pillText, { color: Colors.green }]}>{LABELS_DEPARTEMENT[conduite.departement]}</Text>
          </View>
        ) : null}
      </View>

      <TouchableOpacity
        style={s.liveBtn}
        onPress={() => navigation.navigate('ConduiteLive', { conduiteId })}
        activeOpacity={0.88}
        accessibilityRole="button"
        accessibilityLabel="Démarrer le mode live"
      >
        <Text style={s.liveBtnText}>▶  MODE LIVE</Text>
      </TouchableOpacity>

      {isGenerale && (
        <View style={s.filterRow}>
          {FILTRES.map(f => (
            <TouchableOpacity
              key={f.value}
              style={[s.chip, filtre === f.value && s.chipActive]}
              onPress={() => setFiltre(f.value)}
            >
              <Text style={[s.chipText, filtre === f.value && s.chipTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={s.sectionRow}>
        <Text style={s.section}>Tops ({visibleTops.length})</Text>
        <TouchableOpacity style={s.addBtn} onPress={() => void openCreate()} accessibilityRole="button" accessibilityLabel="Ajouter un top">
          <Text style={s.addBtnText}>＋ Top</Text>
        </TouchableOpacity>
      </View>
      {reorderEnabled && visibleTops.length > 1 ? (
        <Text style={s.reorderHint}>Appui long sur ≡ pour réordonner les tops.</Text>
      ) : null}
    </View>
  );

  if (!conduite) {
    return (
      <FullScreenSafeArea style={s.container}>
        <View style={s.center}>
          <Text style={s.muted}>Chargement…</Text>
        </View>
      </FullScreenSafeArea>
    );
  }

  return (
    <FullScreenSafeArea style={s.container} edges={['top', 'left', 'right']}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Retour">
          <Text style={s.backText}>‹ Retour</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={openMenu} accessibilityRole="button" accessibilityLabel="Options de la conduite">
          <Text style={s.menuText}>⋯</Text>
        </TouchableOpacity>
      </View>

      <ReorderableList
        data={visibleTops}
        onReorder={handleReorder}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          <Card>
            <Text style={s.emptyBody}>Aucun top pour l’instant. Ajoutez le premier top avec « ＋ Top ».</Text>
          </Card>
        }
        contentContainerStyle={s.scroll}
      />

      <BottomModal visible={modalOpen} onClose={() => setModalOpen(false)} title={draft.id ? 'Modifier le top' : 'Nouveau top'}>
        <View style={s.formRow}>
          <View style={{ width: 90 }}>
            <Input label="N°" value={draft.numero} onChangeText={v => setDraft(d => ({ ...d, numero: v }))} keyboardType="number-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Input
              label="Minutage (mm:ss)"
              value={draft.minutage}
              onChangeText={v => setDraft(d => ({ ...d, minutage: v }))}
              placeholder="Ex. 12:45"
            />
          </View>
        </View>
        <SelectPicker
          label="Type de top"
          value={draft.departement}
          options={TYPE_OPTIONS}
          onChange={v => setDraft(d => ({ ...d, departement: v as TypeTop }))}
        />
        <SelectPicker
          label="Localisation de l'action"
          value={draft.localisation}
          options={LOCALISATIONS_TOP_OPTIONS.map(o => ({ label: o.label, value: o.value }))}
          onChange={v => setDraft(d => ({ ...d, localisation: v as LocalisationTop | '' }))}
        />
        <Input
          label="Repère (déclencheur)"
          value={draft.repere}
          onChangeText={v => setDraft(d => ({ ...d, repere: v }))}
          placeholder='Ex. quand comédien dit : « attention !! »'
          multiline
        />
        <Input
          label="Action"
          value={draft.action}
          onChangeText={v => setDraft(d => ({ ...d, action: v }))}
          placeholder="Ex. descendre lampe, ouvrir rideau n°2"
          multiline
        />
        <Input
          label="Description (intitulé court)"
          value={draft.description}
          onChangeText={v => setDraft(d => ({ ...d, description: v }))}
          placeholder="Ex. Black total fin acte 1"
          required
        />
        <Input
          label="Détail (optionnel)"
          value={draft.detail}
          onChangeText={v => setDraft(d => ({ ...d, detail: v }))}
          placeholder="Ex. Mémoire 47, fade 3s, vérifier latéraux"
          multiline
        />
        <BtnPrimary label="Enregistrer" onPress={() => void saveTop()} loading={saving} style={{ marginLeft: 0, marginTop: 8 }} />
      </BottomModal>
    </FullScreenSafeArea>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { ...Typography.bodySecondary },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backText: { color: Colors.green, fontSize: 16, fontWeight: '600' },
  menuText: { color: Colors.textPrimary, fontSize: 24, fontWeight: '700' },
  scroll: { paddingHorizontal: Spacing.xl, paddingBottom: 40 },
  title: { ...Typography.screenTitle },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md, marginTop: 6 },
  spectacle: { ...Typography.bodySecondary, flex: 1, minWidth: 0 },
  pill: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 12, fontWeight: '700' },
  liveBtn: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.green,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.card,
  },
  liveBtnText: { color: Colors.white, fontSize: 18, fontWeight: '800', letterSpacing: 1 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: Spacing.lg },
  chip: { borderWidth: 1, borderColor: Colors.borderStrong, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  chipActive: { backgroundColor: Colors.greenBg, borderColor: Colors.green },
  chipText: { ...Typography.caption, color: Colors.textSecondary },
  chipTextActive: { color: Colors.green, fontWeight: '700' },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.xl, marginBottom: Spacing.sm },
  section: { ...Typography.label },
  reorderHint: { ...Typography.caption, marginBottom: Spacing.sm },
  addBtn: {
    backgroundColor: Colors.greenMuted,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addBtnText: { color: Colors.green, fontWeight: '700', fontSize: 14 },
  emptyBody: { ...Typography.bodySecondary },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  dragHandle: { paddingTop: 8, paddingRight: 2 },
  dragHandleText: { color: Colors.textMuted, fontSize: 22, fontWeight: '900' },
  numBox: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  numText: { fontSize: 16, fontWeight: '800' },
  topHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 2 },
  topMin: { ...Typography.caption, color: Colors.textPrimary, fontWeight: '700' },
  typeBadge: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  typeBadgeText: { fontSize: 10, fontWeight: '700' },
  topDesc: { ...Typography.body, fontWeight: '600' },
  locBadge: {
    alignSelf: 'flex-start',
    marginTop: 4,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: Colors.bg,
  },
  locBadgeText: { ...Typography.caption, color: Colors.textSecondary, fontWeight: '600' },
  topRepere: { ...Typography.bodySecondary, marginTop: 4, fontStyle: 'italic' },
  topAction: { ...Typography.body, marginTop: 2, fontWeight: '600', color: Colors.textPrimary },
  topDetail: { ...Typography.bodySecondary, marginTop: 2 },
  delTop: { color: Colors.red, fontSize: 16, fontWeight: '700', paddingLeft: 6 },
  formRow: { flexDirection: 'row', gap: Spacing.md },
});

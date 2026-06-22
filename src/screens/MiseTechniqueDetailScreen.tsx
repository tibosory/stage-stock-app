import React, { useCallback, useState } from 'react';
import { Alert, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { BottomModal, BtnPrimary, Card, FullScreenSafeArea, Input, SelectPicker } from '../components/UI';
import { Colors, Shadow } from '../theme/colors';
import { Typography } from '../theme/typography';
import { Spacing } from '../theme/spacing';
import { LABELS_ZONE } from '../types';
import type { Etape, MiseTechnique, Position, ZoneScene } from '../types';
import {
  addPositionPhoto,
  createEtape,
  createPosition,
  deleteEtape,
  deleteMiseTechnique,
  deletePosition,
  deletePositionPhoto,
  dupliquerEtape,
  getMaterielsPourLiaison,
  getMiseTechnique,
  listEtapes,
  listPositions,
  updateEtape,
  updatePosition,
} from '../db/miseTechniqueDb';
import { persistPositionPhotoCopy } from '../lib/miseTechniquePhotoStorage';

const ZONE_OPTIONS: { label: string; value: ZoneScene }[] = (
  Object.keys(LABELS_ZONE) as ZoneScene[]
).map(z => ({ label: LABELS_ZONE[z], value: z }));

type PositionDraft = {
  id: string | null;
  materielId: string | null;
  nomObjet: string;
  descriptionEmplacement: string;
  zone: ZoneScene;
  notes: string;
};

const EMPTY_POSITION: PositionDraft = {
  id: null,
  materielId: null,
  nomObjet: '',
  descriptionEmplacement: '',
  zone: 'non_definie',
  notes: '',
};

export default function MiseTechniqueDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const miseId: string = route.params?.miseId;

  const [mise, setMise] = useState<MiseTechnique | null>(null);
  const [etapes, setEtapes] = useState<Etape[]>([]);
  const [activeEtapeId, setActiveEtapeId] = useState<string | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [montage, setMontage] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  // Modales
  const [posModal, setPosModal] = useState(false);
  const [posDraft, setPosDraft] = useState<PositionDraft>(EMPTY_POSITION);
  const [posPhotos, setPosPhotos] = useState<Position['photos']>([]);
  const [savingPos, setSavingPos] = useState(false);
  const [lierStock, setLierStock] = useState(false);
  const [materiels, setMateriels] = useState<{ id: string; nom: string }[]>([]);

  const [etapeModal, setEtapeModal] = useState(false);
  const [etapeMode, setEtapeMode] = useState<'create' | 'rename'>('create');
  const [etapeName, setEtapeName] = useState('');
  const [etapeTargetId, setEtapeTargetId] = useState<string | null>(null);

  const [viewer, setViewer] = useState<string | null>(null);

  const loadPositions = useCallback(async (etapeId: string | null) => {
    if (!etapeId) {
      setPositions([]);
      return;
    }
    setPositions(await listPositions(etapeId));
  }, []);

  const load = useCallback(async () => {
    const [m, e] = await Promise.all([getMiseTechnique(miseId), listEtapes(miseId)]);
    setMise(m);
    setEtapes(e);
    setActiveEtapeId(prev => {
      const stillExists = prev && e.some(x => x.id === prev);
      return stillExists ? prev : e[0]?.id ?? null;
    });
  }, [miseId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  // Recharge les positions quand l’étape active change
  useFocusEffect(
    useCallback(() => {
      void loadPositions(activeEtapeId);
      setChecked({});
    }, [activeEtapeId, loadPositions])
  );

  // ── Étapes ──────────────────────────────────────────────────
  const openCreateEtape = () => {
    setEtapeMode('create');
    setEtapeName('');
    setEtapeTargetId(null);
    setEtapeModal(true);
  };

  const openRenameEtape = (etape: Etape) => {
    setEtapeMode('rename');
    setEtapeName(etape.nom);
    setEtapeTargetId(etape.id);
    setEtapeModal(true);
  };

  const saveEtape = async () => {
    if (!etapeName.trim()) return;
    try {
      if (etapeMode === 'create') {
        const created = await createEtape({ miseTechniqueId: miseId, nom: etapeName.trim() });
        setEtapeModal(false);
        await load();
        setActiveEtapeId(created.id);
      } else if (etapeTargetId) {
        await updateEtape(etapeTargetId, { nom: etapeName.trim() });
        setEtapeModal(false);
        await load();
      }
    } catch (e: unknown) {
      Alert.alert('Enregistrement impossible', e instanceof Error ? e.message : String(e));
    }
  };

  const onEtapeLongPress = (etape: Etape) => {
    Alert.alert(etape.nom, undefined, [
      { text: 'Renommer', onPress: () => openRenameEtape(etape) },
      {
        text: 'Dupliquer (avec positions)',
        onPress: () =>
          void dupliquerEtape({ etapeId: etape.id, nouveauNom: `${etape.nom} (copie)` })
            .then(async created => {
              await load();
              setActiveEtapeId(created.id);
            })
            .catch((e: unknown) => Alert.alert('Duplication impossible', e instanceof Error ? e.message : String(e))),
      },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Supprimer cette étape ?', 'Les positions et photos de l’étape seront supprimées.', [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Supprimer', style: 'destructive', onPress: () => void deleteEtape(etape.id).then(load) },
          ]),
      },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  // ── Positions ───────────────────────────────────────────────
  const openCreatePosition = () => {
    if (!activeEtapeId) {
      Alert.alert('Ajoutez une étape', 'Créez d’abord une étape pour y placer des objets.');
      return;
    }
    setPosDraft(EMPTY_POSITION);
    setPosPhotos([]);
    setLierStock(false);
    setPosModal(true);
  };

  const openEditPosition = (pos: Position) => {
    setPosDraft({
      id: pos.id,
      materielId: pos.materielId,
      nomObjet: pos.nomObjet,
      descriptionEmplacement: pos.descriptionEmplacement,
      zone: pos.zone,
      notes: pos.notes ?? '',
    });
    setPosPhotos(pos.photos ?? []);
    setLierStock(!!pos.materielId);
    setPosModal(true);
  };

  const ensureMateriels = async () => {
    if (materiels.length === 0) setMateriels(await getMaterielsPourLiaison());
  };

  const savePosition = async (): Promise<string | null> => {
    if (!activeEtapeId) return null;
    if (!posDraft.nomObjet.trim() || !posDraft.descriptionEmplacement.trim()) {
      Alert.alert('Champs requis', 'L’objet et l’emplacement sont obligatoires.');
      return null;
    }
    setSavingPos(true);
    try {
      const payload = {
        materielId: lierStock ? posDraft.materielId : null,
        nomObjet: posDraft.nomObjet,
        descriptionEmplacement: posDraft.descriptionEmplacement,
        zone: posDraft.zone,
        notes: posDraft.notes,
      };
      if (posDraft.id) {
        await updatePosition(posDraft.id, payload);
        await loadPositions(activeEtapeId);
        return posDraft.id;
      }
      const created = await createPosition({ etapeId: activeEtapeId, ...payload });
      setPosDraft(d => ({ ...d, id: created.id }));
      await loadPositions(activeEtapeId);
      return created.id;
    } catch (e: unknown) {
      Alert.alert('Enregistrement impossible', e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setSavingPos(false);
    }
  };

  const addPhoto = async (source: 'camera' | 'galerie') => {
    // La position doit exister pour rattacher des photos
    let positionId = posDraft.id;
    if (!positionId) {
      positionId = await savePosition();
      if (!positionId) return;
    }
    const perm =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission refusée', 'Autorisez l’accès à la caméra / galerie dans les réglages.');
      return;
    }
    const res =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
    if (res.canceled || !res.assets?.[0]?.uri) return;
    try {
      const local = await persistPositionPhotoCopy(positionId, res.assets[0].uri);
      const photo = await addPositionPhoto(positionId, local);
      setPosPhotos(prev => [...(prev ?? []), photo]);
      await loadPositions(activeEtapeId);
    } catch (e: unknown) {
      Alert.alert('Photo non ajoutée', e instanceof Error ? e.message : String(e));
    }
  };

  const removePhoto = (photoId: string) => {
    Alert.alert('Supprimer la photo ?', undefined, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () =>
          void deletePositionPhoto(photoId).then(async () => {
            setPosPhotos(prev => (prev ?? []).filter(p => p.id !== photoId));
            await loadPositions(activeEtapeId);
          }),
      },
    ]);
  };

  const confirmDeletePosition = (pos: Position) => {
    Alert.alert('Supprimer cet objet ?', pos.nomObjet, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => void deletePosition(pos.id).then(() => loadPositions(activeEtapeId)) },
    ]);
  };

  const onDeleteMise = () => {
    Alert.alert('Supprimer la mise technique ?', 'Toutes les étapes, positions et photos seront supprimées.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => void deleteMiseTechnique(miseId).then(() => navigation.goBack()) },
    ]);
  };

  if (!mise) {
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
        <TouchableOpacity onPress={onDeleteMise} accessibilityRole="button" accessibilityLabel="Supprimer la mise technique">
          <Text style={s.delText}>Supprimer</Text>
        </TouchableOpacity>
      </View>

      <View style={s.headerWrap}>
        <Text style={s.title} numberOfLines={2}>
          {mise.titre}
        </Text>
        <Text style={s.spectacle}>{mise.nomSpectacle}</Text>
      </View>

      {/* Onglets étapes */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs}>
        {etapes.map(et => (
          <TouchableOpacity
            key={et.id}
            style={[s.tab, activeEtapeId === et.id && s.tabActive]}
            onPress={() => setActiveEtapeId(et.id)}
            onLongPress={() => onEtapeLongPress(et)}
            delayLongPress={280}
          >
            <Text style={[s.tabText, activeEtapeId === et.id && s.tabTextActive]}>{et.nom}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={s.tabAdd} onPress={openCreateEtape} accessibilityRole="button" accessibilityLabel="Ajouter une étape">
          <Text style={s.tabAddText}>＋</Text>
        </TouchableOpacity>
      </ScrollView>

      {etapes.length === 0 ? (
        <View style={s.scroll}>
          <Card>
            <Text style={s.emptyTitle}>Aucune étape</Text>
            <Text style={s.emptyBody}>Ajoutez une étape (ex. « Début spectacle », « Acte 1 ») avec le « ＋ » ci-dessus.</Text>
          </Card>
        </View>
      ) : (
        <>
          <View style={s.actionsRow}>
            <TouchableOpacity
              style={[s.modeChip, montage && s.modeChipActive]}
              onPress={() => setMontage(m => !m)}
              accessibilityRole="button"
              accessibilityState={{ selected: montage }}
            >
              <Text style={[s.modeChipText, montage && s.modeChipTextActive]}>
                {montage ? '✓ Mode montage' : 'Mode montage'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.addBtn} onPress={openCreatePosition} accessibilityRole="button" accessibilityLabel="Ajouter un objet">
              <Text style={s.addBtnText}>＋ Objet</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={s.scroll}>
            {montage && (
              <Text style={s.montageHint}>
                {positions.length} objet{positions.length > 1 ? 's' : ''} à placer · cochez au fur et à mesure (non sauvegardé)
              </Text>
            )}
            {positions.length === 0 ? (
              <Card>
                <Text style={s.emptyBody}>Aucun objet dans cette étape. Ajoutez-en avec « ＋ Objet ».</Text>
              </Card>
            ) : (
              positions.map(pos => {
                const thumb = pos.photos?.[0]?.localUri;
                return (
                  <Card key={pos.id}>
                    <View style={s.posRow}>
                      {montage && (
                        <TouchableOpacity
                          style={[s.check, checked[pos.id] && s.checkOn]}
                          onPress={() => setChecked(c => ({ ...c, [pos.id]: !c[pos.id] }))}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: !!checked[pos.id] }}
                        >
                          <Text style={s.checkMark}>{checked[pos.id] ? '✓' : ''}</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        onPress={() => (thumb ? setViewer(thumb) : undefined)}
                        activeOpacity={thumb ? 0.8 : 1}
                        accessibilityRole={thumb ? 'imagebutton' : 'image'}
                      >
                        {thumb ? (
                          <Image source={{ uri: thumb }} style={s.thumb} />
                        ) : (
                          <View style={[s.thumb, s.thumbEmpty]}>
                            <Text style={s.thumbEmptyText}>📷</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{ flex: 1, minWidth: 0 }}
                        onPress={() => (montage ? (thumb ? setViewer(thumb) : undefined) : openEditPosition(pos))}
                        activeOpacity={0.85}
                      >
                        <Text style={[s.posName, checked[pos.id] && s.posNameDone]} numberOfLines={1}>
                          {pos.nomObjet}
                        </Text>
                        <Text style={s.posEmpl} numberOfLines={2}>
                          {pos.descriptionEmplacement}
                        </Text>
                        <View style={s.posMeta}>
                          <Text style={s.posZone}>{LABELS_ZONE[pos.zone]}</Text>
                          {pos.materielId ? <Text style={s.posLink}>🔗 Stock</Text> : null}
                          {pos.photos && pos.photos.length > 1 ? (
                            <Text style={s.posZone}>📷 {pos.photos.length}</Text>
                          ) : null}
                        </View>
                      </TouchableOpacity>
                      {!montage && (
                        <TouchableOpacity
                          onPress={() => confirmDeletePosition(pos)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          accessibilityRole="button"
                          accessibilityLabel={`Supprimer ${pos.nomObjet}`}
                        >
                          <Text style={s.delTopMark}>✕</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </Card>
                );
              })
            )}
          </ScrollView>
        </>
      )}

      {/* Modale position */}
      <BottomModal visible={posModal} onClose={() => setPosModal(false)} title={posDraft.id ? 'Modifier l’objet' : 'Nouvel objet'}>
        <View style={s.toggleRow}>
          <TouchableOpacity
            style={[s.toggleBtn, !lierStock && s.toggleBtnActive]}
            onPress={() => setLierStock(false)}
          >
            <Text style={[s.toggleText, !lierStock && s.toggleTextActive]}>Texte libre</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.toggleBtn, lierStock && s.toggleBtnActive]}
            onPress={() => {
              setLierStock(true);
              void ensureMateriels();
            }}
          >
            <Text style={[s.toggleText, lierStock && s.toggleTextActive]}>Lier au stock</Text>
          </TouchableOpacity>
        </View>

        {lierStock ? (
          <SelectPicker
            label="Matériel du stock"
            value={posDraft.materielId ?? ''}
            options={materiels.map(m => ({ label: m.nom, value: m.id }))}
            onChange={v => {
              const mat = materiels.find(m => m.id === v);
              setPosDraft(d => ({ ...d, materielId: v, nomObjet: mat?.nom ?? d.nomObjet }));
            }}
          />
        ) : null}

        <Input
          label="Nom de l’objet"
          value={posDraft.nomObjet}
          onChangeText={v => setPosDraft(d => ({ ...d, nomObjet: v }))}
          placeholder="Ex. Table pliante"
          required
        />
        <Input
          label="Emplacement"
          value={posDraft.descriptionEmplacement}
          onChangeText={v => setPosDraft(d => ({ ...d, descriptionEmplacement: v }))}
          placeholder="Ex. Table cour, devant le praticable"
          required
          multiline
        />
        <SelectPicker
          label="Zone de scène"
          value={posDraft.zone}
          options={ZONE_OPTIONS}
          onChange={v => setPosDraft(d => ({ ...d, zone: v as ZoneScene }))}
        />
        <Input
          label="Notes (optionnel)"
          value={posDraft.notes}
          onChangeText={v => setPosDraft(d => ({ ...d, notes: v }))}
          placeholder="Précisions complémentaires"
          multiline
        />

        <Text style={s.photoTitle}>Photos</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.photoStrip}>
          {(posPhotos ?? []).map(ph => (
            <TouchableOpacity key={ph.id} onPress={() => setViewer(ph.localUri)} onLongPress={() => removePhoto(ph.id)} delayLongPress={280}>
              <Image source={{ uri: ph.localUri }} style={s.photoThumb} />
            </TouchableOpacity>
          ))}
          {(posPhotos ?? []).length === 0 ? <Text style={s.muted}>Aucune photo</Text> : null}
        </ScrollView>
        <View style={s.photoBtns}>
          <TouchableOpacity style={s.photoBtn} onPress={() => void addPhoto('camera')}>
            <Text style={s.photoBtnText}>📷 Prendre</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.photoBtn} onPress={() => void addPhoto('galerie')}>
            <Text style={s.photoBtnText}>🖼️ Galerie</Text>
          </TouchableOpacity>
        </View>
        <Text style={s.photoHint}>Appui long sur une photo pour la supprimer.</Text>

        <BtnPrimary
          label={posDraft.id ? 'Terminé' : 'Enregistrer'}
          onPress={() => {
            if (posDraft.id) {
              void savePosition().then(() => setPosModal(false));
            } else {
              void savePosition().then(id => {
                if (id) setPosModal(false);
              });
            }
          }}
          loading={savingPos}
          style={{ marginLeft: 0, marginTop: 12 }}
        />
      </BottomModal>

      {/* Modale étape (création / renommage) */}
      <BottomModal visible={etapeModal} onClose={() => setEtapeModal(false)} title={etapeMode === 'create' ? 'Nouvelle étape' : 'Renommer l’étape'}>
        <Input
          label="Nom de l’étape"
          value={etapeName}
          onChangeText={setEtapeName}
          placeholder="Ex. Début spectacle, Acte 1, Rappel"
          required
        />
        <BtnPrimary label="Enregistrer" onPress={() => void saveEtape()} style={{ marginLeft: 0, marginTop: 8 }} />
      </BottomModal>

      {/* Visionneuse photo plein écran */}
      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <TouchableOpacity style={s.viewer} activeOpacity={1} onPress={() => setViewer(null)}>
          {viewer ? <Image source={{ uri: viewer }} style={s.viewerImg} resizeMode="contain" /> : null}
          <Text style={s.viewerClose}>Toucher pour fermer</Text>
        </TouchableOpacity>
      </Modal>
    </FullScreenSafeArea>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { ...Typography.bodySecondary },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  backText: { color: Colors.green, fontSize: 16, fontWeight: '600' },
  delText: { color: Colors.red, fontSize: 14, fontWeight: '700' },
  headerWrap: { paddingHorizontal: Spacing.xl },
  title: { ...Typography.screenTitle },
  spectacle: { ...Typography.bodySecondary, marginTop: 2 },
  tabs: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, gap: 8 },
  tab: { borderWidth: 1, borderColor: Colors.borderStrong, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 },
  tabActive: { backgroundColor: Colors.greenBg, borderColor: Colors.green },
  tabText: { ...Typography.caption, color: Colors.textSecondary },
  tabTextActive: { color: Colors.green, fontWeight: '700' },
  tabAdd: { borderWidth: 1, borderColor: Colors.green, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 },
  tabAddText: { color: Colors.green, fontWeight: '800', fontSize: 14 },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.xl, marginBottom: Spacing.sm },
  modeChip: { borderWidth: 1, borderColor: Colors.borderStrong, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
  modeChipActive: { backgroundColor: Colors.greenBg, borderColor: Colors.green },
  modeChipText: { ...Typography.caption, color: Colors.textSecondary },
  modeChipTextActive: { color: Colors.green, fontWeight: '700' },
  addBtn: { backgroundColor: Colors.greenMuted, borderWidth: 1, borderColor: 'rgba(52, 211, 153, 0.35)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { color: Colors.green, fontWeight: '700', fontSize: 14 },
  scroll: { paddingHorizontal: Spacing.xl, paddingBottom: 40 },
  montageHint: { ...Typography.caption, marginBottom: Spacing.sm },
  emptyTitle: { ...Typography.sectionTitle, marginBottom: 8 },
  emptyBody: { ...Typography.bodySecondary },
  posRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  check: { width: 30, height: 30, borderRadius: 8, borderWidth: 2, borderColor: Colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: Colors.green, borderColor: Colors.green },
  checkMark: { color: Colors.white, fontWeight: '900', fontSize: 16 },
  thumb: { width: 54, height: 54, borderRadius: 10, backgroundColor: Colors.bgCardAlt },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  thumbEmptyText: { fontSize: 22 },
  posName: { ...Typography.body, fontWeight: '700' },
  posNameDone: { textDecorationLine: 'line-through', color: Colors.textMuted },
  posEmpl: { ...Typography.bodySecondary, marginTop: 2 },
  posMeta: { flexDirection: 'row', gap: 12, marginTop: 4 },
  posZone: { ...Typography.caption },
  posLink: { ...Typography.caption, color: Colors.green },
  delTopMark: { color: Colors.red, fontSize: 16, fontWeight: '700', paddingLeft: 6 },
  toggleRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  toggleBtn: { flex: 1, borderWidth: 1, borderColor: Colors.borderStrong, borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: Colors.greenBg, borderColor: Colors.green },
  toggleText: { ...Typography.caption, color: Colors.textSecondary },
  toggleTextActive: { color: Colors.green, fontWeight: '700' },
  photoTitle: { ...Typography.label, marginTop: 6, marginBottom: 8 },
  photoStrip: { gap: 10, alignItems: 'center', minHeight: 64 },
  photoThumb: { width: 64, height: 64, borderRadius: 10, backgroundColor: Colors.bgCardAlt },
  photoBtns: { flexDirection: 'row', gap: 10, marginTop: 12 },
  photoBtn: { flex: 1, borderWidth: 1, borderColor: Colors.borderStrong, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  photoBtnText: { color: Colors.textPrimary, fontWeight: '600' },
  photoHint: { ...Typography.caption, marginTop: 8 },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' },
  viewerImg: { width: '100%', height: '82%' },
  viewerClose: { color: '#9CA3AF', fontSize: 14, marginTop: 14 },
});

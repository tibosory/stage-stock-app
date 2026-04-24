// src/screens/StockScreen.tsx
import React, { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Platform,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import {
  getMateriel,
  deleteMateriel,
  getCategories,
  getLocalisations,
  getMaterielById,
  getStats,
} from '../db/database';
import { Materiel, Categorie, Localisation, StatutMateriel } from '../types';
import {
  EtatBadge,
  StatutBadge,
  Card,
  ScreenHeader,
  TabScreenSafeArea,
} from '../components/UI';
import MaterielModal from '../components/MaterielModal';
import MaterielSerieModal from '../components/MaterielSerieModal';
import BulkQrPrintModal from '../components/BulkQrPrintModal';
import { useAppAuth } from '../context/AuthContext';
import ShelfLabelsModal from '../components/ShelfLabelsModal';
import { triggerSyncAfterActionIfEnabled } from '../lib/syncAfterAction';
import { countMaterielSameNameEnStock } from '../lib/materielSameName';
import { exportMaterielFichesPdf } from '../lib/pdfMaterielFiche';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

export default function StockScreen({ navigation, route }: any) {
  const { can } = useAppAuth();
  const insets = useSafeAreaInsets();
  const editOk = can('edit_inventory');
  const [materiels, setMateriels] = useState<Materiel[]>([]);
  const [filtered, setFiltered] = useState<Materiel[]>([]);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 220);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showSerieModal, setShowSerieModal] = useState(false);
  const [showBulkQrModal, setShowBulkQrModal] = useState(false);
  const [showShelfModal, setShowShelfModal] = useState(false);
  const [editItem, setEditItem] = useState<Materiel | null>(null);
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [localisations, setLocalisations] = useState<Localisation[]>([]);
  const [statutFilter, setStatutFilter] = useState<'tous' | StatutMateriel>('tous');
  const [stats, setStats] = useState({
    totalMateriels: 0,
    enPret: 0,
    pretsEnCours: 0,
    alertesConsommables: 0,
  });
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  /** Dernière fiche « sélectionnée » (tap sur la ligne) : affichage du décompte par libellé. */
  const [infoFocusItem, setInfoFocusItem] = useState<Materiel | null>(null);
  /** Sélection (appui long) pour export PDF fiches matériel (photo + infos). */
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pdfBusy, setPdfBusy] = useState(false);
  const bottomDockPad =
    Platform.OS === 'android' ? Math.max(insets.bottom, 52) : Math.max(insets.bottom, 12);
  const listBottomPadding = 60 + bottomDockPad + 28;

  const load = useCallback(async () => {
    try {
      const [mats, cats, locs, st] = await Promise.all([
        getMateriel(),
        getCategories(),
        getLocalisations(),
        getStats(),
      ]);
      setMateriels(mats);
      setFiltered(mats);
      setCategories(cats);
      setLocalisations(locs);
      setStats(st);
    } finally {
      setHasLoadedOnce(true);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  /** Depuis Paramètres : cartes stats → liste filtrée */
  useFocusEffect(
    useCallback(() => {
      const apply = route.params?.applyStatutFilter as typeof statutFilter | undefined;
      if (apply === undefined || apply === null) return;
      setStatutFilter(apply);
      navigation.setParams({ applyStatutFilter: undefined } as never);
    }, [route.params?.applyStatutFilter, navigation])
  );

  const applyFilters = useCallback((list: Materiel[], q: string, statut: typeof statutFilter) => {
    let next = list;
    if (statut !== 'tous') {
      next = next.filter(m => m.statut === statut);
    }
    if (!q) return next;
    const low = q.toLowerCase();
    return next.filter(m =>
      m.nom.toLowerCase().includes(low) ||
      m.qr_code?.toLowerCase().includes(low) ||
      m.numero_serie?.toLowerCase().includes(low) ||
      m.marque?.toLowerCase().includes(low) ||
      (m as any).categorie_nom?.toLowerCase().includes(low)
    );
  }, []);

  useEffect(() => {
    setFiltered(applyFilters(materiels, debouncedSearch, statutFilter));
  }, [materiels, debouncedSearch, statutFilter, applyFilters]);

  const infoFocusSameNameCount = useMemo(() => {
    if (!infoFocusItem) return null;
    return countMaterielSameNameEnStock(materiels, infoFocusItem);
  }, [materiels, infoFocusItem]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const filteredIds = useMemo(() => filtered.map(m => m.id), [filtered]);
  const allFilteredSelected = useMemo(
    () => filteredIds.length > 0 && filteredIds.every(id => selectedSet.has(id)),
    [filteredIds, selectedSet]
  );
  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds([]);
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  }, []);

  const toggleSelectAllFiltered = useCallback(() => {
    if (filteredIds.length === 0) return;
    setSelectedIds(prev => {
      const prevSet = new Set(prev);
      const allSelected = filteredIds.every(id => prevSet.has(id));
      if (allSelected) {
        return prev.filter(id => !filteredIds.includes(id));
      }
      const merged = new Set(prev);
      for (const id of filteredIds) merged.add(id);
      return Array.from(merged);
    });
  }, [filteredIds]);

  const onRowLongPress = useCallback(
    (item: Materiel) => {
      if (!selectMode) {
        setSelectMode(true);
        setSelectedIds([item.id]);
        setInfoFocusItem(null);
        return;
      }
      toggleSelect(item.id);
    },
    [selectMode, toggleSelect]
  );

  const onRowPress = useCallback(
    (item: Materiel) => {
      if (selectMode) {
        toggleSelect(item.id);
        return;
      }
      setInfoFocusItem(item);
    },
    [selectMode, toggleSelect]
  );

  const handleExportFichesPdf = useCallback(async () => {
    if (selectedIds.length === 0) {
      Alert.alert('Aucune fiche', 'Sélectionnez au moins un matériel (touchez les lignes en mode sélection).');
      return;
    }
    setPdfBusy(true);
    try {
      const list = filtered.filter(m => selectedIds.includes(m.id));
      await exportMaterielFichesPdf(list);
      exitSelectMode();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert('Export PDF', msg || 'Génération impossible.');
    } finally {
      setPdfBusy(false);
    }
  }, [selectedIds, filtered, exitSelectMode]);

  // Ouvrir modal depuis scanner (nouveau QR / NFC)
  useEffect(() => {
    if (!editOk) {
      if (route.params?.newQr || route.params?.newNfc) {
        navigation.setParams({ newQr: undefined, newNfc: undefined } as any);
      }
      return;
    }
    if (route.params?.newQr || route.params?.newNfc) {
      setEditItem(null);
      setShowModal(true);
    }
  }, [route.params?.newQr, route.params?.newNfc, editOk, navigation]);

  // Fiche détail → Modifier
  useEffect(() => {
    const editId = route.params?.editId as string | undefined;
    if (!editId) return;
    if (!editOk) {
      navigation.setParams({ editId: undefined, newQr: undefined, newNfc: undefined } as any);
      return;
    }
    (async () => {
      const m = await getMaterielById(editId);
      if (m) {
        setEditItem(m);
        setShowModal(true);
      }
      navigation.setParams({ editId: undefined, newQr: undefined, newNfc: undefined } as any);
    })();
  }, [route.params?.editId, navigation, editOk]);

  const handleSearch = (q: string) => {
    setSearch(q);
  };

  const handleBrowseOpen = useCallback(() => {
    navigation.navigate('StockBrowse');
  }, [navigation]);

  const FILTER_CHIPS: { key: typeof statutFilter; label: string }[] = [
    { key: 'tous', label: 'Tous' },
    { key: 'en stock', label: 'En stock' },
    { key: 'en prêt', label: 'En prêt' },
    { key: 'en réparation', label: 'Réparation' },
    { key: 'perdu', label: 'Perdu' },
  ];

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleDelete = (item: Materiel) => {
    if (!editOk) return;
    Alert.alert(
      'Supprimer',
      `Supprimer "${item.nom}" définitivement ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer', style: 'destructive',
          onPress: async () => {
            try {
              await deleteMateriel(item.id);
              load();
              void triggerSyncAfterActionIfEnabled();
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : String(e);
              Alert.alert('Suppression impossible', msg);
            }
          },
        },
      ]
    );
  };

  if (!hasLoadedOnce) {
    return (
      <TabScreenSafeArea style={s.container}>
        <View style={s.initialLoad}>
          <ActivityIndicator color={Colors.green} size="large" />
          <Text style={s.initialLoadText}>Chargement du stock…</Text>
        </View>
      </TabScreenSafeArea>
    );
  }

  const renderItem = ({ item }: { item: Materiel }) => {
    const isFocused = !selectMode && infoFocusItem?.id === item.id;
    const isSelected = selectMode && selectedSet.has(item.id);
    return (
    <Card
      style={[
        isFocused ? s.cardFocused : undefined,
        isSelected ? s.cardSelected : undefined,
        selectMode ? s.cardSelectMode : undefined,
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => onRowPress(item)}
        onLongPress={() => onRowLongPress(item)}
        delayLongPress={480}
        style={{ marginHorizontal: -4, paddingHorizontal: 4, marginTop: -2, paddingTop: 2 }}
        accessibilityRole="button"
        accessibilityLabel={
          selectMode
            ? `${isSelected ? 'Désélectionner' : 'Sélectionner'} ${item.nom} pour l’export PDF`
            : `Sélectionner ${item.nom} pour afficher le décompte par libellé — appui long : mode PDF`
        }
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          {selectMode && (
            <View style={s.selectMark}>
              <Text style={s.selectMarkText}>{isSelected ? '☑' : '☐'}</Text>
            </View>
          )}
          <View style={{ flexDirection: 'row', flex: 1, marginRight: 8, alignItems: 'flex-start' }}>
            <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.name}>{item.nom}</Text>
            <Text style={s.sub}>
              {item.marque ? item.marque + ' · ' : ''}
              {item.numero_serie ?? ''}
            </Text>
            {(item as any).localisation_nom && (
              <Text style={s.sub}>{(item as any).localisation_nom}</Text>
            )}
            </View>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <EtatBadge etat={item.etat} />
            <StatutBadge statut={item.statut} />
          </View>
        </View>
      </TouchableOpacity>

      {!selectMode && (
        <View style={s.actions}>
          <TouchableOpacity
            onPress={() => {
              setInfoFocusItem(item);
              navigation.navigate('MaterielDetail', { materielId: item.id });
            }}
            style={s.iconBtn}
          >
            <Text style={{ color: Colors.textMuted, fontSize: 18 }}>⊞</Text>
          </TouchableOpacity>
          {editOk && (
            <TouchableOpacity onPress={() => {
              setInfoFocusItem(item);
              setEditItem(item);
              setShowModal(true);
            }} style={s.iconBtn}>
              <Text style={{ color: Colors.textMuted, fontSize: 18 }}>✏️</Text>
            </TouchableOpacity>
          )}
          {editOk && (
            <TouchableOpacity onPress={() => handleDelete(item)} style={s.iconBtn}>
              <Text style={{ color: Colors.red, fontSize: 18 }}>🗑️</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </Card>
    );
  };

  return (
    <TabScreenSafeArea style={s.container}>
      <View style={{ padding: 20, paddingBottom: 0 }}>
        <ScreenHeader
          icon={<Text style={{ fontSize: 22, color: Colors.green }}>📦</Text>}
          title="Stock"
          rightLabel={editOk ? 'Ajouter' : undefined}
          onRightPress={editOk ? () => { setEditItem(null); setShowModal(true); } : undefined}
        />
        <View style={s.statsRow}>
          <StatCard
            label="Matériels"
            value={stats.totalMateriels}
            onPress={() => {
              setStatutFilter('tous');
              setSearch('');
            }}
          />
          <StatCard
            label="En prêt"
            value={stats.enPret}
            color={Colors.yellow}
            onPress={() => {
              setStatutFilter('en prêt');
              setSearch('');
            }}
          />
          <StatCard
            label="Prêts actifs"
            value={stats.pretsEnCours}
            color={Colors.blue}
            onPress={() => navigation.navigate('Prêts', { applyFiltreStatut: 'en cours' })}
          />
          <StatCard
            label="Alertes"
            value={stats.alertesConsommables}
            color={Colors.red}
            onPress={() => navigation.navigate('Consom.', { filterLowStock: true })}
          />
        </View>
        {editOk && (
          <View style={s.stockActionsRow}>
            <TouchableOpacity
              style={[s.stockActionBtn, s.stockActionBtnOutline]}
              onPress={() => setShowSerieModal(true)}
              activeOpacity={0.85}
            >
              <Text style={s.stockActionIcon}>📝</Text>
              <Text style={s.stockActionTitleOutline}>Saisie série</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.stockActionBtn, s.stockActionBtnPrimary]}
              onPress={() => setShowBulkQrModal(true)}
              activeOpacity={0.85}
            >
              <Text style={s.stockActionIcon}>🖨</Text>
              <Text style={s.stockActionTitlePrimary}>Impression QR</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.stockActionBtn, s.stockActionBtnOutline]}
              onPress={() => setShowShelfModal(true)}
              activeOpacity={0.85}
            >
              <Text style={s.stockActionIcon}>🏷</Text>
              <Text style={s.stockActionTitleOutline}>Étiquettes</Text>
            </TouchableOpacity>
          </View>
        )}
        <TouchableOpacity style={s.browseBtn} onPress={handleBrowseOpen} activeOpacity={0.85}>
          <Text style={s.browseBtnIcon}>🧭</Text>
          <Text style={s.browseBtnText}>Visualiser le stock (catégories / sous-catégories)</Text>
        </TouchableOpacity>

        <View style={s.searchRow}>
          <Text style={{ position: 'absolute', left: 14, zIndex: 1, color: Colors.textMuted }}>🔍</Text>
          <TextInput
            style={s.searchInput}
            placeholder="Rechercher..."
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={handleSearch}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.chipsRow}
          style={{ marginBottom: 8 }}
        >
          {FILTER_CHIPS.map(({ key, label }) => {
            const active = statutFilter === key;
            return (
              <TouchableOpacity
                key={key}
                style={[s.chip, active && s.chipActive]}
                onPress={() => setStatutFilter(key)}
              >
                <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <TouchableOpacity
          style={s.ficheHelpRow}
          onPress={() =>
            Alert.alert(
              'Fiches matériel (PDF)',
              'Appui long sur un article de la liste : le mode sélection s’ouvre. Touchez d’autres lignes pour les ajouter ou les retirer, puis « PDF fiches ». Chaque page A4 contient l’en-tête du lieu, la photo, le détail de la fiche et un QR code (même contenu qu’au scanner).'
            )
          }
          activeOpacity={0.8}
        >
          <Text style={s.ficheHelpText}>
            📄 Fiches matériel (A4) — appui long pour choisir, puis générer un PDF
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filtered}
        renderItem={renderItem}
        keyExtractor={(item: Materiel) => item.id}
        extraData={{ selectMode, nSel: selectedIds.length, ifId: infoFocusItem?.id }}
        contentContainerStyle={{ padding: 20, paddingTop: 10, paddingBottom: listBottomPadding }}
        initialNumToRender={12}
        maxToRenderPerBatch={16}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.green} />}
        ListHeaderComponent={
          <Fragment>
            {selectMode && (
              <View style={s.selectBanner}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.selectBannerTitle}>
                    {selectedIds.length} sélection{selectedIds.length > 1 ? 's' : ''} (liste filtrée)
                  </Text>
                  <Text style={s.selectBannerHint}>
                    Touchez une ligne pour l’ajouter ou la retirer — ou appui long. PDF : photo, infos, QR.
                  </Text>
                </View>
                <TouchableOpacity onPress={exitSelectMode} style={s.selectPill} disabled={pdfBusy}>
                  <Text style={s.selectPillText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={toggleSelectAllFiltered}
                  style={s.selectPill}
                  disabled={pdfBusy || filteredIds.length === 0}
                >
                  <Text style={s.selectPillText}>
                    {allFilteredSelected ? 'Tout retirer' : 'Tout sélectionner'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => void handleExportFichesPdf()}
                  style={[
                    s.selectPill,
                    s.selectPillGo,
                    (pdfBusy || selectedIds.length === 0) && { opacity: 0.45 },
                  ]}
                  disabled={pdfBusy || selectedIds.length === 0}
                >
                  {pdfBusy ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : (
                    <Text style={s.selectPillTextGo}>PDF fiches</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
            {infoFocusItem && !selectMode && infoFocusSameNameCount != null ? (
              <View style={s.sameNameBanner}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={s.sameNameBannerTitle}>
                    {infoFocusSameNameCount === 0
                      ? 'Aucune fiche « en stock »'
                      : infoFocusSameNameCount === 1
                        ? '1 fiche « en stock »'
                        : `${infoFocusSameNameCount} fiches « en stock »`}{' '}
                    pour le libellé « {infoFocusItem.nom.trim() || '—'} »
                  </Text>
                  <Text style={s.sameNameBannerHint}>
                    Comptage par nom affiché (casse / espaces ignorés en tête-bas). S/N, QR code et catégorie ne
                    comptent pas.
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setInfoFocusItem(null)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  accessibilityLabel="Fermer l’info"
                >
                  <Text style={s.sameNameBannerClose}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </Fragment>
        }
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={{ fontSize: 40 }}>📦</Text>
            <Text style={{ color: Colors.textMuted, marginTop: 12 }}>Aucun matériel</Text>
          </View>
        }
      />

      <MaterielModal
        visible={showModal}
        onClose={() => {
          setShowModal(false);
          setEditItem(null);
          navigation.setParams({ newQr: undefined, newNfc: undefined } as never);
        }}
        onSaved={load}
        onMetaRefresh={load}
        item={editItem}
        categories={categories}
        localisations={localisations}
        initialQr={route.params?.newQr}
        initialNfc={route.params?.newNfc}
        sameNameEnStockCount={
          editItem != null ? countMaterielSameNameEnStock(materiels, editItem) : undefined
        }
      />

      <MaterielSerieModal
        visible={showSerieModal}
        onClose={() => setShowSerieModal(false)}
        onSaved={load}
        onMetaRefresh={load}
        categories={categories}
        localisations={localisations}
      />

      <BulkQrPrintModal
        visible={showBulkQrModal}
        onClose={() => setShowBulkQrModal(false)}
        materiels={filtered}
      />

      <ShelfLabelsModal
        visible={showShelfModal}
        onClose={() => setShowShelfModal(false)}
        title="Étiquettes rayonnage (stock)"
        items={filtered.map(m => ({
          id: m.id,
          title: m.nom,
          subtitle: [
            (m as any).localisation_nom,
            (m as any).categorie_nom,
            m.numero_serie ? `S/N ${m.numero_serie}` : undefined,
          ]
            .filter(Boolean)
            .join(' · '),
        }))}
      />
    </TabScreenSafeArea>
  );
}

function StatCard({
  label,
  value,
  color = Colors.green,
  onPress,
}: {
  label: string;
  value: number;
  color?: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={st.card}
      onPress={onPress}
      activeOpacity={0.65}
      accessibilityRole="button"
      accessibilityLabel={`${label} : ${value}`}
    >
      <Text style={[st.value, { color }]}>{value}</Text>
      <Text style={st.label}>{label}</Text>
    </TouchableOpacity>
  );
}

const st = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  value: { fontSize: 22, fontWeight: '800' },
  label: { color: Colors.textMuted, fontSize: 11, marginTop: 2, textAlign: 'center' },
});

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  initialLoad: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  initialLoadText: {
    color: Colors.textSecondary,
    marginTop: 16,
    fontSize: 15,
    fontWeight: '500',
  },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  stockActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
    marginBottom: 8,
  },
  stockActionBtn: {
    flex: 1,
    minHeight: 66,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stockActionBtnOutline: {
    backgroundColor: Colors.bgCard,
    borderWidth: 2,
    borderColor: Colors.green,
  },
  stockActionBtnPrimary: {
    backgroundColor: Colors.green,
    borderWidth: 1,
    borderColor: Colors.green,
  },
  stockActionIcon: { fontSize: 20, marginBottom: 4 },
  stockActionTitleOutline: {
    color: Colors.green,
    fontWeight: '800',
    fontSize: 13,
    textAlign: 'center',
  },
  stockActionTitlePrimary: {
    color: Colors.white,
    fontWeight: '800',
    fontSize: 13,
    textAlign: 'center',
  },
  stockActionSub: {
    color: Colors.textSecondary,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 15,
  },
  stockActionSubOnPrimary: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 15,
  },
  browseBtn: {
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.45)',
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    paddingVertical: 9,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  browseBtnIcon: { fontSize: 16 },
  browseBtnText: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  chipsRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.greenBg, borderColor: Colors.green },
  chipText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: Colors.green },
  searchRow: { position: 'relative', marginBottom: 4 },
  searchInput: {
    backgroundColor: Colors.bgCard,
    borderRadius: 12, paddingLeft: 40, paddingRight: 14, paddingVertical: 11,
    color: Colors.white, fontSize: 14, borderWidth: 1, borderColor: Colors.border,
  },
  name: { color: Colors.white, fontSize: 16, fontWeight: '600' },
  sub: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8, gap: 4 },
  iconBtn: { padding: 6 },
  empty: { alignItems: 'center', marginTop: 60 },
  cardFocused: {
    borderColor: 'rgba(52, 211, 153, 0.45)',
    borderWidth: 1,
  },
  sameNameBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    padding: 12,
    marginBottom: 12,
  },
  sameNameBannerTitle: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  sameNameBannerHint: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 6,
    lineHeight: 16,
  },
  sameNameBannerClose: {
    color: Colors.textMuted,
    fontSize: 18,
    fontWeight: '600',
    padding: 2,
  },
  ficheHelpRow: {
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: 'rgba(26, 31, 42, 0.6)',
  },
  ficheHelpText: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  selectBanner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.4)',
    padding: 12,
    marginBottom: 12,
  },
  selectBannerTitle: { color: Colors.white, fontSize: 14, fontWeight: '800' },
  selectBannerHint: { color: Colors.textMuted, fontSize: 11, marginTop: 4, lineHeight: 15 },
  selectPill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  selectPillGo: { backgroundColor: Colors.green, borderColor: Colors.green },
  selectPillText: { color: Colors.textSecondary, fontWeight: '700', fontSize: 13 },
  selectPillTextGo: { color: Colors.white, fontWeight: '800', fontSize: 13 },
  cardSelected: {
    borderColor: Colors.green,
    borderWidth: 2,
  },
  cardSelectMode: { borderColor: Colors.border },
  selectMark: { marginRight: 8, justifyContent: 'center' },
  selectMarkText: { fontSize: 20, color: Colors.green },
});

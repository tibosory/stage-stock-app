// src/screens/StockScreen.tsx
import React, { useState, useEffect, useCallback, useMemo, Fragment, useRef } from 'react';
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
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import { deleteMateriel } from '../db/inventoryOpsDb';
import { getCategories, getLocalisations } from '../db/catalogDb';
import { getMaterielById } from '../db/inventoryDb';
import { getStats } from '../db/metadataDb';
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
import { quickPrintMaterielQr } from '../lib/labelCustomPdf';
import { getMaterielsCached, invalidateInventorySnapshotCache } from '../db/materialRepository';
import { useStockListViewModel } from '../ui/hooks/useStockListViewModel';
import { listTours } from '../db/trackingDb';
import { useLanguage } from '../context/LanguageContext';

const STOCK_LIST_PAGE_SIZE = 80;

export default function StockScreen({ navigation, route }: any) {
  const { t } = useLanguage();
  const { can } = useAppAuth();
  const insets = useSafeAreaInsets();
  const editOk = can('edit_inventory');
  const [materiels, setMateriels] = useState<Materiel[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showSerieModal, setShowSerieModal] = useState(false);
  const [showBulkQrModal, setShowBulkQrModal] = useState(false);
  const [showShelfModal, setShowShelfModal] = useState(false);
  const [editItem, setEditItem] = useState<Materiel | null>(null);
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [localisations, setLocalisations] = useState<Localisation[]>([]);
  const [stats, setStats] = useState({
    totalMateriels: 0,
    enPret: 0,
    pretsEnCours: 0,
    alertesConsommables: 0,
  });
  const [tourNamesById, setTourNamesById] = useState<Record<string, string>>({});
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const loadGenerationRef = useRef(0);
  /** Dernière fiche « sélectionnée » (tap sur la ligne) : affichage du décompte par libellé. */
  const [infoFocusItem, setInfoFocusItem] = useState<Materiel | null>(null);
  /** Article dont le QR est en cours de génération (désactive le bouton le temps du partage). */
  const [qrBusyId, setQrBusyId] = useState<string | null>(null);
  /** Sélection (appui long) pour export PDF fiches matériel (photo + infos). */
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pdfBusy, setPdfBusy] = useState(false);
  const { height: screenHeight } = useWindowDimensions();
  const bottomDockPad =
    Platform.OS === 'android' ? Math.max(insets.bottom, 52) : Math.max(insets.bottom, 12);
  const listBottomPadding = 60 + bottomDockPad + 28;
  const listMinHeight = Math.max(Math.floor(screenHeight * 0.4), 280);
  const topPanelMaxHeight = Math.floor(screenHeight * 0.56);
  const {
    search,
    setSearch,
    statusFilter: statutFilter,
    setStatusFilter: setStatutFilter,
    filtered,
    visible: visibleFiltered,
    showMore,
  } = useStockListViewModel(materiels, { pageSize: STOCK_LIST_PAGE_SIZE });

  const load = useCallback(async () => {
    const gen = ++loadGenerationRef.current;
    try {
      const [mats, cats, locs, st, tours] = await Promise.all([
        getMaterielsCached(),
        getCategories(),
        getLocalisations(),
        getStats(),
        listTours(),
      ]);
      if (gen !== loadGenerationRef.current) return;
      setMateriels(mats);
      setCategories(cats);
      setLocalisations(locs);
      setStats(st);
      setTourNamesById(
        tours.reduce<Record<string, string>>((acc, t) => {
          acc[t.id] = t.name;
          return acc;
        }, {})
      );
    } catch {
      /* ne pas bloquer l’UI : liste vide / stats par défaut si lecture échoue */
      if (gen === loadGenerationRef.current) {
        setMateriels([]);
        setCategories([]);
        setLocalisations([]);
        setStats({ totalMateriels: 0, enPret: 0, pretsEnCours: 0, alertesConsommables: 0 });
        setTourNamesById({});
      }
    } finally {
      if (gen === loadGenerationRef.current) {
        setHasLoadedOnce(true);
      }
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
      Alert.alert(t('stock.export.none_title'), t('stock.export.none_body'));
      return;
    }
    setPdfBusy(true);
    try {
      const list = filtered.filter(m => selectedIds.includes(m.id));
      await exportMaterielFichesPdf(list);
      exitSelectMode();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert(t('stock.export.title'), msg || 'Génération impossible.');
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
    { key: 'tous', label: t('stock.filter.all') },
    { key: 'en stock', label: t('stock.filter.in_stock') },
    { key: 'en prêt', label: t('stock.filter.on_loan') },
    { key: 'en tournée', label: t('stock.filter.on_tour') },
    { key: 'en réparation', label: t('stock.filter.in_repair') },
    { key: 'perdu', label: t('stock.filter.lost') },
  ];

  const onRefresh = async () => {
    setRefreshing(true);
    invalidateInventorySnapshotCache();
    await load();
    setRefreshing(false);
  };

  const handleDelete = (item: Materiel) => {
    if (!editOk) return;
    Alert.alert(
      t('stock.delete.title'),
      `${t('stock.delete.confirm_prefix')} "${item.nom}" ${t('stock.delete.confirm_suffix')}`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('stock.delete.title'), style: 'destructive',
          onPress: async () => {
            try {
              await deleteMateriel(item.id);
              invalidateInventorySnapshotCache();
              load();
              void triggerSyncAfterActionIfEnabled();
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : String(e);
              Alert.alert(t('stock.delete.error'), msg);
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
          <Text style={s.initialLoadText}>{t('stock.loading')}</Text>
        </View>
      </TabScreenSafeArea>
    );
  }

  const onPrintQr = async (item: Materiel) => {
    if (qrBusyId) return;
    setQrBusyId(item.id);
    try {
      await quickPrintMaterielQr(item);
    } catch (e: any) {
      Alert.alert('Impression QR', e?.message ?? 'Échec de la génération du PDF.');
    } finally {
      setQrBusyId(null);
    }
  };

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
            ? `${isSelected ? t('stock.a11y.unselect') : t('stock.a11y.select')} ${item.nom} pour l’export PDF`
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
            {item.statut === 'en tournée' && (
              <Text style={s.sub}>
                {t('stock.on_tour_prefix')} {tourNamesById[item.current_tour_id ?? ''] ?? item.current_tour_id ?? t('stock.on_tour_fallback')}
              </Text>
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
            onPress={() => onPrintQr(item)}
            style={s.qrBtn}
            disabled={qrBusyId === item.id}
            accessibilityRole="button"
            accessibilityLabel={`Imprimer le QR de ${item.nom}`}
          >
            <Text style={s.qrBtnText}>{qrBusyId === item.id ? '…' : 'QR'}</Text>
          </TouchableOpacity>
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
      <ScrollView
        style={{ maxHeight: topPanelMaxHeight }}
        contentContainerStyle={{ padding: 20, paddingBottom: 0 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          icon={<Text style={{ fontSize: 22, color: Colors.green }}>📦</Text>}
          title={t('stock.title')}
          subtitle={t('stock.subtitle')}
          rightLabel={editOk ? t('common.add') : undefined}
          onRightPress={editOk ? () => { setEditItem(null); setShowModal(true); } : undefined}
        />
        <View style={s.statsRow}>
          <StatCard
            label={t('stock.stats.materials')}
            value={stats.totalMateriels}
            onPress={() => {
              setStatutFilter('tous');
              setSearch('');
            }}
          />
          <StatCard
            label={t('stock.stats.on_loan')}
            value={stats.enPret}
            color={Colors.yellow}
            onPress={() => {
              setStatutFilter('en prêt');
              setSearch('');
            }}
          />
          <StatCard
            label={t('stock.stats.active_loans')}
            value={stats.pretsEnCours}
            color={Colors.blue}
            onPress={() => navigation.navigate('Prêts', { applyFiltreStatut: 'en cours' })}
          />
          <StatCard
            label={t('stock.stats.alerts')}
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
              <Text style={s.stockActionTitleOutline}>{t('stock.action.series')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.stockActionBtn, s.stockActionBtnPrimary]}
              onPress={() => setShowBulkQrModal(true)}
              activeOpacity={0.85}
            >
              <Text style={s.stockActionIcon}>🖨</Text>
              <Text style={s.stockActionTitlePrimary}>{t('stock.action.print_qr')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.stockActionBtn, s.stockActionBtnOutline]}
              onPress={() => setShowShelfModal(true)}
              activeOpacity={0.85}
            >
              <Text style={s.stockActionIcon}>🏷</Text>
              <Text style={s.stockActionTitleOutline}>{t('stock.action.labels')}</Text>
            </TouchableOpacity>
          </View>
        )}
        <TouchableOpacity style={s.browseBtn} onPress={handleBrowseOpen} activeOpacity={0.85}>
          <Text style={s.browseBtnIcon}>🧭</Text>
          <Text style={s.browseBtnText}>{t('stock.action.browse')}</Text>
        </TouchableOpacity>

        <View style={s.searchRow}>
          <Text style={{ position: 'absolute', left: 14, zIndex: 1, color: Colors.textMuted }}>🔍</Text>
          <TextInput
            style={s.searchInput}
            placeholder={t('stock.searchPlaceholder')}
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
              t('stock.help.pdf_title'),
              t('stock.help.pdf_body')
            )
          }
          activeOpacity={0.8}
        >
          <Text style={s.ficheHelpText}>
            {t('stock.help.pdf_short')}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={{ flex: 1, minHeight: listMinHeight }}>
        <FlatList
          data={visibleFiltered}
          renderItem={renderItem}
          keyExtractor={(item: Materiel) => item.id}
          extraData={{ selectMode, nSel: selectedIds.length, ifId: infoFocusItem?.id }}
          contentContainerStyle={{ padding: 20, paddingTop: 10, paddingBottom: listBottomPadding }}
          initialNumToRender={12}
          maxToRenderPerBatch={16}
          windowSize={7}
          removeClippedSubviews={Platform.OS === 'android'}
          onEndReachedThreshold={0.45}
          onEndReached={showMore}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.green} />}
          ListHeaderComponent={
            <Fragment>
              {selectMode && (
                <View style={s.selectBanner}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.selectBannerTitle}>
                      {selectedIds.length} {t('stock.select.count_suffix')}
                      {selectedIds.length > 1 ? 's' : ''} {t('stock.select.filtered')}
                    </Text>
                    <Text style={s.selectBannerHint}>
                      Touchez une ligne pour l’ajouter ou la retirer — ou appui long. PDF : photo, infos, QR.
                    </Text>
                  </View>
                  <TouchableOpacity onPress={exitSelectMode} style={s.selectPill} disabled={pdfBusy}>
                    <Text style={s.selectPillText}>{t('stock.select.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={toggleSelectAllFiltered}
                    style={s.selectPill}
                    disabled={pdfBusy || filteredIds.length === 0}
                  >
                    <Text style={s.selectPillText}>
                      {allFilteredSelected ? t('stock.select.none') : t('stock.select.all')}
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
                      <Text style={s.selectPillTextGo}>{t('stock.select.pdf')}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
              {infoFocusItem && !selectMode && infoFocusSameNameCount != null ? (
                <View style={s.sameNameBanner}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={s.sameNameBannerTitle}>
                      {infoFocusSameNameCount === 0
                        ? t('stock.info.none_in_stock')
                        : infoFocusSameNameCount === 1
                          ? t('stock.info.one_in_stock')
                          : `${infoFocusSameNameCount} ${t('stock.info.many_in_stock_suffix')}`}{' '}
                      {t('stock.info.for_label_prefix')} « {infoFocusItem.nom.trim() || '—'} »
                    </Text>
                    <Text style={s.sameNameBannerHint}>
                      {t('stock.info.count_hint')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setInfoFocusItem(null)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    accessibilityLabel={t('stock.info.close')}
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
              <Text style={{ color: Colors.textMuted, marginTop: 12 }}>{t('stock.none')}</Text>
            </View>
          }
        />
      </View>

      <MaterielModal
        visible={showModal}
        onClose={() => {
          setShowModal(false);
          setEditItem(null);
          navigation.setParams({ newQr: undefined, newNfc: undefined } as never);
        }}
        onSaved={() => {
          invalidateInventorySnapshotCache();
          void load();
        }}
        onMetaRefresh={load}
        item={editItem}
        categories={categories}
        localisations={localisations}
        initialQr={route.params?.newQr}
        initialNfc={route.params?.newNfc}
        sameNameEnStockCount={
          editItem != null ? countMaterielSameNameEnStock(materiels, editItem) : undefined
        }
        onOpenProfileEditor={() => {
          setShowModal(false);
          setEditItem(null);
          navigation.navigate('ProfileEditor');
        }}
      />

      <MaterielSerieModal
        visible={showSerieModal}
        onClose={() => setShowSerieModal(false)}
        onSaved={() => {
          invalidateInventorySnapshotCache();
          void load();
        }}
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
        title={t('stock.action.labels')}
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
    minHeight: 56,
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 6,
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
  stockActionIcon: { fontSize: 17, marginBottom: 3 },
  stockActionTitleOutline: {
    color: Colors.green,
    fontWeight: '800',
    fontSize: 12,
    textAlign: 'center',
  },
  stockActionTitlePrimary: {
    color: Colors.white,
    fontWeight: '800',
    fontSize: 12,
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
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.45)',
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    paddingVertical: 7,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  browseBtnIcon: { fontSize: 14 },
  browseBtnText: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  chipsRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.greenBg, borderColor: Colors.green },
  chipText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: Colors.green },
  searchRow: { position: 'relative', marginBottom: 4 },
  searchInput: {
    backgroundColor: Colors.bgCard,
    borderRadius: 10, paddingLeft: 38, paddingRight: 12, paddingVertical: 9,
    color: Colors.white, fontSize: 13, borderWidth: 1, borderColor: Colors.border,
  },
  name: { color: Colors.white, fontSize: 16, fontWeight: '600' },
  sub: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 8, gap: 4 },
  iconBtn: { padding: 6 },
  qrBtn: { borderWidth: 1, borderColor: Colors.green, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  qrBtnText: { color: Colors.green, fontSize: 12, fontWeight: '700' },
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

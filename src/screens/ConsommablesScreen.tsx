// src/screens/ConsommablesScreen.tsx
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  Alert, RefreshControl, Platform, Image, ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { Colors } from '../theme/colors';
import {
  deleteConsommable, ajusterStock,
} from '../db/inventoryOpsDb';
import {
  insertConsommable, updateConsommable, getConsommableById,
} from '../db/inventoryDb';
import {
  getCategories, getLocalisations, insertCategorie, insertLocalisation, categoryPathById,
} from '../db/catalogDb';
import { Consommable, Categorie, Localisation } from '../types';
import {
  StockBadge, Card, ScreenHeader, BottomModal,
  Input, SelectPicker, FormButtons, TabScreenSafeArea,
} from '../components/UI';
import { useAppAuth } from '../context/AuthContext';
import ShelfLabelsModal from '../components/ShelfLabelsModal';
import { quickPrintConsommableQr } from '../lib/labelCustomPdf';
import { triggerSyncAfterActionIfEnabled } from '../lib/syncAfterAction';
import { uploadConsommablePhoto, isSupabaseConfigured } from '../lib/supabase';
import { persistConsommablePhotoCopy } from '../lib/consommablePhotoStorage';
import {
  GEL_BRAND_OPTIONS,
  gelPickerOptions,
  getGelSwatch,
  type GelBrand,
} from '../lib/gelFilters';
import { getConsommablesCached, invalidateInventorySnapshotCache } from '../db/materialRepository';
import { useDebouncedValue } from '../ui/hooks/useDebouncedValue';
import { filterConsommableList } from '../core/stock/stockListFilters';
import { useLanguage } from '../context/LanguageContext';
import { BurstQtyNumpadModal } from '../components/BurstQtyNumpadModal';

const CONSOMMABLE_UNITE_OPTIONS = [
  'pièce',
  'rouleau',
  'boîte',
  'mètre',
  'litre',
  'kg',
  'paquet',
  'feuille',
  '1/2 feuille',
].map(u => ({ label: u, value: u }));

const CONSO_LIST_PAGE_SIZE = 90;

export default function ConsommablesScreen() {
  const { t } = useLanguage();
  const { can } = useAppAuth();
  const editOk = can('edit_inventory');
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [items, setItems] = useState<Consommable[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Consommable | null>(null);
  const [qrBusyId, setQrBusyId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [localisations, setLocalisations] = useState<Localisation[]>([]);
  const [showShelfModal, setShowShelfModal] = useState(false);
  const [visibleCount, setVisibleCount] = useState(CONSO_LIST_PAGE_SIZE);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 220);
  const [adjustTarget, setAdjustTarget] = useState<Consommable | null>(null);
  const [adjustMoveType, setAdjustMoveType] = useState<'entrée' | 'sortie'>('sortie');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    const [data, cats, locs] = await Promise.all([
      getConsommablesCached(), getCategories(), getLocalisations(),
    ]);
    setItems(data);
    setCategories(cats);
    setLocalisations(locs);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  /** Depuis scanner : nouveau QR / NFC inconnu — ouvrir la feuille consommable */
  useEffect(() => {
    if (!editOk) {
      if (route.params?.newQr || route.params?.newNfc) {
        navigation.setParams({ newQr: undefined, newNfc: undefined } as never);
      }
      return;
    }
    if (route.params?.newQr || route.params?.newNfc) {
      setEditItem(null);
      setShowModal(true);
    }
  }, [route.params?.newQr, route.params?.newNfc, editOk, navigation]);

  const filterLowStock = route.params?.filterLowStock === true;
  const displayedItems = useMemo(
    () => filterConsommableList(items, debouncedSearch, filterLowStock),
    [items, debouncedSearch, filterLowStock]
  );
  const visibleDisplayedItems = useMemo(
    () => displayedItems.slice(0, visibleCount),
    [displayedItems, visibleCount]
  );

  useEffect(() => {
    setVisibleCount(CONSO_LIST_PAGE_SIZE);
  }, [displayedItems.length, filterLowStock, debouncedSearch]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const filteredIds = useMemo(() => displayedItems.map(c => c.id), [displayedItems]);
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
    (item: Consommable) => {
      if (!editOk) return;
      if (!selectMode) {
        setSelectMode(true);
        setSelectedIds([item.id]);
        return;
      }
      toggleSelect(item.id);
    },
    [editOk, selectMode, toggleSelect]
  );

  useFocusEffect(
    useCallback(() => {
      const initialSearch = route.params?.initialSearch as string | undefined;
      if (!initialSearch?.trim()) return;
      setSearch(initialSearch.trim());
      navigation.setParams({ initialSearch: undefined } as never);
    }, [route.params?.initialSearch, navigation])
  );

  /** Depuis Alertes : ouvrir directement la fiche consommable en édition */
  useFocusEffect(
    useCallback(() => {
      const editId = route.params?.openConsoEditId as string | undefined;
      if (!editId) return;
      (async () => {
        const c = await getConsommableById(editId);
        if (c) {
          setEditItem(c);
          setShowModal(true);
        }
        navigation.setParams({ openConsoEditId: undefined } as never);
      })();
    }, [route.params?.openConsoEditId, navigation])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    invalidateInventorySnapshotCache();
    await load();
    setRefreshing(false);
  };

  const applyAdjustQty = useCallback(
    async (qty: number) => {
      if (!adjustTarget) return;
      const delta = adjustMoveType === 'entrée' ? qty : -qty;
      try {
        await ajusterStock(adjustTarget.id, delta);
        invalidateInventorySnapshotCache();
        await load();
        void triggerSyncAfterActionIfEnabled();
        setAdjustTarget(null);
      } catch (e: unknown) {
        Alert.alert(
          t('consumables.adjustError'),
          e instanceof Error ? e.message : String(e)
        );
      }
    },
    [adjustMoveType, adjustTarget, load, t]
  );

  const promptAdjustMovement = useCallback(
    (item: Consommable) => {
      if (!editOk) return;
      Alert.alert(item.nom, t('consumables.adjustChooseType', { stock: item.stock_actuel, unit: item.unite }), [
        {
          text: t('consumables.adjustEntry'),
          onPress: () => {
            setAdjustMoveType('entrée');
            setAdjustTarget(item);
          },
        },
        {
          text: t('consumables.adjustExit'),
          onPress: () => {
            setAdjustMoveType('sortie');
            setAdjustTarget(item);
          },
        },
        { text: t('common.cancel'), style: 'cancel' },
      ]);
    },
    [editOk, t]
  );

  const handleAjusterStock = useCallback(
    (item: Consommable) => {
      promptAdjustMovement(item);
    },
    [promptAdjustMovement]
  );

  /** Depuis une autre vue : ouvrir l’ajustement de stock sur un consommable précis */
  useFocusEffect(
    useCallback(() => {
      const openId = route.params?.openConsoId as string | undefined;
      if (!openId) return;
      (async () => {
        const c = await getConsommableById(openId);
        if (c) {
          promptAdjustMovement(c);
        }
        navigation.setParams({ openConsoId: undefined });
      })();
    }, [route.params?.openConsoId, navigation, promptAdjustMovement])
  );

  const handleDelete = useCallback((item: Consommable) => {
    if (!editOk) return;
    Alert.alert(t('consumables.deleteTitle'), `Supprimer "${item.nom}" ?`, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('consumables.deleteTitle'), style: 'destructive',
        onPress: async () => {
          await deleteConsommable(item.id);
          invalidateInventorySnapshotCache();
          load();
          void triggerSyncAfterActionIfEnabled();
        }
      },
    ]);
  }, [editOk, load]);

  const onPrintQr = useCallback(async (item: Consommable) => {
    setQrBusyId(prev => prev ?? item.id);
    try {
      await quickPrintConsommableQr(item);
    } catch (e: any) {
      Alert.alert('Impression QR', e?.message ?? 'Échec de la génération du PDF.');
    } finally {
      setQrBusyId(null);
    }
  }, []);

  const openConsoFromSearch = useCallback(
    (item: Consommable) => {
      if (editOk) {
        setEditItem(item);
        setShowModal(true);
        return;
      }
      setSearch(item.nom);
    },
    [editOk]
  );

  const onRowPress = useCallback(
    (item: Consommable) => {
      if (selectMode) {
        toggleSelect(item.id);
        return;
      }
      if (debouncedSearch.trim()) {
        openConsoFromSearch(item);
      }
    },
    [selectMode, toggleSelect, debouncedSearch, openConsoFromSearch]
  );

  const onTrashLongPress = useCallback(
    (item: Consommable) => {
      if (!editOk) return;
      if (!selectMode) {
        setSelectMode(true);
        setSelectedIds([item.id]);
        return;
      }
      toggleSelect(item.id);
    },
    [editOk, selectMode, toggleSelect]
  );

  const handleBulkDelete = useCallback(() => {
    if (!editOk || selectedIds.length === 0) return;
    const count = selectedIds.length;
    Alert.alert(t('consumables.delete.bulkTitle'), t('consumables.delete.bulkBody', { count }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('consumables.deleteTitle'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setDeleteBusy(true);
            let ok = 0;
            let fail = 0;
            const ids = [...selectedIds];
            for (const id of ids) {
              try {
                await deleteConsommable(id);
                ok += 1;
              } catch {
                fail += 1;
              }
            }
            invalidateInventorySnapshotCache();
            await load();
            void triggerSyncAfterActionIfEnabled();
            setDeleteBusy(false);
            exitSelectMode();
            if (fail === 0) {
              Alert.alert(t('consumables.deleteTitle'), t('consumables.delete.bulkDone', { count: ok }));
            } else {
              Alert.alert(t('consumables.deleteError'), t('consumables.delete.bulkPartial', { ok, fail }));
            }
          })();
        },
      },
    ]);
  }, [editOk, selectedIds, load, exitSelectMode, t]);

  const renderItem = useCallback(({ item }: { item: Consommable }) => {
    const stockBas = item.stock_actuel <= item.seuil_minimum;
    const photoUri = item.photo_local ?? item.photo_url;
    const hasGel = !!(item.gel_brand && item.gel_code?.trim());
    const preferGel = !!(item.gel_instead_of_photo && hasGel);
    const gelSw = hasGel ? getGelSwatch(item.gel_brand, item.gel_code!.trim()) : null;
    const isSelected = selectMode && selectedSet.has(item.id);
    return (
      <Card
        style={[
          stockBas ? { borderWidth: 1, borderColor: Colors.red } : {},
          isSelected ? s.cardSelected : undefined,
          selectMode ? s.cardSelectMode : undefined,
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={() => onRowPress(item)}
          onLongPress={() => onRowLongPress(item)}
          delayLongPress={480}
          disabled={!selectMode && !debouncedSearch.trim() && !editOk}
        >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          {selectMode && (
            <View style={s.selectMark}>
              <Text style={s.selectMarkText}>{isSelected ? '☑' : '☐'}</Text>
            </View>
          )}
          <View style={{ flexDirection: 'row', flex: 1, marginRight: 8, alignItems: 'flex-start' }}>
            {preferGel && gelSw ? (
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 8,
                  marginRight: 10,
                  backgroundColor: gelSw.hex,
                  borderWidth: 1,
                  borderColor: Colors.border,
                }}
              />
            ) : photoUri ? (
              <Image
                source={{ uri: photoUri }}
                style={{ width: 44, height: 44, borderRadius: 8, marginRight: 10 }}
              />
            ) : gelSw ? (
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 8,
                  marginRight: 10,
                  backgroundColor: gelSw.hex,
                  borderWidth: 1,
                  borderColor: Colors.border,
                }}
              />
            ) : null}
            <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.name}>{item.nom}</Text>
            <Text style={s.sub}>
              {item.reference ? item.reference + ' · ' : ''}
              {(item as any).fournisseur ? (item as any).fournisseur : ''}
            </Text>
            {(item as any).localisation_nom && (
              <Text style={s.sub}>{(item as any).localisation_nom}</Text>
            )}
            </View>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <StockBadge actuel={item.stock_actuel} seuil={item.seuil_minimum} unite={item.unite} />
            {stockBas && <Text style={{ color: Colors.red, fontSize: 11, fontWeight: '600' }}>{t('consumables.lowStock')}</Text>}
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
          {editOk && (
            <TouchableOpacity onPress={() => handleAjusterStock(item)} style={s.adjBtn}>
              <Text style={{ color: Colors.white, fontSize: 12 }}>{t('consumables.adjust')}</Text>
            </TouchableOpacity>
          )}
          {editOk && (
            <TouchableOpacity onPress={() => {
              setEditItem(item); setShowModal(true);
            }} style={s.iconBtn}>
              <Text style={{ color: Colors.textMuted, fontSize: 18 }}>✏️</Text>
            </TouchableOpacity>
          )}
          {editOk && (
            <TouchableOpacity
              onPress={() => handleDelete(item)}
              onLongPress={() => onTrashLongPress(item)}
              delayLongPress={450}
              style={s.iconBtn}
              accessibilityRole="button"
              accessibilityLabel={`${t('consumables.deleteTitle')} ${item.nom}`}
            >
              <Text style={{ color: Colors.red, fontSize: 18 }}>🗑️</Text>
            </TouchableOpacity>
          )}
        </View>
        )}
      </Card>
    );
  }, [
    debouncedSearch,
    editOk,
    handleAjusterStock,
    handleDelete,
    onPrintQr,
    onRowLongPress,
    onRowPress,
    onTrashLongPress,
    qrBusyId,
    selectMode,
    selectedSet,
    t,
  ]);

  const keyExtractor = useCallback((item: Consommable) => item.id, []);

  return (
    <TabScreenSafeArea style={s.container}>
      <View style={{ padding: 20, paddingBottom: 0 }}>
        <ScreenHeader
          icon={<Text style={{ fontSize: 22, color: Colors.green }}>🛒</Text>}
          title={t('consumables.title')}
          rightLabel={editOk ? t('consumables.add') : undefined}
          onRightPress={editOk ? () => { setEditItem(null); setShowModal(true); } : undefined}
        />
        {editOk && (
          <TouchableOpacity
            style={s.shelfBtn}
            onPress={() => setShowShelfModal(true)}
            activeOpacity={0.85}
          >
            <Text style={s.shelfBtnText}>🏷 {t('consumables.shelfLabelsHint')}</Text>
          </TouchableOpacity>
        )}
        {filterLowStock ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
            <Text style={{ color: Colors.red, fontSize: 12, fontWeight: '600' }}>{t('consumables.lowFilter')}</Text>
            <TouchableOpacity onPress={() => navigation.setParams({ filterLowStock: false } as never)}>
              <Text style={{ color: Colors.green, fontSize: 12, fontWeight: '700' }}>{t('consumables.showAll')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        <View style={s.searchRow}>
          <Text style={{ position: 'absolute', left: 14, zIndex: 1, color: Colors.textMuted }}>🔍</Text>
          <TextInput
            style={s.searchInput}
            placeholder={t('consumables.searchPlaceholder')}
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      <FlatList
        data={visibleDisplayedItems}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        extraData={{ selectMode, nSel: selectedIds.length }}
        contentContainerStyle={{ padding: 20, paddingTop: 10 }}
        ListHeaderComponent={
          selectMode ? (
            <View style={s.selectBanner}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.selectBannerTitle}>
                  {selectedIds.length} {t('consumables.select.count_suffix')}
                  {selectedIds.length > 1 ? 's' : ''} {t('consumables.select.filtered')}
                </Text>
                <Text style={s.selectBannerHint}>{t('consumables.select.hint')}</Text>
              </View>
              <TouchableOpacity
                onPress={exitSelectMode}
                style={s.selectPill}
                disabled={deleteBusy}
              >
                <Text style={s.selectPillText}>{t('consumables.select.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={toggleSelectAllFiltered}
                style={s.selectPill}
                disabled={deleteBusy || filteredIds.length === 0}
              >
                <Text style={s.selectPillText}>
                  {allFilteredSelected ? t('consumables.select.none') : t('consumables.select.all')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => void handleBulkDelete()}
                style={[
                  s.selectPill,
                  s.selectPillDanger,
                  (deleteBusy || selectedIds.length === 0) && { opacity: 0.45 },
                ]}
                disabled={deleteBusy || selectedIds.length === 0}
                accessibilityRole="button"
                accessibilityLabel={t('consumables.select.delete')}
              >
                {deleteBusy ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={s.selectPillTextDanger}>🗑 {t('consumables.select.delete')}</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : null
        }
        initialNumToRender={12}
        maxToRenderPerBatch={16}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
        onEndReachedThreshold={0.45}
        onEndReached={() => {
          if (visibleCount < displayedItems.length) {
            setVisibleCount(c => Math.min(c + CONSO_LIST_PAGE_SIZE, displayedItems.length));
          }
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.green} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={{ fontSize: 40 }}>🛒</Text>
            <Text style={{ color: Colors.textMuted, marginTop: 12 }}>
              {filterLowStock
                ? t('consumables.emptyLow')
                : debouncedSearch.trim()
                  ? t('consumables.emptySearch')
                  : t('consumables.empty')}
            </Text>
          </View>
        }
      />

      <ConsoModal
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
        onCategoriesRefresh={load}
        item={editItem}
        categories={categories}
        localisations={localisations}
        initialQr={route.params?.newQr}
        initialNfc={route.params?.newNfc}
      />

      <ShelfLabelsModal
        visible={showShelfModal}
        onClose={() => setShowShelfModal(false)}
        title={t('consumables.shelfLabelsTitle')}
        items={visibleDisplayedItems.map(c => ({
          id: c.id,
          title: c.nom,
          subtitle: [c.reference, (c as any).localisation_nom].filter(Boolean).join(' · '),
        }))}
      />

      <BurstQtyNumpadModal
        visible={!!adjustTarget}
        productName={adjustTarget?.nom ?? ''}
        stockHint={
          adjustTarget
            ? t('consumables.stockCurrent', { stock: adjustTarget.stock_actuel, unit: adjustTarget.unite })
            : undefined
        }
        unite={adjustTarget?.unite ?? 'pièce'}
        moveType={adjustMoveType}
        initialQtyString="1"
        onCancel={() => setAdjustTarget(null)}
        onConfirm={qty => void applyAdjustQty(qty)}
      />
    </TabScreenSafeArea>
  );
}

// ── Modal Consommable ────────────────────────────────────────────────────────
function ConsoModal({ visible, onClose, onSaved, onCategoriesRefresh, item, categories, localisations, initialQr, initialNfc }: {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  onCategoriesRefresh?: () => void | Promise<void>;
  item: Consommable | null;
  categories: Categorie[];
  localisations: Localisation[];
  initialQr?: string;
  initialNfc?: string;
}) {
  const { t } = useLanguage();
  const [nom, setNom] = useState('');
  const [reference, setReference] = useState('');
  const [unite, setUnite] = useState('pièce');
  const [stockActuel, setStockActuel] = useState('0');
  const [seuilMin, setSeuilMin] = useState('5');
  const [categorieId, setCategorieId] = useState('');
  const [localisationId, setLocalisationId] = useState('');
  const [fournisseur, setFournisseur] = useState('');
  const [prix, setPrix] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [nfcTagId, setNfcTagId] = useState('');
  const [saving, setSaving] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatParentId, setNewCatParentId] = useState('');
  const [newLocalisationName, setNewLocalisationName] = useState('');
  const [photoLocal, setPhotoLocal] = useState('');
  const [gelBrand, setGelBrand] = useState<'' | GelBrand>('');
  const [gelCode, setGelCode] = useState('');
  const [gelInsteadOfPhoto, setGelInsteadOfPhoto] = useState(false);

  const gelRefOptions = useMemo(() => {
    if (!gelBrand) return [{ label: '—', value: '' }];
    return [{ label: t('common.chooseLongDash'), value: '' }, ...gelPickerOptions(gelBrand)];
  }, [gelBrand, t]);

  const gelPreview = useMemo(
    () => (gelBrand && gelCode.trim() ? getGelSwatch(gelBrand, gelCode.trim()) : null),
    [gelBrand, gelCode]
  );

  const sortedCats = useMemo(
    () =>
      [...categories].sort((a, b) =>
        categoryPathById(categories, a.id).localeCompare(categoryPathById(categories, b.id), 'fr', {
          sensitivity: 'base',
        })
      ),
    [categories]
  );

  const catOptions = useMemo(
    () => [
      { label: t('common.none'), value: '' },
      ...sortedCats.map(c => ({
        label: categoryPathById(categories, c.id) || c.nom,
        value: c.id,
      })),
    ],
    [categories, sortedCats, t]
  );

  const parentCreateOptions = useMemo(
    () => [
      { label: t('consumables.category.rootMain'), value: '' },
      ...sortedCats.map(c => ({
        label: categoryPathById(categories, c.id) || c.nom,
        value: c.id,
      })),
    ],
    [categories, sortedCats, t]
  );

  useEffect(() => {
    if (!visible) return;
    setNewCatName('');
    setNewCatParentId('');
    setNewLocalisationName('');
    if (item) {
      setNom(item.nom); setReference(item.reference ?? ''); setUnite(item.unite);
      setStockActuel(item.stock_actuel.toString()); setSeuilMin(item.seuil_minimum.toString());
      setCategorieId(item.categorie_id ?? ''); setLocalisationId(item.localisation_id ?? '');
      setFournisseur(item.fournisseur ?? ''); setPrix(item.prix_unitaire?.toString() ?? '');
      setQrCode(item.qr_code ?? ''); setNfcTagId(item.nfc_tag_id ?? '');
      setPhotoLocal(item.photo_local ?? '');
      setGelBrand(item.gel_brand === 'lee' || item.gel_brand === 'rosco' ? item.gel_brand : '');
      setGelCode(item.gel_code ?? '');
      setGelInsteadOfPhoto(!!item.gel_instead_of_photo);
    } else {
      setNom(''); setReference(''); setUnite('pièce'); setStockActuel('0'); setSeuilMin('5');
      setCategorieId(''); setLocalisationId(''); setFournisseur(''); setPrix('');
      setQrCode(initialQr ?? '');
      setNfcTagId(initialNfc ?? '');
      setPhotoLocal('');
      setGelBrand('');
      setGelCode('');
      setGelInsteadOfPhoto(false);
    }
  }, [visible, item, initialQr, initialNfc]);

  const handlePhoto = async () => {
    const draftId = item?.id ?? `draft-${Date.now()}`;
    Alert.alert(t('consumables.photo.title'), t('consumables.photo.source'), [
      {
        text: t('consumables.photo.camera'),
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) return;
          const res = await ImagePicker.launchCameraAsync({
            quality: 0.65,
            allowsEditing: true,
            aspect: [4, 3],
          });
          if (!res.canceled) {
            try {
              const dest = await persistConsommablePhotoCopy(draftId, res.assets[0].uri);
              setPhotoLocal(dest);
            } catch {
              setPhotoLocal(res.assets[0].uri);
            }
          }
        },
      },
      {
        text: t('consumables.photo.gallery'),
        onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) return;
          const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.65 });
          if (!res.canceled) {
            try {
              const dest = await persistConsommablePhotoCopy(draftId, res.assets[0].uri);
              setPhotoLocal(dest);
            } catch {
              setPhotoLocal(res.assets[0].uri);
            }
          }
        },
      },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const handleCreateCategory = async () => {
    const n = newCatName.trim();
    if (!n) {
      Alert.alert(t('consumables.category.nameRequired'), t('consumables.category.nameRequiredBody'));
      return;
    }
    try {
      const pid = newCatParentId.trim() || null;
      const id = await insertCategorie(n, pid);
      await onCategoriesRefresh?.();
      setCategorieId(id);
      setNewCatName('');
      setNewCatParentId('');
      Alert.alert('✓', t('consumables.category.created'));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert(t('scanner.error'), msg);
    }
  };

  const handleCreateLocalisation = async () => {
    const name = newLocalisationName.trim();
    if (!name) {
      Alert.alert(t('consumables.location.nameRequired'), t('consumables.location.nameRequiredBody'));
      return;
    }
    try {
      const id = await insertLocalisation(name);
      await onCategoriesRefresh?.();
      setLocalisationId(id);
      setNewLocalisationName('');
      Alert.alert('✓', t('consumables.location.created'));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert(t('scanner.error'), msg);
    }
  };

  const handleSave = async () => {
    if (!nom.trim()) { Alert.alert(t('consumables.field.required'), t('consumables.field.nameRequired')); return; }
    setSaving(true);
    try {
      const gelPatch =
        gelBrand === 'lee' || gelBrand === 'rosco'
          ? {
              gel_brand: gelBrand,
              gel_code: gelCode.trim() || null,
              gel_instead_of_photo: gelInsteadOfPhoto ? 1 : 0,
            }
          : { gel_brand: null as null, gel_code: null as null, gel_instead_of_photo: 0 };
      const data = {
        nom: nom.trim(),
        reference: reference || undefined,
        unite,
        stock_actuel: parseInt(stockActuel) || 0,
        seuil_minimum: parseInt(seuilMin) || 5,
        categorie_id: categorieId || undefined,
        localisation_id: localisationId || undefined,
        fournisseur: fournisseur || undefined,
        prix_unitaire: prix ? parseFloat(prix) : undefined,
        qr_code: qrCode || undefined,
        nfc_tag_id: nfcTagId || undefined,
        photo_local: photoLocal.trim() ? photoLocal : null,
        ...gelPatch,
      };
      let savedId: string;
      if (item) {
        await updateConsommable(item.id, data);
        savedId = item.id;
      } else {
        savedId = await insertConsommable(data as any);
      }
      let finalPhotoLocal = photoLocal.trim() || null;
      if (finalPhotoLocal) {
        try {
          if (!finalPhotoLocal.includes(`/consommables/${savedId}/`)) {
            finalPhotoLocal = await persistConsommablePhotoCopy(savedId, finalPhotoLocal);
          }
          await updateConsommable(savedId, { photo_local: finalPhotoLocal });
        } catch {
          /* garder le chemin saisi */
        }
        if (isSupabaseConfigured()) {
          const url = await uploadConsommablePhoto(finalPhotoLocal, savedId);
          if (url) await updateConsommable(savedId, { photo_url: url });
        }
      }
      onSaved();
      void triggerSyncAfterActionIfEnabled();
      onClose();
    } catch (e: any) {
      Alert.alert(t('scanner.error'), e.message);
    } finally {
      setSaving(false);
    }
  };

  const locOptions = [{ label: t('common.none'), value: '' }, ...localisations.map(l => ({ label: l.nom, value: l.id }))];

  return (
    <BottomModal
      visible={visible}
      onClose={onClose}
      title={item ? t('consumables.modal.edit') : t('consumables.modal.add')}
    >
      <Input label={t('consumables.field.name')} value={nom} onChangeText={setNom} required />

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Input label={t('consumables.field.reference')} value={reference} onChangeText={setReference} />
        </View>
        <View style={{ flex: 1 }}>
          <SelectPicker label={t('consumables.field.unit')} value={unite} options={CONSOMMABLE_UNITE_OPTIONS} onChange={setUnite} />
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Input label={t('consumables.field.stockCurrent')} value={stockActuel} onChangeText={setStockActuel} keyboardType="numeric" />
        </View>
        <View style={{ flex: 1 }}>
          <Input label={t('consumables.field.stockMin')} value={seuilMin} onChangeText={setSeuilMin} keyboardType="numeric" />
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <SelectPicker label={t('consumables.field.category')} value={categorieId} options={catOptions} onChange={setCategorieId} />
        </View>
        <View style={{ flex: 1 }}>
          <SelectPicker label={t('consumables.field.location')} value={localisationId} options={locOptions} onChange={setLocalisationId} />
        </View>
      </View>

      <View style={s.consoMetaBlock}>
        <Text style={s.consoMetaHint}>{t('consumables.category.createHint')}</Text>
        <SelectPicker
          label={t('consumables.category.parentOptional')}
          value={newCatParentId}
          options={parentCreateOptions}
          onChange={setNewCatParentId}
        />
        <Input
          label={t('consumables.category.newName')}
          value={newCatName}
          onChangeText={setNewCatName}
          placeholder={t('consumables.category.newPlaceholder')}
          onSubmitEditing={handleCreateCategory}
          returnKeyType="done"
        />
        <TouchableOpacity style={s.consoMetaBtn} onPress={handleCreateCategory}>
          <Text style={s.consoMetaBtnText}>{t('consumables.category.create')}</Text>
        </TouchableOpacity>
      </View>

      <View style={s.consoMetaBlock}>
        <Text style={s.consoMetaHint}>{t('consumables.location.createHint')}</Text>
        <Input
          label={t('consumables.location.newName')}
          value={newLocalisationName}
          onChangeText={setNewLocalisationName}
          placeholder={t('consumables.location.newPlaceholder')}
          onSubmitEditing={handleCreateLocalisation}
          returnKeyType="done"
        />
        <TouchableOpacity style={s.consoMetaBtn} onPress={handleCreateLocalisation}>
          <Text style={s.consoMetaBtnText}>{t('consumables.location.create')}</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Input label={t('consumables.field.supplier')} value={fournisseur} onChangeText={setFournisseur} />
        </View>
        <View style={{ flex: 1 }}>
          <Input label={t('consumables.field.unitPrice')} value={prix} onChangeText={setPrix} keyboardType="decimal-pad" />
        </View>
      </View>

      {!item ? (
        <>
          <Text style={{ color: Colors.textMuted, fontSize: 12, marginBottom: 8 }}>
            {t('consumables.qrHint')}
          </Text>
          <Input
            label={t('consumables.field.customQr')}
            value={qrCode}
            onChangeText={setQrCode}
            placeholder={t('consumables.field.customQrPlaceholder')}
          />
        </>
      ) : (
        <Input label={t('consumables.field.qrCode')} value={qrCode} onChangeText={setQrCode} placeholder={t('consumables.field.scanOrType')} />
      )}
      <Input label={t('consumables.field.nfcTag')} value={nfcTagId} onChangeText={setNfcTagId} />

      <Text style={s.consoSectionLabel}>{t('consumables.photo.title')}</Text>
      <TouchableOpacity style={s.consoPhotoBox} onPress={handlePhoto} activeOpacity={0.85}>
        {photoLocal ? (
          <Image source={{ uri: photoLocal }} style={s.consoPhoto} />
        ) : (
          <View style={s.consoPhotoPlaceholder}>
            <Text style={{ fontSize: 28 }}>📷</Text>
            <Text style={{ color: Colors.textMuted, fontSize: 12, marginTop: 6 }}>
              {t('consumables.photo.pick')}
            </Text>
          </View>
        )}
      </TouchableOpacity>
      {!!photoLocal && (
        <TouchableOpacity
          style={{ alignSelf: 'flex-start', marginBottom: 12 }}
          onPress={() => setPhotoLocal('')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={{ color: Colors.textMuted, fontSize: 12 }}>{t('consumables.photo.remove')}</Text>
        </TouchableOpacity>
      )}

      <Text style={s.consoSectionLabel}>{t('consumables.gel.title')}</Text>
      <Text style={s.consoSectionHint}>
        {t('consumables.gel.hint')}
      </Text>
      <SelectPicker
        label={t('consumables.gel.brand')}
        value={gelBrand}
        options={GEL_BRAND_OPTIONS}
        onChange={v => {
          const b = v as '' | GelBrand;
          setGelBrand(b);
          setGelCode('');
        }}
      />
      {!!gelBrand && (
        <>
          <SelectPicker
            label={t('consumables.gel.referenceList')}
            value={gelCode && gelRefOptions.some(o => o.value === gelCode) ? gelCode : ''}
            options={gelRefOptions}
            onChange={setGelCode}
          />
          <Input
            label={t('consumables.gel.numberFree')}
            value={gelCode}
            onChangeText={setGelCode}
            placeholder={gelBrand === 'lee' ? 'ex. 201' : 'ex. 09'}
          />
          {gelPreview ? (
            <View style={s.consoGelPreviewRow}>
              <View style={[s.consoGelSwatch, { backgroundColor: gelPreview.hex }]} />
              <Text style={s.consoGelPreviewText}>{gelPreview.name}</Text>
            </View>
          ) : null}
          <TouchableOpacity
            style={[s.consoGelToggle, gelInsteadOfPhoto && s.consoGelToggleOn]}
            onPress={() => setGelInsteadOfPhoto(v => !v)}
            activeOpacity={0.85}
          >
            <Text style={{ color: Colors.white, fontSize: 14, fontWeight: '600', flex: 1 }}>
              {t('consumables.gel.showInsteadPhoto')}
            </Text>
            <Text style={{ color: gelInsteadOfPhoto ? Colors.green : Colors.textMuted, fontWeight: '800' }}>
              {gelInsteadOfPhoto ? t('common.yes') : t('common.no')}
            </Text>
          </TouchableOpacity>
        </>
      )}

      <FormButtons onCancel={onClose} onSave={handleSave} loading={saving} />
    </BottomModal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  searchRow: { position: 'relative', marginTop: 10, marginBottom: 4 },
  searchInput: {
    backgroundColor: Colors.bgCard,
    borderRadius: 10,
    paddingLeft: 38,
    paddingRight: 12,
    paddingVertical: 9,
    color: Colors.white,
    fontSize: 13,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  name: { color: Colors.white, fontSize: 16, fontWeight: '600' },
  sub: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8, gap: 4, alignItems: 'center' },
  shelfBtn: {
    marginTop: 8,
    marginBottom: 6,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  shelfBtnText: { color: Colors.white, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  adjBtn: { backgroundColor: Colors.green, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginRight: 4 },
  qrBtn: { borderWidth: 1, borderColor: Colors.green, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginRight: 4 },
  qrBtnText: { color: Colors.green, fontSize: 12, fontWeight: '700' },
  iconBtn: { padding: 6 },
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
  selectPillDanger: { backgroundColor: Colors.red, borderColor: Colors.red },
  selectPillText: { color: Colors.textSecondary, fontWeight: '700', fontSize: 13 },
  selectPillTextDanger: { color: Colors.white, fontWeight: '800', fontSize: 13 },
  cardSelected: { borderColor: Colors.green, borderWidth: 2 },
  cardSelectMode: { borderColor: Colors.border },
  selectMark: { marginRight: 8, justifyContent: 'center' },
  selectMarkText: { fontSize: 20, color: Colors.green },
  empty: { alignItems: 'center', marginTop: 60 },
  consoMetaBlock: {
    marginTop: 4,
    marginBottom: 8,
    padding: 12,
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  consoMetaHint: { color: Colors.textMuted, fontSize: 12, marginBottom: 10 },
  consoMetaBtn: {
    backgroundColor: Colors.green,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  consoMetaBtnText: { color: Colors.white, fontWeight: '700' },
  consoSectionLabel: { color: Colors.textPrimary, fontSize: 13, fontWeight: '600', marginBottom: 4, marginTop: 8 },
  consoSectionHint: { color: Colors.textMuted, fontSize: 11, marginBottom: 10, lineHeight: 15 },
  consoPhotoBox: { borderRadius: 12, overflow: 'hidden', marginBottom: 12, height: 140 },
  consoPhoto: { width: '100%', height: '100%' },
  consoPhotoPlaceholder: {
    backgroundColor: Colors.bgInput,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    borderStyle: 'dashed',
  },
  consoGelPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  consoGelSwatch: { width: 48, height: 48, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  consoGelPreviewText: { color: Colors.textSecondary, fontSize: 13, flex: 1 },
  consoGelToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
    backgroundColor: Colors.bgCard,
  },
  consoGelToggleOn: { borderColor: Colors.green, backgroundColor: Colors.greenBg },
});

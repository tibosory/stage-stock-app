// src/screens/ConsommablesScreen.tsx
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, RefreshControl, Platform, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { Colors } from '../theme/colors';
import {
  getConsommables, insertConsommable, updateConsommable,
  deleteConsommable, ajusterStock, getCategories, getLocalisations,
  getConsommableById,
  insertCategorie,
  categoryPathById,
} from '../db/database';
import { Consommable, Categorie, Localisation } from '../types';
import {
  StockBadge, Card, ScreenHeader, BottomModal,
  Input, SelectPicker, FormButtons, TabScreenSafeArea,
} from '../components/UI';
import { useAppAuth } from '../context/AuthContext';
import ShelfLabelsModal from '../components/ShelfLabelsModal';
import { triggerSyncAfterActionIfEnabled } from '../lib/syncAfterAction';
import { uploadConsommablePhoto } from '../lib/supabase';
import {
  GEL_BRAND_OPTIONS,
  gelPickerOptions,
  getGelSwatch,
  type GelBrand,
} from '../lib/gelFilters';

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

export default function ConsommablesScreen() {
  const { can } = useAppAuth();
  const editOk = can('edit_inventory');
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [items, setItems] = useState<Consommable[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Consommable | null>(null);
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [localisations, setLocalisations] = useState<Localisation[]>([]);
  const [showShelfModal, setShowShelfModal] = useState(false);

  const load = useCallback(async () => {
    const [data, cats, locs] = await Promise.all([
      getConsommables(), getCategories(), getLocalisations(),
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
    () => (filterLowStock ? items.filter(c => c.stock_actuel <= c.seuil_minimum) : items),
    [items, filterLowStock]
  );

  useFocusEffect(
    useCallback(() => {
      const openId = route.params?.openConsoId as string | undefined;
      if (!openId) return;
      (async () => {
        const c = await getConsommableById(openId);
        if (c) {
          Alert.alert(
            c.nom,
            `Stock actuel : ${c.stock_actuel} ${c.unite}`,
            [
              {
                text: '-1',
                onPress: () =>
                  ajusterStock(c.id, -1).then(() => {
                    load();
                    void triggerSyncAfterActionIfEnabled();
                  }),
              },
              {
                text: '-5',
                onPress: () =>
                  ajusterStock(c.id, -5).then(() => {
                    load();
                    void triggerSyncAfterActionIfEnabled();
                  }),
              },
              {
                text: '+5',
                onPress: () =>
                  ajusterStock(c.id, 5).then(() => {
                    load();
                    void triggerSyncAfterActionIfEnabled();
                  }),
              },
              {
                text: '+1',
                onPress: () =>
                  ajusterStock(c.id, 1).then(() => {
                    load();
                    void triggerSyncAfterActionIfEnabled();
                  }),
              },
              { text: 'Fermer', style: 'cancel' },
            ]
          );
        }
        navigation.setParams({ openConsoId: undefined });
      })();
    }, [route.params?.openConsoId, navigation, load])
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
    await load();
    setRefreshing(false);
  };

  const handleAjusterStock = useCallback((item: Consommable) => {
    if (!editOk) return;
    Alert.alert(
      item.nom,
      `Stock actuel : ${item.stock_actuel} ${item.unite}`,
      [
        {
          text: '-1',
          onPress: () =>
            ajusterStock(item.id, -1).then(() => {
              load();
              void triggerSyncAfterActionIfEnabled();
            }),
        },
        {
          text: '-5',
          onPress: () =>
            ajusterStock(item.id, -5).then(() => {
              load();
              void triggerSyncAfterActionIfEnabled();
            }),
        },
        {
          text: '+5',
          onPress: () =>
            ajusterStock(item.id, 5).then(() => {
              load();
              void triggerSyncAfterActionIfEnabled();
            }),
        },
        {
          text: '+1',
          onPress: () =>
            ajusterStock(item.id, 1).then(() => {
              load();
              void triggerSyncAfterActionIfEnabled();
            }),
        },
        { text: 'Annuler', style: 'cancel' },
      ]
    );
  }, [editOk, load]);

  const handleDelete = useCallback((item: Consommable) => {
    if (!editOk) return;
    Alert.alert('Supprimer', `Supprimer "${item.nom}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => {
          await deleteConsommable(item.id);
          load();
          void triggerSyncAfterActionIfEnabled();
        }
      },
    ]);
  }, [editOk, load]);

  const renderItem = useCallback(({ item }: { item: Consommable }) => {
    const stockBas = item.stock_actuel <= item.seuil_minimum;
    const photoUri = item.photo_local ?? item.photo_url;
    const hasGel = !!(item.gel_brand && item.gel_code?.trim());
    const preferGel = !!(item.gel_instead_of_photo && hasGel);
    const gelSw = hasGel ? getGelSwatch(item.gel_brand, item.gel_code!.trim()) : null;
    return (
      <Card style={stockBas ? { borderWidth: 1, borderColor: Colors.red } : {}}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
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
            {stockBas && <Text style={{ color: Colors.red, fontSize: 11, fontWeight: '600' }}>Stock bas</Text>}
          </View>
        </View>

        <View style={s.actions}>
          {editOk && (
            <TouchableOpacity onPress={() => handleAjusterStock(item)} style={s.adjBtn}>
              <Text style={{ color: Colors.white, fontSize: 12 }}>± Ajuster</Text>
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
            <TouchableOpacity onPress={() => handleDelete(item)} style={s.iconBtn}>
              <Text style={{ color: Colors.red, fontSize: 18 }}>🗑️</Text>
            </TouchableOpacity>
          )}
        </View>
      </Card>
    );
  }, [editOk, handleAjusterStock, handleDelete]);

  const keyExtractor = useCallback((item: Consommable) => item.id, []);

  return (
    <TabScreenSafeArea style={s.container}>
      <View style={{ padding: 20, paddingBottom: 0 }}>
        <ScreenHeader
          icon={<Text style={{ fontSize: 22, color: Colors.green }}>🛒</Text>}
          title="Consommables"
          rightLabel={editOk ? 'Ajouter' : undefined}
          onRightPress={editOk ? () => { setEditItem(null); setShowModal(true); } : undefined}
        />
        {editOk && (
          <TouchableOpacity
            style={s.shelfBtn}
            onPress={() => setShowShelfModal(true)}
            activeOpacity={0.85}
          >
            <Text style={s.shelfBtnText}>🏷 Étiquettes rayonnage / bac (liste affichée)</Text>
          </TouchableOpacity>
        )}
        {filterLowStock ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
            <Text style={{ color: Colors.red, fontSize: 12, fontWeight: '600' }}>Filtre : stock ≤ seuil</Text>
            <TouchableOpacity onPress={() => navigation.setParams({ filterLowStock: false } as never)}>
              <Text style={{ color: Colors.green, fontSize: 12, fontWeight: '700' }}>Tout afficher</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <FlatList
        data={displayedItems}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={{ padding: 20, paddingTop: 10 }}
        initialNumToRender={12}
        maxToRenderPerBatch={16}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.green} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={{ fontSize: 40 }}>🛒</Text>
            <Text style={{ color: Colors.textMuted, marginTop: 12 }}>
              {filterLowStock ? 'Aucun consommable sous le seuil' : 'Aucun consommable'}
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
        onSaved={load}
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
        title="Étiquettes rayonnage (consommables)"
        items={displayedItems.map(c => ({
          id: c.id,
          title: c.nom,
          subtitle: [
            c.reference,
            (c as any).localisation_nom,
            `${c.stock_actuel}/${c.seuil_minimum} ${c.unite}`,
          ]
            .filter(Boolean)
            .join(' · '),
        }))}
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
  const [photoLocal, setPhotoLocal] = useState('');
  const [gelBrand, setGelBrand] = useState<'' | GelBrand>('');
  const [gelCode, setGelCode] = useState('');
  const [gelInsteadOfPhoto, setGelInsteadOfPhoto] = useState(false);

  const gelRefOptions = useMemo(() => {
    if (!gelBrand) return [{ label: '—', value: '' }];
    return [{ label: '— Choisir —', value: '' }, ...gelPickerOptions(gelBrand)];
  }, [gelBrand]);

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
      { label: 'Aucune', value: '' },
      ...sortedCats.map(c => ({
        label: categoryPathById(categories, c.id) || c.nom,
        value: c.id,
      })),
    ],
    [categories, sortedCats]
  );

  const parentCreateOptions = useMemo(
    () => [
      { label: '— Racine (catégorie principale) —', value: '' },
      ...sortedCats.map(c => ({
        label: categoryPathById(categories, c.id) || c.nom,
        value: c.id,
      })),
    ],
    [categories, sortedCats]
  );

  useEffect(() => {
    if (!visible) return;
    setNewCatName('');
    setNewCatParentId('');
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
    Alert.alert('Photo', 'Source', [
      {
        text: 'Caméra',
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) return;
          const res = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: true, aspect: [4, 3] });
          if (!res.canceled) setPhotoLocal(res.assets[0].uri);
        },
      },
      {
        text: 'Galerie',
        onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) return;
          const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
          if (!res.canceled) setPhotoLocal(res.assets[0].uri);
        },
      },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  const handleCreateCategory = async () => {
    const n = newCatName.trim();
    if (!n) {
      Alert.alert('Nom requis', 'Indiquez le nom de la catégorie ou sous-catégorie.');
      return;
    }
    try {
      const pid = newCatParentId.trim() || null;
      const id = await insertCategorie(n, pid);
      await onCategoriesRefresh?.();
      setCategorieId(id);
      setNewCatName('');
      setNewCatParentId('');
      Alert.alert('✓', 'Catégorie créée et associée à ce consommable.');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert('Erreur', msg);
    }
  };

  const handleSave = async () => {
    if (!nom.trim()) { Alert.alert('Champ requis', 'Le nom est obligatoire'); return; }
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
      if (photoLocal?.trim()) {
        void uploadConsommablePhoto(photoLocal, savedId).then(url => {
          if (url) void updateConsommable(savedId, { photo_url: url });
        });
      }
      onSaved();
      void triggerSyncAfterActionIfEnabled();
      onClose();
    } catch (e: any) {
      Alert.alert('Erreur', e.message);
    } finally {
      setSaving(false);
    }
  };

  const locOptions = [{ label: 'Aucune', value: '' }, ...localisations.map(l => ({ label: l.nom, value: l.id }))];

  return (
    <BottomModal
      visible={visible}
      onClose={onClose}
      title={item ? 'Modifier un consommable' : 'Ajouter un consommable'}
    >
      <Input label="Nom" value={nom} onChangeText={setNom} required />

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Input label="Référence" value={reference} onChangeText={setReference} />
        </View>
        <View style={{ flex: 1 }}>
          <SelectPicker label="Unité" value={unite} options={CONSOMMABLE_UNITE_OPTIONS} onChange={setUnite} />
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Input label="Stock actuel" value={stockActuel} onChangeText={setStockActuel} keyboardType="numeric" />
        </View>
        <View style={{ flex: 1 }}>
          <Input label="Seuil minimum" value={seuilMin} onChangeText={setSeuilMin} keyboardType="numeric" />
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <SelectPicker label="Catégorie" value={categorieId} options={catOptions} onChange={setCategorieId} />
        </View>
        <View style={{ flex: 1 }}>
          <SelectPicker label="Localisation" value={localisationId} options={locOptions} onChange={setLocalisationId} />
        </View>
      </View>

      <View
        style={{
          marginTop: 4,
          marginBottom: 8,
          padding: 12,
          backgroundColor: Colors.bgCard,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: Colors.border,
        }}
      >
        <Text style={{ color: Colors.textMuted, fontSize: 12, marginBottom: 10 }}>
          Créer une catégorie ou sous-catégorie (ex. Scotch › Scotch PVC › PVC blanc 50×50). La nouvelle catégorie est
          tout de suite sélectionnée pour ce consommable.
        </Text>
        <SelectPicker
          label="Parent (optionnel)"
          value={newCatParentId}
          options={parentCreateOptions}
          onChange={setNewCatParentId}
        />
        <Input
          label="Nom de la nouvelle catégorie"
          value={newCatName}
          onChangeText={setNewCatName}
          placeholder="ex. Scotch PVC"
          onSubmitEditing={handleCreateCategory}
          returnKeyType="done"
        />
        <TouchableOpacity
          style={{
            backgroundColor: Colors.green,
            borderRadius: 10,
            paddingVertical: 12,
            alignItems: 'center',
            marginTop: 8,
          }}
          onPress={handleCreateCategory}
        >
          <Text style={{ color: Colors.white, fontWeight: '700' }}>Créer la catégorie</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Input label="Fournisseur" value={fournisseur} onChangeText={setFournisseur} />
        </View>
        <View style={{ flex: 1 }}>
          <Input label="Prix unitaire (€)" value={prix} onChangeText={setPrix} keyboardType="decimal-pad" />
        </View>
      </View>

      {!item ? (
        <>
          <Text style={{ color: Colors.textMuted, fontSize: 12, marginBottom: 8 }}>
            Code QR : identifiant interne attribué automatiquement si vous laissez vide.
          </Text>
          <Input
            label="QR personnalisé (optionnel)"
            value={qrCode}
            onChangeText={setQrCode}
            placeholder="Vide = ID auto"
          />
        </>
      ) : (
        <Input label="QR Code" value={qrCode} onChangeText={setQrCode} placeholder="Scannez ou saisissez" />
      )}
      <Input label="Tag NFC ID" value={nfcTagId} onChangeText={setNfcTagId} />

      <Text style={s.consoSectionLabel}>Photo</Text>
      <TouchableOpacity style={s.consoPhotoBox} onPress={handlePhoto} activeOpacity={0.85}>
        {photoLocal ? (
          <Image source={{ uri: photoLocal }} style={s.consoPhoto} />
        ) : (
          <View style={s.consoPhotoPlaceholder}>
            <Text style={{ fontSize: 28 }}>📷</Text>
            <Text style={{ color: Colors.textMuted, fontSize: 12, marginTop: 6 }}>
              Prendre / choisir une photo
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
          <Text style={{ color: Colors.textMuted, fontSize: 12 }}>Retirer la photo</Text>
        </TouchableOpacity>
      )}

      <Text style={s.consoSectionLabel}>Couleur gel (éclairage)</Text>
      <Text style={s.consoSectionHint}>
        Référentiels Lee Filters et Rosco Supergel (teintes indicatives). Numéro libre possible.
      </Text>
      <SelectPicker
        label="Marque"
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
            label="Référence (liste courante)"
            value={gelCode && gelRefOptions.some(o => o.value === gelCode) ? gelCode : ''}
            options={gelRefOptions}
            onChange={setGelCode}
          />
          <Input
            label="Numéro (saisie libre)"
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
              Afficher la couleur gel à la place de la photo (liste)
            </Text>
            <Text style={{ color: gelInsteadOfPhoto ? Colors.green : Colors.textMuted, fontWeight: '800' }}>
              {gelInsteadOfPhoto ? 'Oui' : 'Non'}
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
  iconBtn: { padding: 6 },
  empty: { alignItems: 'center', marginTop: 60 },
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

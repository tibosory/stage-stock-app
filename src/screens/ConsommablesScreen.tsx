// src/screens/ConsommablesScreen.tsx
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { Colors } from '../theme/colors';
import {
  getConsommables, insertConsommable, updateConsommable,
  deleteConsommable, ajusterStock, getCategories, getLocalisations,
  getConsommableById,
} from '../db/database';
import { Consommable, Categorie, Localisation } from '../types';
import {
  StockBadge, Card, ScreenHeader, BottomModal,
  Input, SelectPicker, FormButtons
} from '../components/UI';
import { useAuth } from '../context/AuthContext';

export default function ConsommablesScreen() {
  const { can } = useAuth();
  const editOk = can('edit_inventory');
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [items, setItems] = useState<Consommable[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Consommable | null>(null);
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [localisations, setLocalisations] = useState<Localisation[]>([]);

  const load = useCallback(async () => {
    const [data, cats, locs] = await Promise.all([
      getConsommables(), getCategories(), getLocalisations(),
    ]);
    setItems(data);
    setCategories(cats);
    setLocalisations(locs);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

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
              { text: '-1', onPress: () => ajusterStock(c.id, -1).then(load) },
              { text: '-5', onPress: () => ajusterStock(c.id, -5).then(load) },
              { text: '+5', onPress: () => ajusterStock(c.id, 5).then(load) },
              { text: '+1', onPress: () => ajusterStock(c.id, 1).then(load) },
              { text: 'Fermer', style: 'cancel' },
            ]
          );
        }
        navigation.setParams({ openConsoId: undefined });
      })();
    }, [route.params?.openConsoId, navigation, load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleAjusterStock = (item: Consommable) => {
    if (!editOk) return;
    Alert.alert(
      item.nom,
      `Stock actuel : ${item.stock_actuel} ${item.unite}`,
      [
        { text: '-1', onPress: () => ajusterStock(item.id, -1).then(load) },
        { text: '-5', onPress: () => ajusterStock(item.id, -5).then(load) },
        { text: '+5', onPress: () => ajusterStock(item.id, 5).then(load) },
        { text: '+1', onPress: () => ajusterStock(item.id, 1).then(load) },
        { text: 'Annuler', style: 'cancel' },
      ]
    );
  };

  const handleDelete = (item: Consommable) => {
    if (!editOk) return;
    Alert.alert('Supprimer', `Supprimer "${item.nom}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: async () => { await deleteConsommable(item.id); load(); }
      },
    ]);
  };

  const renderItem = ({ item }: { item: Consommable }) => {
    const stockBas = item.stock_actuel <= item.seuil_minimum;
    return (
      <Card style={stockBas ? { borderWidth: 1, borderColor: Colors.red } : {}}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={s.name}>{item.nom}</Text>
            <Text style={s.sub}>
              {item.reference ? item.reference + ' · ' : ''}
              {(item as any).fournisseur ? (item as any).fournisseur : ''}
            </Text>
            {(item as any).localisation_nom && (
              <Text style={s.sub}>{(item as any).localisation_nom}</Text>
            )}
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
              <Text style={{ color: Colors.textMuted, fontSize: 18 }}>⊞</Text>
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
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={{ padding: 20, paddingBottom: 0 }}>
        <ScreenHeader
          icon={<Text style={{ fontSize: 22, color: Colors.green }}>🛒</Text>}
          title="Consommables"
          rightLabel={editOk ? 'Ajouter' : undefined}
          onRightPress={editOk ? () => { setEditItem(null); setShowModal(true); } : undefined}
        />
      </View>

      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item: Consommable) => item.id}
        contentContainerStyle={{ padding: 20, paddingTop: 10 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.green} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={{ fontSize: 40 }}>🛒</Text>
            <Text style={{ color: Colors.textMuted, marginTop: 12 }}>Aucun consommable</Text>
          </View>
        }
      />

      <ConsoModal
        visible={showModal}
        onClose={() => { setShowModal(false); setEditItem(null); }}
        onSaved={load}
        item={editItem}
        categories={categories}
        localisations={localisations}
      />
    </SafeAreaView>
  );
}

// ── Modal Consommable ────────────────────────────────────────────────────────
function ConsoModal({ visible, onClose, onSaved, item, categories, localisations }: {
  visible: boolean; onClose: () => void; onSaved: () => void;
  item: Consommable | null; categories: Categorie[]; localisations: Localisation[];
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

  const UNITES = ['pièce', 'rouleau', 'boîte', 'mètre', 'litre', 'kg', 'paquet'].map(u => ({ label: u, value: u }));

  useEffect(() => {
    if (!visible) return;
    if (item) {
      setNom(item.nom); setReference(item.reference ?? ''); setUnite(item.unite);
      setStockActuel(item.stock_actuel.toString()); setSeuilMin(item.seuil_minimum.toString());
      setCategorieId(item.categorie_id ?? ''); setLocalisationId(item.localisation_id ?? '');
      setFournisseur(item.fournisseur ?? ''); setPrix(item.prix_unitaire?.toString() ?? '');
      setQrCode(item.qr_code ?? ''); setNfcTagId(item.nfc_tag_id ?? '');
    } else {
      setNom(''); setReference(''); setUnite('pièce'); setStockActuel('0'); setSeuilMin('5');
      setCategorieId(''); setLocalisationId(''); setFournisseur(''); setPrix('');
      setQrCode(''); setNfcTagId('');
    }
  }, [visible, item]);

  const handleSave = async () => {
    if (!nom.trim()) { Alert.alert('Champ requis', 'Le nom est obligatoire'); return; }
    setSaving(true);
    try {
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
      };
      if (item) {
        await updateConsommable(item.id, data);
      } else {
        await insertConsommable(data as any);
      }
      onSaved();
      onClose();
    } catch (e: any) {
      Alert.alert('Erreur', e.message);
    } finally {
      setSaving(false);
    }
  };

  const catOptions = [{ label: 'Aucune', value: '' }, ...categories.map(c => ({ label: c.nom, value: c.id }))];
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
          <SelectPicker label="Unité" value={unite} options={UNITES} onChange={setUnite} />
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

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Input label="Fournisseur" value={fournisseur} onChangeText={setFournisseur} />
        </View>
        <View style={{ flex: 1 }}>
          <Input label="Prix unitaire (€)" value={prix} onChangeText={setPrix} keyboardType="decimal-pad" />
        </View>
      </View>

      <Input label="QR Code" value={qrCode} onChangeText={setQrCode} placeholder="Scannez ou saisissez" />
      <Input label="Tag NFC ID" value={nfcTagId} onChangeText={setNfcTagId} />

      <FormButtons onCancel={onClose} onSave={handleSave} loading={saving} />
    </BottomModal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  name: { color: Colors.white, fontSize: 16, fontWeight: '600' },
  sub: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8, gap: 4, alignItems: 'center' },
  adjBtn: { backgroundColor: Colors.green, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginRight: 4 },
  iconBtn: { padding: 6 },
  empty: { alignItems: 'center', marginTop: 60 },
});

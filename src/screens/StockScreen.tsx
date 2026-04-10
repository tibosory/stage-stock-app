// src/screens/StockScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, Alert, RefreshControl, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '../theme/colors';
import {
  getMateriel, deleteMateriel, getCategories, getLocalisations, getMaterielById
} from '../db/database';
import { Materiel, Categorie, Localisation, StatutMateriel } from '../types';
import { EtatBadge, StatutBadge, Card, ScreenHeader } from '../components/UI';
import MaterielModal from '../components/MaterielModal';
import { useAuth } from '../context/AuthContext';

export default function StockScreen({ navigation, route }: any) {
  const { can } = useAuth();
  const editOk = can('edit_inventory');
  const [materiels, setMateriels] = useState<Materiel[]>([]);
  const [filtered, setFiltered] = useState<Materiel[]>([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Materiel | null>(null);
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [localisations, setLocalisations] = useState<Localisation[]>([]);
  const [statutFilter, setStatutFilter] = useState<'tous' | StatutMateriel>('tous');

  const load = useCallback(async () => {
    const [mats, cats, locs] = await Promise.all([
      getMateriel(), getCategories(), getLocalisations(),
    ]);
    setMateriels(mats);
    setFiltered(mats);
    setCategories(cats);
    setLocalisations(locs);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

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
    setFiltered(applyFilters(materiels, search, statutFilter));
  }, [materiels, search, statutFilter, applyFilters]);

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
            await deleteMateriel(item.id);
            load();
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: Materiel }) => (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={s.name}>{item.nom}</Text>
          <Text style={s.sub}>
            {item.marque ? item.marque + ' · ' : ''}
            {item.numero_serie ?? ''}
          </Text>
          {(item as any).localisation_nom && (
            <Text style={s.sub}>{(item as any).localisation_nom}</Text>
          )}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <EtatBadge etat={item.etat} />
          <StatutBadge statut={item.statut} />
        </View>
      </View>

      {/* Actions */}
      <View style={s.actions}>
        {/* QR icon */}
        <TouchableOpacity onPress={() =>
          navigation.navigate('MaterielDetail', { materielId: item.id })
        } style={s.iconBtn}>
          <Text style={{ color: Colors.textMuted, fontSize: 18 }}>⊞</Text>
        </TouchableOpacity>
        {editOk && (
          <TouchableOpacity onPress={() => {
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
    </Card>
  );

  return (
    <SafeAreaView style={s.container}>
      <View style={{ padding: 20, paddingBottom: 0 }}>
        <ScreenHeader
          icon={<Text style={{ fontSize: 22, color: Colors.green }}>📦</Text>}
          title="Stock"
          rightLabel={editOk ? 'Ajouter' : undefined}
          onRightPress={editOk ? () => { setEditItem(null); setShowModal(true); } : undefined}
        />

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
      </View>

      <FlatList
        data={filtered}
        renderItem={renderItem}
        keyExtractor={(item: Materiel) => item.id}
        contentContainerStyle={{ padding: 20, paddingTop: 10 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.green} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={{ fontSize: 40 }}>📦</Text>
            <Text style={{ color: Colors.textMuted, marginTop: 12 }}>Aucun matériel</Text>
          </View>
        }
      />

      <MaterielModal
        visible={showModal}
        onClose={() => { setShowModal(false); setEditItem(null); }}
        onSaved={load}
        item={editItem}
        categories={categories}
        localisations={localisations}
        initialQr={route.params?.newQr}
        initialNfc={route.params?.newNfc}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
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
});

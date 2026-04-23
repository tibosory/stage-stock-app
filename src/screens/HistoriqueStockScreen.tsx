// src/screens/HistoriqueStockScreen.tsx
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl, ScrollView, TouchableOpacity,
} from 'react-native';
import { format, parseISO, isValid, subDays, startOfDay, endOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Colors } from '../theme/colors';
import { getMouvementsStockHistorique, type MouvementsStockHistoriqueOptions } from '../db/database';
import type { MouvementStockDetail } from '../types';
import { Card, ScreenHeader, Input, TabScreenSafeArea } from '../components/UI';

function formatQuand(raw: string): string {
  const d = parseISO(raw);
  if (!isValid(d)) return raw;
  return format(d, "d MMM yyyy 'à' HH:mm", { locale: fr });
}

function typeLabel(t: string): string {
  if (t === 'entrée') return 'Entrée';
  if (t === 'sortie') return 'Sortie';
  if (t === 'ajustement') return 'Ajustement';
  return t;
}

function typeColor(t: string): string {
  if (t === 'entrée') return Colors.green;
  if (t === 'sortie') return Colors.red;
  return Colors.textMuted;
}

type FiltreType = 'tous' | 'entrée' | 'sortie' | 'ajustement';
type FiltrePeriode = 'tous' | '7' | '30' | '90' | '365';

const FILTRES_TYPE: { key: FiltreType; label: string }[] = [
  { key: 'tous', label: 'Tous types' },
  { key: 'entrée', label: 'Entrées' },
  { key: 'sortie', label: 'Sorties' },
  { key: 'ajustement', label: 'Ajustements' },
];

const FILTRES_PERIODE: { key: FiltrePeriode; label: string }[] = [
  { key: 'tous', label: 'Toute période' },
  { key: '7', label: '7 jours' },
  { key: '30', label: '30 jours' },
  { key: '90', label: '90 jours' },
  { key: '365', label: '12 mois' },
];

export default function HistoriqueStockScreen() {
  const [rows, setRows] = useState<MouvementStockDetail[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filtreType, setFiltreType] = useState<FiltreType>('tous');
  const [filtrePeriode, setFiltrePeriode] = useState<FiltrePeriode>('tous');
  const [searchDraft, setSearchDraft] = useState('');
  const [searchApplied, setSearchApplied] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setSearchApplied(searchDraft.trim()), 400);
    return () => clearTimeout(t);
  }, [searchDraft]);

  const buildOptions = useCallback((): MouvementsStockHistoriqueOptions => {
    const opts: MouvementsStockHistoriqueOptions = { limit: 1200 };
    if (filtreType !== 'tous') opts.type = filtreType;
    if (filtrePeriode !== 'tous') {
      const jours = parseInt(filtrePeriode, 10);
      const fin = endOfDay(new Date());
      const debut = startOfDay(subDays(fin, jours));
      opts.dateFrom = debut.toISOString();
      opts.dateTo = fin.toISOString();
    }
    if (searchApplied.length > 0) opts.search = searchApplied;
    return opts;
  }, [filtreType, filtrePeriode, searchApplied]);

  const load = useCallback(async () => {
    const data = await getMouvementsStockHistorique(buildOptions());
    setRows(data);
  }, [buildOptions]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const filtresActifs =
    filtreType !== 'tous' || filtrePeriode !== 'tous' || searchApplied.length > 0;

  const resetFiltres = () => {
    setFiltreType('tous');
    setFiltrePeriode('tous');
    setSearchDraft('');
    setSearchApplied('');
  };

  const renderItem = ({ item }: { item: MouvementStockDetail }) => (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={s.name}>{item.consommable_nom}</Text>
          <Text style={s.date}>{formatQuand(item.created_at)}</Text>
          {item.note ? <Text style={s.note} numberOfLines={3}>{item.note}</Text> : null}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[s.type, { color: typeColor(item.type) }]}>{typeLabel(item.type)}</Text>
          <Text style={s.qty}>
            {item.type === 'sortie' ? '−' : item.type === 'entrée' ? '+' : ''}
            {item.quantite} {item.consommable_unite}
          </Text>
        </View>
      </View>
    </Card>
  );

  return (
    <TabScreenSafeArea style={s.container}>
      <View style={{ padding: 20, paddingBottom: 0 }}>
        <ScreenHeader
          icon={<Text style={{ fontSize: 22 }}>📒</Text>}
          title="Historique stock"
        />
        <Text style={s.intro}>
          Filtrez par type, période ou recherche (nom du consommable, note).
        </Text>

        <Text style={s.filterLabel}>Type</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.chipsRow}
          style={{ marginBottom: 8 }}
        >
          {FILTRES_TYPE.map(({ key, label }) => {
            const active = filtreType === key;
            return (
              <TouchableOpacity
                key={key}
                style={[s.chip, active && s.chipActive]}
                onPress={() => setFiltreType(key)}
              >
                <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={s.filterLabel}>Période</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.chipsRow}
          style={{ marginBottom: 10 }}
        >
          {FILTRES_PERIODE.map(({ key, label }) => {
            const active = filtrePeriode === key;
            return (
              <TouchableOpacity
                key={key}
                style={[s.chip, active && s.chipActive]}
                onPress={() => setFiltrePeriode(key)}
              >
                <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Input
          label="Recherche"
          value={searchDraft}
          onChangeText={setSearchDraft}
          placeholder="Nom, note…"
          autoCapitalize="none"
        />

        {filtresActifs && (
          <TouchableOpacity style={s.resetBtn} onPress={resetFiltres} hitSlop={{ top: 8, bottom: 8 }}>
            <Text style={s.resetBtnText}>Réinitialiser les filtres</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={rows}
        keyExtractor={r => r.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 20, paddingTop: 8 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.green} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={{ fontSize: 40 }}>📒</Text>
            <Text style={{ color: Colors.textMuted, marginTop: 12, textAlign: 'center' }}>
              {filtresActifs
                ? 'Aucun mouvement ne correspond à ces filtres.'
                : 'Aucun mouvement enregistré pour l’instant.'}
            </Text>
          </View>
        }
      />
    </TabScreenSafeArea>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  intro: { color: Colors.textSecondary, fontSize: 13, lineHeight: 20, marginTop: 4, marginBottom: 10 },
  filterLabel: { color: Colors.textPrimary, fontSize: 12, fontWeight: '600', marginBottom: 6 },
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
  resetBtn: { alignSelf: 'flex-start', marginBottom: 4, marginTop: 2 },
  resetBtnText: { color: Colors.green, fontSize: 13, fontWeight: '600' },
  name: { color: Colors.white, fontSize: 16, fontWeight: '600' },
  date: { color: Colors.textMuted, fontSize: 12, marginTop: 4 },
  note: { color: Colors.textSecondary, fontSize: 12, marginTop: 8, fontStyle: 'italic' },
  type: { fontSize: 12, fontWeight: '700' },
  qty: { color: Colors.white, fontSize: 15, fontWeight: '700', marginTop: 4 },
  empty: { alignItems: 'center', marginTop: 36, paddingHorizontal: 24 },
});

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { getMateriel, getConsommables } from '../db/database';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { Materiel, Consommable } from '../types';
import { TabScreenSafeArea, ScreenHeader } from '../components/UI';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';

type Row =
  | { kind: 'mat'; id: string; label: string; sub?: string; raw: Materiel }
  | { kind: 'conso'; id: string; label: string; sub?: string; raw: Consommable };

type RootParams = { QuickSearch: { q?: string } | undefined };

export default function QuickSearchScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootParams, 'QuickSearch'>>();
  const [query, setQuery] = useState(route.params?.q ?? '');
  const debouncedQuery = useDebouncedValue(query, 200);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const runSearch = useCallback(async (q: string) => {
    const low = q.trim().toLowerCase();
    if (!low) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [mats, cons] = await Promise.all([getMateriel(), getConsommables()]);
      const out: Row[] = [];
      for (const m of mats) {
        const blob = `${m.nom} ${m.qr_code ?? ''} ${m.numero_serie ?? ''} ${m.marque ?? ''} ${(m as any).categorie_nom ?? ''}`.toLowerCase();
        if (blob.includes(low)) {
          out.push({
            kind: 'mat',
            id: m.id,
            label: m.nom,
            sub: [m.marque, m.numero_serie].filter(Boolean).join(' · '),
            raw: m,
          });
        }
      }
      for (const c of cons) {
        const blob = `${c.nom} ${c.reference ?? ''} ${c.categorie_nom ?? ''}`.toLowerCase();
        if (blob.includes(low)) {
          out.push({
            kind: 'conso',
            id: c.id,
            label: c.nom,
            sub: [c.unite, String(c.stock_actuel ?? '')].filter(Boolean).join(' · '),
            raw: c,
          });
        }
      }
      setRows(out.slice(0, 200));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void runSearch(debouncedQuery);
  }, [debouncedQuery, runSearch]);

  const data = rows;

  const onPress = (item: Row) => {
    if (item.kind === 'mat') {
      navigation.navigate('WorkspaceStock', {
        screen: 'WsStock',
        params: {
          screen: 'MaterielDetail',
          params: { materielId: item.id },
        },
      });
      return;
    }
    navigation.navigate('WorkspaceConsommable');
  };

  return (
    <TabScreenSafeArea style={s.container}>
      <ScreenHeader icon={<Text style={{ fontSize: 20 }}>🔍</Text>} title="Recherche locale" />
      <View style={s.searchRow}>
        <Text style={s.searchIcon}>🔍</Text>
        <TextInput
          style={s.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Filtrer matériel & consommable (hors-ligne / sans IA)"
          placeholderTextColor={Colors.textMuted}
          autoFocus={!route.params?.q}
        />
      </View>
      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator color={Colors.green} />
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={item => `${item.kind}-${item.id}`}
          contentContainerStyle={s.list}
          ListEmptyComponent={
            <Text style={s.empty}>Aucun résultat. Modifiez le texte ou les données locales.</Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={s.row} onPress={() => onPress(item)} activeOpacity={0.8}>
              <Text style={s.badge}>{item.kind === 'mat' ? 'Matériel' : 'Conso'}</Text>
              <Text style={s.title} numberOfLines={2}>
                {item.label}
              </Text>
              {item.sub ? (
                <Text style={s.sub} numberOfLines={1}>
                  {item.sub}
                </Text>
              ) : null}
            </TouchableOpacity>
          )}
        />
      )}
    </TabScreenSafeArea>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: Colors.bgInput,
    borderWidth: 1,
    borderColor: Colors.bgInputBorder,
    borderRadius: 12,
    paddingLeft: 12,
  },
  searchIcon: { marginRight: 6 },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    paddingVertical: 10,
    paddingRight: 12,
    fontSize: 15,
  },
  list: { padding: 12, paddingBottom: 32 },
  row: {
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    marginBottom: 8,
  },
  badge: { ...Typography.caption, color: Colors.green, marginBottom: 4, fontWeight: '700' },
  title: { ...Typography.sectionTitle, fontSize: 16 },
  sub: { ...Typography.caption, color: Colors.textMuted, marginTop: 2 },
  empty: { ...Typography.bodySecondary, textAlign: 'center', marginTop: 32 },
  centered: { padding: 24 },
});

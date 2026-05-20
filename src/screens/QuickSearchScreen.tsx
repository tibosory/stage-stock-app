import React, { useState } from 'react';
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
import { TabScreenSafeArea, ScreenHeader } from '../components/UI';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import { useHybridMaterialSearch } from '../ui/hooks/useHybridMaterialSearch';
import type { SearchRow } from '../core/stock/stockEngine';
import { useLanguage } from '../context/LanguageContext';

type RootParams = { QuickSearch: { q?: string } | undefined };

export default function QuickSearchScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootParams, 'QuickSearch'>>();
  const { t } = useLanguage();
  const [query, setQuery] = useState(route.params?.q ?? '');
  const { rows, loading, aiPending, aiReason, stats } = useHybridMaterialSearch(query, 420);

  const onPress = (item: SearchRow) => {
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
      <ScreenHeader icon={<Text style={{ fontSize: 20 }}>🔍</Text>} title={t('quickSearch.title')} />
      <View style={s.searchRow}>
        <Text style={s.searchIcon}>🔍</Text>
        <TextInput
          style={s.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder={t('quickSearch.placeholder')}
          placeholderTextColor={Colors.textMuted}
          autoFocus={!route.params?.q}
        />
      </View>
      <View style={s.infoRow}>
        <Text style={s.infoText}>
          {t('quickSearch.stats', { total: stats.total, mats: stats.materiels, consos: stats.consommables })}
        </Text>
        {aiPending ? <Text style={s.infoAi}>{t('quickSearch.aiPending')}</Text> : aiReason ? <Text style={s.infoAi}>{t('quickSearch.aiOk')}</Text> : null}
      </View>
      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator color={Colors.green} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={item => `${item.kind}-${item.id}`}
          contentContainerStyle={s.list}
          ListEmptyComponent={
            <Text style={s.empty}>{t('quickSearch.empty')}</Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={s.row} onPress={() => onPress(item)} activeOpacity={0.8}>
              <Text style={s.badge}>{item.kind === 'mat' ? t('quickSearch.badge.mat') : t('quickSearch.badge.conso')}</Text>
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
  infoRow: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  infoText: { color: Colors.textMuted, fontSize: 12 },
  infoAi: { color: Colors.green, fontSize: 12, fontWeight: '700' },
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

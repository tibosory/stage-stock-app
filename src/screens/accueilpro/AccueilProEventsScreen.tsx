import React, { useCallback, useMemo, useState } from 'react';
import { Text, FlatList, RefreshControl, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import {
  AccueilProChip,
  AccueilProEmpty,
  AccueilProListRow,
  AccueilProScreenLayout,
  AccueilProStatusBadge,
  AccueilProColors,
  apStyles,
} from '../../components/accueilpro/AccueilProUI';
import { useLanguage } from '../../context/LanguageContext';
import { listApEvents } from '../../db/accueilProDb';
import { accueilProEventColor } from '../../lib/accueilProEventColors';
import type { ApEvent } from '../../types/accueilPro';
import { filterEventsList, type EventListFilter } from '../../lib/accueilProEventFilters';
import { todayIsoDate } from './accueilProScreenCommon';

export default function AccueilProEventsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { t } = useLanguage();
  const initialFilter = (route.params?.filter as EventListFilter | undefined) ?? 'all';
  const [allRows, setAllRows] = useState<ApEvent[]>([]);
  const [filter, setFilter] = useState<EventListFilter>(initialFilter);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setAllRows(await listApEvents());
  }, []);

  useFocusEffect(
    useCallback(() => {
      const f = route.params?.filter as EventListFilter | undefined;
      if (f) setFilter(f);
      setLoading(true);
      void load().finally(() => setLoading(false));
    }, [load, route.params?.filter])
  );

  const rows = useMemo(() => filterEventsList(allRows, filter, todayIsoDate()), [allRows, filter]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const filters: { id: EventListFilter; label: string }[] = [
    { id: 'today', label: t('accueilpro.events.filterToday') },
    { id: 'week', label: t('accueilpro.events.filterWeek') },
    { id: 'all', label: t('accueilpro.events.filterAll') },
  ];

  return (
    <AccueilProScreenLayout
      backLabel={t('accueilpro.back')}
      onBack={() => navigation.goBack()}
      headerIcon={<Text style={{ fontSize: 22 }}>📅</Text>}
      headerTitle={t('accueilpro.events.title')}
      headerRightLabel={t('accueilpro.orgs.add')}
      onHeaderRight={() => navigation.navigate('AccueilProEventEdit')}
      loading={loading}
      scroll={false}
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12, paddingHorizontal: 4 }}>
        {filters.map(f => (
          <AccueilProChip key={f.id} label={f.label} selected={filter === f.id} onPress={() => setFilter(f.id)} />
        ))}
      </View>
      <FlatList
        data={rows}
        keyExtractor={item => item.id}
        contentContainerStyle={[apStyles.list, { paddingBottom: 48 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={AccueilProColors.primary}
          />
        }
        ListEmptyComponent={<AccueilProEmpty message={t('accueilpro.events.emptyFiltered')} />}
        renderItem={({ item }) => (
          <AccueilProListRow
            title={item.name}
            meta={[item.date_debut, item.heure_debut, item.heure_fin ? `→ ${item.heure_fin}` : '']
              .filter(Boolean)
              .join(' · ')}
            accentColor={accueilProEventColor(item.id).bg}
            onPress={() => navigation.navigate('AccueilProEventDetail', { id: item.id })}
            rightAccessory={<AccueilProStatusBadge status={item.status} />}
          />
        )}
      />
    </AccueilProScreenLayout>
  );
}

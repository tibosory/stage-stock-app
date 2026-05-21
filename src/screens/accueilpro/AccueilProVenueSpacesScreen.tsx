import React, { useCallback, useState } from 'react';
import { Text, FlatList, RefreshControl } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import {
  AccueilProEmpty,
  AccueilProListRow,
  AccueilProScreenLayout,
  AccueilProColors,
  apStyles,
} from '../../components/accueilpro/AccueilProUI';
import { useLanguage } from '../../context/LanguageContext';
import { listApSpaces } from '../../db/accueilProDb';
import type { ApSpace } from '../../types/accueilPro';

export default function AccueilProVenueSpacesScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { t } = useLanguage();
  const venueId = route.params?.venueId as string;
  const [rows, setRows] = useState<ApSpace[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRows(await listApSpaces(venueId));
  }, [venueId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load().finally(() => setLoading(false));
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <AccueilProScreenLayout
      backLabel={t('accueilpro.back')}
      onBack={() => navigation.goBack()}
      headerIcon={<Text style={{ fontSize: 22 }}>🚪</Text>}
      headerTitle={t('accueilpro.venues.spacesTitle')}
      headerRightLabel={t('accueilpro.orgs.add')}
      onHeaderRight={() => navigation.navigate('AccueilProSpaceEdit', { venueId })}
      loading={loading}
      scroll={false}
    >
      <FlatList
        data={rows}
        keyExtractor={i => i.id}
        contentContainerStyle={[apStyles.list, { paddingBottom: 48 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={AccueilProColors.primary}
          />
        }
        ListEmptyComponent={<AccueilProEmpty message={t('accueilpro.venues.noSpaces')} />}
        renderItem={({ item }) => (
          <AccueilProListRow
            title={item.name}
            meta={[item.type, item.capacity ? `${item.capacity} pl.` : ''].filter(Boolean).join(' · ')}
            onPress={() => navigation.navigate('AccueilProSpaceEdit', { venueId, id: item.id })}
          />
        )}
      />
    </AccueilProScreenLayout>
  );
}

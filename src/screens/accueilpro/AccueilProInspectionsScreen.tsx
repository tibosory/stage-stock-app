import React, { useCallback, useState } from 'react';
import { Alert, Text, FlatList, RefreshControl } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  AccueilProEmpty,
  AccueilProListRow,
  AccueilProScreenLayout,
  AccueilProStatusBadge,
  AccueilProColors,
  apStyles,
} from '../../components/accueilpro/AccueilProUI';
import { useLanguage } from '../../context/LanguageContext';
import { deleteInspection, listApInspections } from '../../db/accueilProDb';
import type { ApRoomInspection } from '../../types/accueilPro';

export default function AccueilProInspectionsScreen() {
  const navigation = useNavigation<any>();
  const { t } = useLanguage();
  const [rows, setRows] = useState<ApRoomInspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRows(await listApInspections());
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load().finally(() => setLoading(false));
    }, [load])
  );

  const onDelete = (id: string) => {
    Alert.alert(t('accueilpro.deleteConfirmTitle'), t('accueilpro.deleteConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('accueilpro.delete'),
        style: 'destructive',
        onPress: () => void deleteInspection(id).then(load),
      },
    ]);
  };

  return (
    <AccueilProScreenLayout
      backLabel={t('accueilpro.back')}
      onBack={() => navigation.goBack()}
      headerIcon={<Text style={{ fontSize: 22 }}>📋</Text>}
      headerTitle={t('accueilpro.inspections.title')}
      headerSubtitle={t('accueilpro.inspections.subtitle')}
      headerRightLabel={t('accueilpro.inspections.new')}
      onHeaderRight={() => navigation.navigate('AccueilProEvents')}
      loading={loading}
      scroll={false}
    >
      <FlatList
        data={rows}
        keyExtractor={i => i.id}
        contentContainerStyle={[apStyles.list, { paddingBottom: 48 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }} tintColor={AccueilProColors.primary} />}
        ListEmptyComponent={<AccueilProEmpty message={t('accueilpro.inspections.empty')} />}
        renderItem={({ item }) => (
          <AccueilProListRow
            title={`EDL ${item.type === 'entrée' ? 'entrée' : 'sortie'}`}
            meta={item.inspection_date ?? item.updated_at?.slice(0, 10) ?? '—'}
            subtitle={item.inspection_date ?? undefined}
            onPress={() => navigation.navigate('AccueilProInspectionEdit', { id: item.id, eventId: item.event_id, spaceId: item.space_id, type: item.type })}
            rightAccessory={<AccueilProStatusBadge status={item.status} />}
          />
        )}
      />
    </AccueilProScreenLayout>
  );
}

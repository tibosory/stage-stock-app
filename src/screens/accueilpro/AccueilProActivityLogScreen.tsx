import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, Text } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  AccueilProEmpty,
  AccueilProListRow,
  AccueilProScreenLayout,
  AccueilProColors,
  apStyles,
} from '../../components/accueilpro/AccueilProUI';
import { useLanguage } from '../../context/LanguageContext';
import { listApActivityLogs } from '../../db/accueilProDb';
import { activityLogActionLabel } from '../../lib/accueilProActivityLog';
import type { ApActivityLogEntry } from '../../types/accueilPro';

export default function AccueilProActivityLogScreen() {
  const navigation = useNavigation<any>();
  const { t } = useLanguage();
  const [rows, setRows] = useState<ApActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRows(await listApActivityLogs({ limit: 200 }));
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load().finally(() => setLoading(false));
    }, [load])
  );

  return (
    <AccueilProScreenLayout
      backLabel={t('accueilpro.back')}
      onBack={() => navigation.goBack()}
      headerIcon={<Text style={{ fontSize: 22 }}>📜</Text>}
      headerTitle={t('accueilpro.activity.title')}
      headerSubtitle={t('accueilpro.activity.subtitle')}
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
            onRefresh={() => {
              setRefreshing(true);
              void load().finally(() => setRefreshing(false));
            }}
            tintColor={AccueilProColors.primary}
          />
        }
        ListEmptyComponent={<AccueilProEmpty message={t('accueilpro.activity.empty')} />}
        renderItem={({ item }) => (
          <AccueilProListRow
            title={activityLogActionLabel(item.action)}
            meta={[item.created_at?.slice(0, 16) ?? '—', item.actor_name, item.summary].filter(Boolean).join(' · ')}
            showChevron={false}
          />
        )}
      />
    </AccueilProScreenLayout>
  );
}

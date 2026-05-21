import React, { useCallback, useState } from 'react';
import { Text, FlatList, RefreshControl } from 'react-native';
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
import { listApConventions } from '../../db/accueilProDb';
import { conventionIsSigned } from '../../lib/accueilProActivityLog';
import { exportAccueilProConventionPdf } from '../../lib/pdfAccueilProConvention';
import type { ApConvention } from '../../types/accueilPro';

export default function AccueilProConventionsScreen() {
  const navigation = useNavigation<any>();
  const { t } = useLanguage();
  const [rows, setRows] = useState<ApConvention[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRows(await listApConventions());
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
      headerIcon={<Text style={{ fontSize: 22 }}>📄</Text>}
      headerTitle={t('accueilpro.conventions.title')}
      headerSubtitle={t('accueilpro.conventions.subtitle')}
      headerRightLabel={t('accueilpro.conventions.new')}
      onHeaderRight={() => navigation.navigate('AccueilProConventionEdit', {})}
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
        ListEmptyComponent={<AccueilProEmpty message={t('accueilpro.conventions.empty')} />}
        renderItem={({ item }) => (
          <AccueilProListRow
            title={item.titre}
            meta={item.created_at?.slice(0, 10) ?? '—'}
            onPress={() => navigation.navigate('AccueilProConventionEdit', { id: item.id, eventId: item.event_id ?? undefined })}
            rightAccessory={
              conventionIsSigned(item) ?
                <Text
                  style={{ color: AccueilProColors.primary, fontWeight: '700' }}
                  onPress={() => void exportAccueilProConventionPdf(item)}
                >
                  PDF
                </Text>
              : item.status !== 'signé' ?
                <Text
                  style={{ color: AccueilProColors.gold, fontWeight: '700' }}
                  onPress={() =>
                    navigation.navigate('AccueilProConventionEdit', {
                      id: item.id,
                      eventId: item.event_id ?? undefined,
                      signNow: true,
                    })
                  }
                >
                  {t('accueilpro.conventions.sign')}
                </Text>
              : <AccueilProStatusBadge status={item.status} />
            }
          />
        )}
      />
    </AccueilProScreenLayout>
  );
}

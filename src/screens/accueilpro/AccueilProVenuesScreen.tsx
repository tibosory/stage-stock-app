import React, { useCallback, useState } from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { AccueilProFormCard } from '../../components/accueilpro/AccueilProUI';
import {
  AccueilProEmpty,
  AccueilProScreenLayout,
  apStyles,
} from '../../components/accueilpro/AccueilProUI';
import { Spacing } from '../../theme/spacing';
import { useLanguage } from '../../context/LanguageContext';
import { listApVenues, listApSpaces } from '../../db/accueilProDb';
import type { ApSpace, ApVenue } from '../../types/accueilPro';

export default function AccueilProVenuesScreen() {
  const navigation = useNavigation<any>();
  const { t } = useLanguage();
  const [venues, setVenues] = useState<ApVenue[]>([]);
  const [spaces, setSpaces] = useState<ApSpace[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [v, sp] = await Promise.all([listApVenues(), listApSpaces()]);
    setVenues(v);
    setSpaces(sp);
  }, []);

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
      headerIcon={<Text style={{ fontSize: 22 }}>🏢</Text>}
      headerTitle={t('accueilpro.venues.title')}
      headerRightLabel={t('accueilpro.orgs.add')}
      onHeaderRight={() => navigation.navigate('AccueilProVenueEdit')}
      loading={loading}
      refreshing={refreshing}
      onRefresh={() => void onRefresh()}
    >
      {venues.length === 0 ? (
        <AccueilProEmpty message={t('accueilpro.venues.empty')} />
      ) : (
        venues.map(v => (
          <TouchableOpacity
            key={v.id}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('AccueilProVenueEdit', { id: v.id })}
          >
            <AccueilProFormCard style={{ marginBottom: Spacing.sm }}>
              <Text style={apStyles.rowTitle}>{v.name}</Text>
              <Text style={apStyles.rowMeta}>
                {[v.address, v.cp, v.city].filter(Boolean).join(', ') || '—'}
              </Text>
              {spaces
                .filter(sp => sp.venue_id === v.id)
                .map(sp => (
                  <Text key={sp.id} style={[apStyles.rowMeta, { marginTop: Spacing.sm }]}>
                    · {sp.name}
                    {sp.capacity ? ` (${sp.capacity} places)` : ''}
                  </Text>
                ))}
            </AccueilProFormCard>
          </TouchableOpacity>
        ))
      )}
    </AccueilProScreenLayout>
  );
}

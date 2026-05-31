import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, Text } from 'react-native';
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
import { listApEvents } from '../../db/accueilProDb';
import { accueilProEventColor } from '../../lib/accueilProEventColors';
import {
  apEventDateLocale,
  eventsForFeuilleRouteList,
  feuilleRouteEventTitle,
} from '../../lib/accueilProFeuilleHelpers';
import type { ApEvent } from '../../types/accueilPro';

export default function AccueilProFeuilleRouteScreen() {
  const navigation = useNavigation<any>();
  const { t, language } = useLanguage();
  const locale = apEventDateLocale(language);
  const [rows, setRows] = useState<ApEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const events = await listApEvents();
    setRows(eventsForFeuilleRouteList(events));
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
      headerIcon={<Text style={{ fontSize: 22 }}>🗒</Text>}
      headerTitle={t('accueilpro.feuille.title')}
      headerSubtitle={t('accueilpro.feuille.subtitle')}
      loading={loading}
      scroll={false}
    >
      <Text style={[apStyles.hint, { marginBottom: 12, paddingHorizontal: 4 }]}>{t('accueilpro.feuille.listHint')}</Text>

      {rows.length === 0 && !loading ?
        <AccueilProEmpty message={t('accueilpro.feuille.emptyList')} />
      : <FlatList
          data={rows}
          keyExtractor={item => item.id}
          contentContainerStyle={[apStyles.list, { paddingBottom: 48 }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void onRefresh()}
              tintColor={AccueilProColors.gold}
            />
          }
          renderItem={({ item }) => {
            const color = accueilProEventColor(item.id);
            const hours =
              item.heure_debut ?
                `${item.heure_debut}${item.heure_fin ? ` → ${item.heure_fin}` : ''}`
              : undefined;
            return (
              <AccueilProListRow
                title={feuilleRouteEventTitle(item, locale)}
                subtitle={hours}
                accentColor={color.bg}
                onPress={() => navigation.navigate('AccueilProFeuilleRouteEvent', { eventId: item.id })}
                rightAccessory={<AccueilProStatusBadge status={item.status} />}
              />
            );
          }}
        />
      }
    </AccueilProScreenLayout>
  );
}

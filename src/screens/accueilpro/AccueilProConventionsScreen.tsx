import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Text, View, FlatList, RefreshControl } from 'react-native';
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
import { deleteApConvention, listApConventions, listApEvents } from '../../db/accueilProDb';
import { conventionIsSigned } from '../../lib/accueilProActivityLog';
import { removeConventionPdfLocal } from '../../lib/accueilProConventionPdfStorage';
import { exportAccueilProConventionPdf } from '../../lib/pdfAccueilProConvention';
import type { ApConvention, ApEvent } from '../../types/accueilPro';

function formatEventLabel(ev: ApEvent | undefined, fallback: string): string {
  if (!ev) return fallback;
  const date = ev.date_debut?.slice(0, 10) ?? '';
  return date ? `${ev.name} · ${date}` : ev.name;
}

export default function AccueilProConventionsScreen() {
  const navigation = useNavigation<any>();
  const { t } = useLanguage();
  const [rows, setRows] = useState<ApConvention[]>([]);
  const [eventsById, setEventsById] = useState<Map<string, ApEvent>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [conventions, events] = await Promise.all([listApConventions(), listApEvents()]);
    setRows(conventions);
    setEventsById(new Map(events.map(e => [e.id, e])));
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load().finally(() => setLoading(false));
    }, [load])
  );

  const noEventLabel = t('accueilpro.conventions.noEvent');

  const confirmDelete = useCallback(
    (item: ApConvention) => {
      Alert.alert(t('accueilpro.deleteConfirmTitle'), t('accueilpro.conventions.deleteBody'), [
        { text: t('accueilpro.cancel'), style: 'cancel' },
        {
          text: t('accueilpro.delete'),
          style: 'destructive',
          onPress: () =>
            void (async () => {
              await removeConventionPdfLocal(item.document_local_uri);
              await deleteApConvention(item.id);
              await load();
            })(),
        },
      ]);
    },
    [load, t]
  );

  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const ea = eventsById.get(a.event_id ?? '')?.date_debut ?? '';
        const eb = eventsById.get(b.event_id ?? '')?.date_debut ?? '';
        if (ea !== eb) return eb.localeCompare(ea);
        return (b.updated_at ?? '').localeCompare(a.updated_at ?? '');
      }),
    [rows, eventsById]
  );

  return (
    <AccueilProScreenLayout
      backLabel={t('accueilpro.back')}
      onBack={() => navigation.goBack()}
      headerIcon={<Text style={{ fontSize: 22 }}>📄</Text>}
      headerTitle={t('accueilpro.conventions.title')}
      headerSubtitle={t('accueilpro.conventions.subtitle')}
      headerRightLabel={t('accueilpro.conventions.new')}
      onHeaderRight={() => navigation.navigate('AccueilProConventionEdit', { requireEvent: true })}
      loading={loading}
      scroll={false}
    >
      <FlatList
        data={sortedRows}
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
        renderItem={({ item }) => {
          const ev = item.event_id ? eventsById.get(item.event_id) : undefined;
          const eventLine = formatEventLabel(ev, noEventLabel);
          return (
            <AccueilProListRow
              title={item.titre}
              meta={eventLine}
              subtitle={item.created_at?.slice(0, 10) ?? undefined}
              accentColor={ev ? undefined : AccueilProColors.statusAnnule}
              onPress={() =>
                navigation.navigate('AccueilProConventionEdit', {
                  id: item.id,
                  eventId: item.event_id ?? undefined,
                })
              }
              rightAccessory={
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  {conventionIsSigned(item) ?
                    <Text
                      style={{ color: AccueilProColors.primary, fontWeight: '700' }}
                      onPress={() => void exportAccueilProConventionPdf(item, ev?.name)}
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
                  : <AccueilProStatusBadge status={item.status} />}
                  <Text
                    style={{ color: '#c0392b', fontWeight: '700', fontSize: 12 }}
                    onPress={() => confirmDelete(item)}
                  >
                    {t('accueilpro.delete')}
                  </Text>
                </View>
              }
            />
          );
        }}
      />
    </AccueilProScreenLayout>
  );
}

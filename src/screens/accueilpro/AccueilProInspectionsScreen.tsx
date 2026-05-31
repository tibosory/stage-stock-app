import React, { useCallback, useState } from 'react';
import { Alert, Text, TouchableOpacity, View, FlatList, RefreshControl } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  AccueilProChip,
  AccueilProEmpty,
  AccueilProFormCard,
  AccueilProLinkButton,
  AccueilProListRow,
  AccueilProPrimaryButton,
  AccueilProScreenLayout,
  AccueilProStatusBadge,
  AccueilProColors,
  apStyles,
} from '../../components/accueilpro/AccueilProUI';
import { Spacing } from '../../theme/spacing';
import { useLanguage } from '../../context/LanguageContext';
import {
  findApRoomInspection,
  getApEvent,
  listApEvents,
  listApInspections,
  resolveSpacesForEvent,
} from '../../db/accueilProDb';
import { buildInspectionProblemReport } from '../../lib/accueilProInspectionReport';
import {
  exportAccueilProInspectionReportPdf,
  shareInspectionReportByEmail,
} from '../../lib/pdfAccueilProInspectionReport';
import { parsePhotosJson } from '../../modules/accueilpro/constants/inspectionChecklist';
import type { ApEvent, ApInspectionKind, ApRoomInspection, ApSpace } from '../../types/accueilPro';

type TabId = 'event' | 'history';

export default function AccueilProInspectionsScreen() {
  const navigation = useNavigation<any>();
  const { t } = useLanguage();
  const [tab, setTab] = useState<TabId>('event');
  const [events, setEvents] = useState<ApEvent[]>([]);
  const [history, setHistory] = useState<ApRoomInspection[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<ApEvent | null>(null);
  const [spaces, setSpaces] = useState<ApSpace[]>([]);
  const [problemCount, setProblemCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadLists = useCallback(async () => {
    const [ev, insp] = await Promise.all([listApEvents(), listApInspections()]);
    setEvents(ev.sort((a, b) => (b.date_debut ?? '').localeCompare(a.date_debut ?? '')));
    setHistory(insp);
  }, []);

  const loadEventHub = useCallback(async (eventId: string) => {
    const ev = await getApEvent(eventId);
    if (!ev) {
      setSelectedEventId(null);
      setSelectedEvent(null);
      setSpaces([]);
      return;
    }
    const sp = await resolveSpacesForEvent(ev);
    const report = await buildInspectionProblemReport(eventId);
    setSelectedEvent(ev);
    setSpaces(sp);
    setProblemCount(report?.problems.length ?? 0);
  }, []);

  const load = useCallback(async () => {
    await loadLists();
    if (selectedEventId) await loadEventHub(selectedEventId);
  }, [loadLists, loadEventHub, selectedEventId]);

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

  const onSelectEvent = (eventId: string) => {
    setSelectedEventId(eventId);
    void loadEventHub(eventId);
  };

  const onExportPdf = async () => {
    if (!selectedEventId) return;
    setExporting(true);
    try {
      const report = await buildInspectionProblemReport(selectedEventId);
      if (!report) {
        Alert.alert(t('accueilpro.orgs.errTitle'), t('accueilpro.inspections.reportErrEvent'));
        return;
      }
      await exportAccueilProInspectionReportPdf(report);
    } catch (e) {
      Alert.alert(t('accueilpro.inspections.reportErrTitle'), e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  };

  const onEmailReport = async () => {
    if (!selectedEventId) return;
    setExporting(true);
    try {
      const report = await buildInspectionProblemReport(selectedEventId);
      if (!report) {
        Alert.alert(t('accueilpro.orgs.errTitle'), t('accueilpro.inspections.reportErrEvent'));
        return;
      }
      await shareInspectionReportByEmail(report);
    } catch (e) {
      Alert.alert(t('accueilpro.inspections.reportErrTitle'), e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: 'event', label: t('accueilpro.inspections.tabEvent') },
    { id: 'history', label: t('accueilpro.inspections.tabHistory') },
  ];

  const spacesLabel =
    selectedEvent?.spaces_mode === 'all'
      ? t('accueilpro.spaces.allHint', { n: String(spaces.length) })
      : t('accueilpro.spaces.selectedCount', { n: String(spaces.length) });

  return (
    <AccueilProScreenLayout
      backLabel={t('accueilpro.back')}
      onBack={() => {
        if (tab === 'event' && selectedEventId) {
          setSelectedEventId(null);
          setSelectedEvent(null);
          return;
        }
        navigation.goBack();
      }}
      headerIcon={<Text style={{ fontSize: 22 }}>📋</Text>}
      headerTitle={t('accueilpro.inspections.title')}
      headerSubtitle={t('accueilpro.inspections.subtitle')}
      loading={loading}
      scroll={tab === 'event' && selectedEventId ? true : false}
      refreshing={refreshing}
      onRefresh={() => void onRefresh()}
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 14 }}>
        {tabs.map(item => (
          <AccueilProChip key={item.id} label={item.label} selected={tab === item.id} onPress={() => setTab(item.id)} />
        ))}
      </View>

      {tab === 'event' && !selectedEventId ?
        <FlatList
          data={events}
          keyExtractor={e => e.id}
          contentContainerStyle={[apStyles.list, { paddingBottom: 48 }]}
          ListHeaderComponent={
            <Text style={[apStyles.hint, { marginBottom: Spacing.md }]}>{t('accueilpro.inspections.pickEventHint')}</Text>
          }
          ListEmptyComponent={<AccueilProEmpty message={t('accueilpro.events.empty')} />}
          renderItem={({ item }) => (
            <AccueilProListRow
              title={item.name}
              meta={[item.date_debut, item.heure_debut].filter(Boolean).join(' · ')}
              onPress={() => onSelectEvent(item.id)}
            />
          )}
        />
      : null}

      {tab === 'event' && selectedEventId && selectedEvent ?
        <>
          <AccueilProFormCard style={{ marginBottom: Spacing.md }}>
            <Text style={apStyles.rowTitle}>{selectedEvent.name}</Text>
            <Text style={apStyles.rowMeta}>
              {selectedEvent.date_debut}
              {selectedEvent.heure_debut ? ` · ${selectedEvent.heure_debut}` : ''}
            </Text>
            <Text style={[apStyles.rowMeta, { marginTop: 4 }]}>{spacesLabel}</Text>
            {problemCount > 0 ?
              <Text style={{ color: AccueilProColors.statusAnnule, fontWeight: '700', marginTop: 8 }}>
                {t('accueilpro.inspections.problemCount', { n: String(problemCount) })}
              </Text>
            : null}
          </AccueilProFormCard>

          <Text style={apStyles.sectionTitle}>{t('accueilpro.inspections.spacesSection')}</Text>
          {spaces.length === 0 ?
            <AccueilProEmpty message={t('accueilpro.venues.noSpacesTapAdd')} />
          : spaces.map(sp => (
              <AccueilProFormCard key={sp.id} style={{ marginBottom: Spacing.sm }}>
                <Text style={apStyles.rowTitle}>{sp.name}</Text>
                <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm }}>
                  <InspectionBtn
                    eventId={selectedEventId}
                    spaceId={sp.id}
                    type="entrée"
                    label={t('accueilpro.inspection.entry')}
                    navigation={navigation}
                  />
                  <InspectionBtn
                    eventId={selectedEventId}
                    spaceId={sp.id}
                    type="sortie"
                    label={t('accueilpro.inspection.exit')}
                    navigation={navigation}
                  />
                </View>
              </AccueilProFormCard>
            ))
          }

          <AccueilProFormCard style={{ marginTop: Spacing.md }}>
            <Text style={apStyles.sectionTitle}>{t('accueilpro.inspections.reportSection')}</Text>
            <Text style={[apStyles.hint, { marginBottom: Spacing.sm }]}>{t('accueilpro.inspections.reportHint')}</Text>
            <AccueilProPrimaryButton
              label={t('accueilpro.inspections.exportReportPdf')}
              onPress={() => void onExportPdf()}
              loading={exporting}
              style={{ marginBottom: Spacing.sm }}
            />
            <AccueilProLinkButton label={t('accueilpro.inspections.sendReportEmail')} onPress={() => void onEmailReport()} />
          </AccueilProFormCard>
        </>
      : null}

      {tab === 'history' ?
        <FlatList
          data={history}
          keyExtractor={i => i.id}
          contentContainerStyle={[apStyles.list, { paddingBottom: 48 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={AccueilProColors.primary} />
          }
          ListEmptyComponent={<AccueilProEmpty message={t('accueilpro.inspections.empty')} />}
          renderItem={({ item }) => (
            <AccueilProListRow
              title={`EDL ${item.type === 'entrée' ? t('accueilpro.inspection.entry') : t('accueilpro.inspection.exit')}`}
              meta={item.inspection_date ?? item.updated_at?.slice(0, 10) ?? '—'}
              onPress={() =>
                navigation.navigate('AccueilProInspectionEdit', {
                  id: item.id,
                  eventId: item.event_id,
                  spaceId: item.space_id,
                  type: item.type,
                })
              }
              rightAccessory={<AccueilProStatusBadge status={item.status} />}
            />
          )}
        />
      : null}
    </AccueilProScreenLayout>
  );
}

function InspectionBtn({
  eventId,
  spaceId,
  type,
  label,
  navigation,
}: {
  eventId: string;
  spaceId: string;
  type: ApInspectionKind;
  label: string;
  navigation: { navigate: (a: string, b: object) => void };
}) {
  const [done, setDone] = React.useState(false);
  const [photoCount, setPhotoCount] = React.useState(0);
  const refresh = React.useCallback(() => {
    void findApRoomInspection(eventId, spaceId, type).then((i: ApRoomInspection | null) => {
      setDone(i?.status === 'terminé');
      setPhotoCount(i ? parsePhotosJson(i.photos).length : 0);
    });
  }, [eventId, spaceId, type]);
  useFocusEffect(refresh);

  return (
    <TouchableOpacity
      style={[apStyles.inspBtn, done && apStyles.inspDone]}
      onPress={() => navigation.navigate('AccueilProInspectionEdit', { eventId, spaceId, type })}
    >
      <Text style={apStyles.inspText}>
        {label}
        {done ? ' ✓' : ''}
        {photoCount > 0 ? ` · ${photoCount} 📷` : ''}
      </Text>
    </TouchableOpacity>
  );
}

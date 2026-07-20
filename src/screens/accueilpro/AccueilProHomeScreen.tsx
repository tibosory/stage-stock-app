import React, { useCallback, useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  AccueilProEmpty,
  AccueilProListRow,
  AccueilProNavGrid,
  AccueilProQuickActionsRow,
  AccueilProScreenLayout,
  AccueilProSectionCard,
  AccueilProStatTile,
  AccueilProStatusBadge,
  AccueilProTodayBanner,
  AccueilProTypeBadge,
  AccueilProColors,
} from '../../components/accueilpro/AccueilProUI';
import { useLanguage } from '../../context/LanguageContext';
import { useConnection } from '../../context/ConnectionContext';
import {
  countConventions,
  countInspections,
  countUpcomingEvents,
  countVenues,
  listApEvents,
  listApVenues,
  recentInspections,
  upcomingEvents,
} from '../../db/accueilProDb';
import { countAccueilProConflicts } from '../../lib/accueilProMerge';
import { syncAccueilProBidirectional } from '../../lib/accueilProApiSync';
import { pullCapiAccueilProCatalogFromServer } from '../../lib/pullCapiAccueilProCatalog';
import { useAccueilProRole } from '../../modules/accueilpro/hooks/useAccueilProRole';
import { todayIsoDate } from './accueilProScreenCommon';
import type { ApEvent, ApRoomInspection, ApVenue } from '../../types/accueilPro';
import { eventsOnDate } from '../../lib/accueilProFeuilleHelpers';
import { buildEventReadinessSnapshots, type EventReadinessSnapshot } from '../../lib/accueilProEventReadiness';
import { accueilProEventColor } from '../../lib/accueilProEventColors';
import { EventDayReadinessCard } from '../../components/accueilpro/EventReadinessChecklist';

function formatShortDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  } catch {
    return iso;
  }
}

function todayIsoLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function AccueilProHomeScreen() {
  const navigation = useNavigation<any>();
  const { t } = useLanguage();
  const { status: connStatus } = useConnection();
  const { isStaff, isClientPortal } = useAccueilProRole();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ venues: 0, events: 0, edl: 0, conventions: 0 });
  const [todayEvents, setTodayEvents] = useState(0);
  const [conflictCount, setConflictCount] = useState(0);
  const [venues, setVenues] = useState<ApVenue[]>([]);
  const [events, setEvents] = useState<ApEvent[]>([]);
  const [edl, setEdl] = useState<ApRoomInspection[]>([]);
  const [todayReadiness, setTodayReadiness] = useState<EventReadinessSnapshot[]>([]);
  const refreshInFlight = useRef(false);

  const load = useCallback(async () => {
    const today = todayIsoLocal();
    const [vCount, eCount, iCount, cCount, vList, evList, edlList, allEvents] = await Promise.all([
      countVenues(),
      countUpcomingEvents(),
      countInspections(),
      countConventions(),
      listApVenues(),
      upcomingEvents({ limit: 12 }),
      recentInspections({ limit: 4 }),
      listApEvents(),
    ]);
    setStats({ venues: vCount, events: eCount, edl: iCount, conventions: cCount });
    const todayList = eventsOnDate(allEvents, today);
    setTodayEvents(todayList.length);
    if (todayList.length > 0) {
      setTodayReadiness(await buildEventReadinessSnapshots(todayList.map(e => e.id)));
    } else {
      setTodayReadiness([]);
    }
    setVenues(vList.slice(0, 4));
    setEvents(evList.slice(0, 3));
    setEdl(edlList);
    setConflictCount(await countAccueilProConflicts());
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load().finally(() => setLoading(false));
    }, [load])
  );

  const onRefresh = async () => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    setRefreshing(true);
    try {
      if (connStatus === 'needs_pairing') {
        Alert.alert(t('accueilpro.sync.needPairingTitle'), t('network.serverDetectedNeedPairing'));
      } else if (connStatus === 'ok') {
        try {
          const { materialized } = await pullCapiAccueilProCatalogFromServer();
          if (
            materialized.eventsCreated > 0 ||
            materialized.spacesCreated > 0 ||
            materialized.planningItems > 0 ||
            materialized.directoryContacts > 0
          ) {
            Alert.alert(
              'Catalogues CAPI',
              `${materialized.eventsCreated} événement(s), ${materialized.spacesCreated} espace(s), ${materialized.planningItems} ligne(s) d'agenda, ${materialized.directoryContacts} contact(s) annuaire importés depuis CAPI.`,
            );
          }
        } catch {
          /* catalogues CAPI optionnels si pas encore sync côté serveur CAPI */
        }
        const { pull } = await syncAccueilProBidirectional(null);
        setConflictCount(await countAccueilProConflicts());
        if (pull.conflicts > 0) {
          Alert.alert(
            t('accueilpro.sync.mergeTitle'),
            t('accueilpro.sync.mergeOk', { applied: String(pull.applied), conflicts: String(pull.conflicts) }),
            [
              { text: t('accueilpro.cancel'), style: 'cancel' },
              { text: t('accueilpro.conflicts.bannerAction'), onPress: () => nav('AccueilProConflicts') },
            ]
          );
        }
      }
      await load();
    } catch (e) {
      Alert.alert(t('accueilpro.sync.errorTitle'), e instanceof Error ? e.message : String(e));
    } finally {
      refreshInFlight.current = false;
      setRefreshing(false);
    }
  };

  const nav = (screen: string, params?: object) => navigation.navigate(screen as never, params as never);

  const menuItems = (
    isClientPortal
      ? [
          { key: 'AccueilAssociation', label: t('accueilpro.nav.portal'), icon: '🤝' },
          { key: 'AccueilProPlanning', label: t('accueilpro.nav.planning'), icon: '📆' },
        ]
      : [
          { key: 'AccueilProPlanning', label: t('accueilpro.nav.planning'), icon: '📆' },
          { key: 'AccueilProDayPlan', label: t('accueilpro.nav.dayPlan'), icon: '🗓' },
          { key: 'AccueilProFeuilleRoute', label: t('accueilpro.nav.feuille'), icon: '🗒' },
          { key: 'AccueilProOrganizations', label: t('accueilpro.nav.organizations'), icon: '🏢' },
          { key: 'AccueilProContacts', label: t('accueilpro.nav.contacts'), icon: '📇' },
          { key: 'AccueilProPersonnel', label: t('accueilpro.nav.team'), icon: '👥' },
          { key: 'AccueilProActivityLog', label: t('accueilpro.nav.activity'), icon: '📜' },
          { key: 'AccueilAssociation', label: t('accueilpro.nav.portal'), icon: '🤝' },
        ]
  );

  return (
    <AccueilProScreenLayout
      headerIcon={<Text style={{ fontSize: 24 }}>⊞</Text>}
      headerTitle={t('accueilpro.home.title')}
      headerSubtitle={t('accueilpro.home.subtitle')}
      headerRightLabel={t('accueilpro.home.sync')}
      onHeaderRight={() => void onRefresh()}
      loading={loading}
      refreshing={refreshing}
      onRefresh={() => void onRefresh()}
      showFieldStrip
    >
      {conflictCount > 0 ?
        <AccueilProSectionCard title={t('accueilpro.conflicts.title')}>
          <AccueilProListRow
            title={t('accueilpro.conflicts.banner', { count: String(conflictCount) })}
            meta={t('accueilpro.conflicts.subtitle')}
            onPress={() => nav('AccueilProConflicts')}
          />
        </AccueilProSectionCard>
      : null}

      <AccueilProTodayBanner
        count={todayEvents}
        title={t('accueilpro.home.todayLabel')}
        subtitle={t('accueilpro.home.todayEvents', { count: String(todayEvents) })}
        onPress={() => nav('AccueilProEvents', { filter: 'today' })}
      />

      {isStaff && todayReadiness.length > 0 ?
        <AccueilProSectionCard
          title={t('accueilpro.home.myDay')}
          actionLabel={t('accueilpro.home.myDayFeuille')}
          onAction={() => nav('AccueilProFeuilleRoute')}
        >
          {todayReadiness.map(snap => (
            <EventDayReadinessCard
              key={snap.event.id}
              snap={snap}
              t={t}
              onPress={() => nav('AccueilProEventDetail', { id: snap.event.id })}
            />
          ))}
        </AccueilProSectionCard>
      : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 18 }}>
        <AccueilProStatTile icon="🏛" value={stats.venues} label={t('accueilpro.nav.venues')} color={AccueilProColors.gold} onPress={() => nav('AccueilProVenues')} />
        <AccueilProStatTile icon="📅" value={stats.events} label={t('accueilpro.nav.events')} color={AccueilProColors.eventSpectacle} onPress={() => nav('AccueilProEvents')} />
        <AccueilProStatTile icon="📋" value={stats.edl} label={t('accueilpro.nav.inspections')} color={AccueilProColors.statusConfirme} onPress={() => nav('AccueilProInspections')} />
        <AccueilProStatTile icon="📄" value={stats.conventions} label={t('accueilpro.nav.conventions')} color={AccueilProColors.primary} onPress={() => nav('AccueilProConventions')} />
      </View>

      <AccueilProSectionCard title={t('accueilpro.home.quickActions')}>
        <AccueilProQuickActionsRow
          actions={
            isStaff
              ? [
                  { label: t('accueilpro.home.newEvent'), icon: '📅', color: AccueilProColors.gold, onPress: () => nav('AccueilProEventEdit', {}) },
                  { label: t('accueilpro.nav.dayPlan'), icon: '🗓', color: AccueilProColors.navy, onPress: () => nav('AccueilProDayPlan', { date: todayIsoDate() }) },
                  { label: t('accueilpro.home.newVenue'), icon: '🏛', color: AccueilProColors.navy, onPress: () => nav('AccueilProVenueEdit', {}) },
                  { label: t('accueilpro.home.newEdl'), icon: '📋', color: AccueilProColors.eventSpectacle, onPress: () => nav('AccueilProInspections') },
                  {
                    label: t('accueilpro.home.newConvention'),
                    icon: '📄',
                    color: AccueilProColors.statusConfirme,
                    onPress: () => nav('AccueilProConventionEdit', { requireEvent: true }),
                  },
                ]
              : [
                  { label: t('accueilpro.nav.portal'), icon: '🤝', color: AccueilProColors.gold, onPress: () => nav('AccueilAssociation') },
                  { label: t('accueilpro.nav.planning'), icon: '📆', color: AccueilProColors.eventSpectacle, onPress: () => nav('AccueilProPlanning') },
                ]
          }
        />
      </AccueilProSectionCard>

      <AccueilProSectionCard title={t('accueilpro.home.upcomingEvents')} actionLabel={t('accueilpro.home.seeAll')} onAction={() => nav('AccueilProEvents')}>
        {events.length === 0 ?
          <AccueilProEmpty emoji="📅" message={t('accueilpro.home.noUpcoming')} />
        : events.map(e => (
          <AccueilProListRow
            key={e.id}
            title={e.name}
            meta={formatShortDate(e.date_debut)}
            accentColor={accueilProEventColor(e.id).bg}
            onPress={() => nav('AccueilProEventDetail', { id: e.id })}
            rightAccessory={<AccueilProTypeBadge type={e.type} />}
            showChevron={false}
          />
        ))}
      </AccueilProSectionCard>

      <AccueilProSectionCard title={t('accueilpro.home.myVenues')} actionLabel={t('accueilpro.home.manage')} onAction={() => nav('AccueilProVenues')}>
        {venues.length === 0 ?
          <AccueilProEmpty emoji="🏛" message={t('accueilpro.venues.empty')} />
        : venues.map(v => (
          <AccueilProListRow
            key={v.id}
            title={v.name}
            meta={[v.city, v.erp_type ? `ERP ${v.erp_type}` : '', v.capacity ? `${v.capacity} pers.` : ''].filter(Boolean).join(' · ')}
            onPress={() => nav('AccueilProVenueDetail', { id: v.id })}
          />
        ))}
      </AccueilProSectionCard>

      <AccueilProSectionCard title={t('accueilpro.home.recentEdl')} actionLabel={t('accueilpro.home.seeAll')} onAction={() => nav('AccueilProInspections')}>
        {edl.length === 0 ?
          <AccueilProEmpty emoji="📋" message={t('accueilpro.inspections.empty')} />
        : edl.map(item => (
          <AccueilProListRow
            key={item.id}
            title={`EDL ${item.type === 'entrée' ? 'entrée' : 'sortie'}`}
            meta={item.inspection_date ?? item.updated_at?.slice(0, 10) ?? '—'}
            onPress={() => nav('AccueilProInspectionEdit', { id: item.id, eventId: item.event_id, spaceId: item.space_id, type: item.type })}
            rightAccessory={<AccueilProStatusBadge status={item.status} />}
            showChevron={false}
          />
        ))}
      </AccueilProSectionCard>

      <AccueilProSectionCard title={t('accueilpro.home.menu')}>
        <Text style={{ color: AccueilProColors.textMuted, fontSize: 13, marginBottom: 12, lineHeight: 18 }}>
          {t('accueilpro.home.menuHint')}
        </Text>
        <AccueilProNavGrid items={menuItems.map(row => ({ ...row, onPress: () => nav(row.key) }))} />
      </AccueilProSectionCard>
    </AccueilProScreenLayout>
  );
}

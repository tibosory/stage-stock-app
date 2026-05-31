import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { EventDayAgendaTimeline } from '../../components/accueilpro/EventDayAgendaTimeline';
import { EventReadinessChecklist } from '../../components/accueilpro/EventReadinessChecklist';
import { AccueilProContactCard } from '../../components/accueilpro/AccueilProContactCard';
import {
  AccueilProChip,
  AccueilProFormCard,
  AccueilProLinkButton,
  AccueilProPrimaryButton,
  AccueilProScreenLayout,
  apStyles,
} from '../../components/accueilpro/AccueilProUI';
import { Spacing } from '../../theme/spacing';
import { useLanguage } from '../../context/LanguageContext';
import {
  deleteApDayPlanItem,
  findApRoomInspection,
  getApEvent,
  listApConventionsByEvent,
  listApDayPlanItemsForEvent,
  listApEventPersonnel,
  listApVenues,
  resolveSpacesForEvent,
  seedApDayPlanFromSingleEvent,
} from '../../db/accueilProDb';
import { contactFieldLabelsFromT, eventPersonnelContactLines } from '../../lib/accueilProContactDisplay';
import type {
  ApConvention,
  ApDayPlanItem,
  ApEvent,
  ApEventPersonnel,
  ApInspectionKind,
  ApRoomInspection,
  ApSpace,
} from '../../types/accueilPro';
import { parsePhotosJson } from '../../modules/accueilpro/constants/inspectionChecklist';

type EventTabId = 'overview' | 'team' | 'agenda';

export default function AccueilProEventDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { t } = useLanguage();
  const eventId = route.params?.id as string;
  const [tab, setTab] = useState<EventTabId>('overview');
  const [event, setEvent] = useState<ApEvent | null>(null);
  const [spaces, setSpaces] = useState<ApSpace[]>([]);
  const [conventions, setConventions] = useState<ApConvention[]>([]);
  const [team, setTeam] = useState<ApEventPersonnel[]>([]);
  const [agendaItems, setAgendaItems] = useState<ApDayPlanItem[]>([]);
  const [venueNames, setVenueNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const planDate = useMemo(() => (event?.date_debut ?? '').slice(0, 10), [event?.date_debut]);
  const contactFieldLabels = useMemo(() => contactFieldLabelsFromT(t), [t]);
  const spaceNames = useMemo(() => Object.fromEntries(spaces.map(s => [s.id, s.name])), [spaces]);

  const load = useCallback(async () => {
    try {
      const ev = await getApEvent(eventId);
      setEvent(ev);
      if (ev) {
        const [sp, conv, tp, venues, plan] = await Promise.all([
          resolveSpacesForEvent(ev),
          listApConventionsByEvent(eventId),
          listApEventPersonnel(eventId),
          listApVenues(),
          listApDayPlanItemsForEvent(eventId, ev.date_debut.slice(0, 10)),
        ]);
        setSpaces(sp);
        setConventions(conv);
        setTeam(tp);
        setAgendaItems(plan);
        setVenueNames(Object.fromEntries(venues.map(v => [v.id, v.name])));
      }
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const spacesLabel =
    event?.spaces_mode === 'all'
      ? t('accueilpro.spaces.allHint', { n: String(spaces.length) })
      : t('accueilpro.spaces.selectedCount', { n: String(spaces.length) });

  const tabs: { id: EventTabId; label: string }[] = [
    { id: 'overview', label: t('accueilpro.eventTab.overview') },
    { id: 'team', label: t('accueilpro.eventTab.team') },
    { id: 'agenda', label: t('accueilpro.eventTab.agenda') },
  ];

  const whereLabel = (item: ApDayPlanItem) => {
    const space = item.space_id ? spaceNames[item.space_id] : null;
    const venue = item.venue_id ? venueNames[item.venue_id] : null;
    if (space && venue) return `${space} · ${venue}`;
    return space ?? venue ?? t('accueilpro.dayPlan.noSpace');
  };

  const onSeedAgenda = async () => {
    const n = await seedApDayPlanFromSingleEvent(eventId);
    if (n > 0) await load();
  };

  const onDeleteAgendaItem = (item: ApDayPlanItem) => {
    Alert.alert(t('accueilpro.deleteConfirmTitle'), t('accueilpro.dayPlan.deleteBody'), [
      { text: t('accueilpro.cancel'), style: 'cancel' },
      {
        text: t('accueilpro.delete'),
        style: 'destructive',
        onPress: () => void deleteApDayPlanItem(item.id).then(() => load()),
      },
    ]);
  };

  return (
    <AccueilProScreenLayout
      backLabel={t('accueilpro.back')}
      onBack={() => navigation.goBack()}
      headerIcon={<Text style={{ fontSize: 22 }}>📅</Text>}
      headerTitle={event?.name ?? t('accueilpro.events.title')}
      headerRightLabel={event ? t('accueilpro.edit') : undefined}
      onHeaderRight={
        event ? () => navigation.navigate('AccueilProEventEdit', { id: event.id }) : undefined
      }
      loading={loading || !event}
      refreshing={refreshing}
      onRefresh={() => void onRefresh()}
    >
      {event ?
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 14 }}>
            {tabs.map(item => (
              <AccueilProChip
                key={item.id}
                label={item.label}
                selected={tab === item.id}
                onPress={() => setTab(item.id)}
              />
            ))}
          </View>

          {tab === 'overview' ?
            <>
              <AccueilProFormCard>
                <Text style={apStyles.detailLine}>
                  <Text style={apStyles.detailLabel}>{t('accueilpro.events.fieldStart')} : </Text>
                  {event.date_debut}
                  {event.heure_debut ? ` · ${event.heure_debut}` : ''}
                </Text>
                {event.date_fin || event.heure_fin ?
                  <Text style={apStyles.detailLine}>
                    <Text style={apStyles.detailLabel}>{t('accueilpro.requests.fieldDateEnd')} : </Text>
                    {event.date_fin ?? event.date_debut}
                    {event.heure_fin ? ` · ${event.heure_fin}` : ''}
                  </Text>
                : null}
                <Text style={apStyles.detailLine}>
                  <Text style={apStyles.detailLabel}>{t('accueilpro.spaces.title')} : </Text>
                  {spacesLabel}
                </Text>
              </AccueilProFormCard>

              <AccueilProFormCard style={{ marginBottom: Spacing.sm }}>
                <EventReadinessChecklist eventId={eventId} onChanged={() => void load()} />
              </AccueilProFormCard>

              <AccueilProLinkButton
                label={t('accueilpro.feuille.openEvent')}
                onPress={() => navigation.navigate('AccueilProFeuilleRouteEvent', { eventId: event.id })}
              />

              <AccueilProLinkButton
                label={t('accueilpro.infoSheet.open')}
                onPress={() => navigation.navigate('AccueilProEventInfoSheet', { eventId: event.id })}
              />

              <AccueilProLinkButton
                label={t('accueilpro.edlCompare.open')}
                onPress={() => navigation.navigate('AccueilProEventInspectionCompare', { eventId })}
              />

              <View style={apStyles.sectionHeader}>
                <Text style={apStyles.sectionTitle}>{t('accueilpro.inspection.section')}</Text>
              </View>
              {spaces.map(sp => (
                <AccueilProFormCard key={sp.id} style={{ marginBottom: Spacing.sm }}>
                  <Text style={apStyles.rowTitle}>{sp.name}</Text>
                  <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm }}>
                    <InspectionBtn
                      eventId={eventId}
                      spaceId={sp.id}
                      type="entrée"
                      label={t('accueilpro.inspection.entry')}
                      navigation={navigation}
                    />
                    <InspectionBtn
                      eventId={eventId}
                      spaceId={sp.id}
                      type="sortie"
                      label={t('accueilpro.inspection.exit')}
                      navigation={navigation}
                    />
                  </View>
                </AccueilProFormCard>
              ))}

              <View style={apStyles.sectionHeader}>
                <Text style={apStyles.sectionTitle}>{t('accueilpro.conventions.section')}</Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('AccueilProConventionEdit', { eventId: event.id })}
                >
                  <Text style={apStyles.sectionLink}>+ {t('accueilpro.orgs.add')}</Text>
                </TouchableOpacity>
              </View>
              {conventions.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={apStyles.row}
                  onPress={() => navigation.navigate('AccueilProConventionEdit', { eventId: event.id, id: c.id })}
                >
                  <Text style={apStyles.rowTitle}>{c.titre}</Text>
                  <Text style={apStyles.rowMeta}>{c.status}</Text>
                </TouchableOpacity>
              ))}
            </>
          : null}

          {tab === 'team' ?
            <>
              <View style={apStyles.sectionHeader}>
                <Text style={apStyles.sectionTitle}>{t('accueilpro.eventTeam.title')}</Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('AccueilProEventPersonnel', { eventId })}
                >
                  <Text style={apStyles.sectionLink}>{t('accueilpro.eventTeam.manage')}</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[
                  apStyles.formCard,
                  { marginBottom: Spacing.sm, paddingVertical: 12 },
                ]}
                onPress={() => navigation.navigate('AccueilProContacts')}
              >
                <Text style={[apStyles.rowTitle, { flex: undefined }]}>{t('accueilpro.eventTeam.openDirectory')}</Text>
                <Text style={[apStyles.rowMeta, { marginTop: 4 }]}>{t('accueilpro.eventTeam.directoryHint')}</Text>
              </TouchableOpacity>
              {team.length === 0 ?
                <>
                  <Text style={apStyles.empty}>{t('accueilpro.eventTeam.empty')}</Text>
                  <AccueilProPrimaryButton
                    label={t('accueilpro.eventTeam.manage')}
                    onPress={() => navigation.navigate('AccueilProEventPersonnel', { eventId })}
                    style={{ marginTop: Spacing.sm }}
                  />
                </>
              : team.map(m => (
                  <AccueilProContactCard
                    key={m.id}
                    displayName={m.name.trim()}
                    lines={eventPersonnelContactLines(m, contactFieldLabels)}
                    phone={m.phone}
                    email={m.email}
                    emailSubject={`StageStock · ${m.name}`}
                  />
                ))
              }
            </>
          : null}

          {tab === 'agenda' ?
            <EventDayAgendaTimeline
              items={agendaItems}
              planDate={planDate}
              emptyMessage={t('accueilpro.eventAgenda.empty')}
              addLabel={t('accueilpro.eventAgenda.add')}
              seedLabel={t('accueilpro.eventAgenda.seed')}
              onAdd={() =>
                navigation.navigate('AccueilProDayPlanEdit', {
                  date: planDate,
                  eventId: event.id,
                })
              }
              onSeed={() => void onSeedAgenda()}
              onPressItem={item =>
                navigation.navigate('AccueilProDayPlanEdit', {
                  id: item.id,
                  date: planDate,
                  eventId: event.id,
                })
              }
              onDeleteItem={onDeleteAgendaItem}
              deleteAccessibilityLabel={t('accueilpro.dayPlan.deleteSlot')}
              whereLabel={whereLabel}
              labels={{
                who: t('accueilpro.dayPlan.colWho'),
                where: t('accueilpro.dayPlan.colWhere'),
                linkedNotes: t('accueilpro.field.notes'),
              }}
            />
          : null}
        </>
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
  React.useEffect(() => {
    void findApRoomInspection(eventId, spaceId, type).then((i: ApRoomInspection | null) => {
      setDone(i?.status === 'terminé');
      setPhotoCount(i ? parsePhotosJson(i.photos).length : 0);
    });
  }, [eventId, spaceId, type]);

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

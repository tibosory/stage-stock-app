import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import {
  AccueilProEmpty,
  AccueilProLinkButton,
  AccueilProListRow,
  AccueilProPrimaryButton,
  AccueilProScreenLayout,
  AccueilProSectionCard,
  AccueilProStatusBadge,
  AccueilProTypeBadge,
  AccueilProColors,
} from '../../components/accueilpro/AccueilProUI';
import { useLanguage } from '../../context/LanguageContext';
import {
  getApDayNote,
  getApVenue,
  listApConventions,
  listApDayPlanItems,
  listApEventPersonnel,
  listApEvents,
  listApInspections,
  listApPersonnel,
  listApVenues,
  listSpaces,
  saveApDayNote,
} from '../../db/accueilProDb';
import { formatDayPlanTimeRange, sortDayPlanItems } from '../../lib/accueilProDayPlanHelpers';
import { eventsOnDate, shiftIsoDate } from '../../lib/accueilProFeuilleHelpers';
import { exportAccueilProFeuilleRoutePdf } from '../../lib/accueilProFeuilleRoutePdf';
import type { ApDayPlanItem, ApEvent, ApEventPersonnel, ApRoomInspection, ApVenue } from '../../types/accueilPro';
import { todayIsoDate } from './accueilProScreenCommon';

export default function AccueilProFeuilleRouteScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { t } = useLanguage();
  const [date, setDate] = useState((route.params?.date as string | undefined) ?? todayIsoDate());
  const [note, setNote] = useState('');
  const [events, setEvents] = useState<ApEvent[]>([]);
  const [dayPlan, setDayPlan] = useState<ApDayPlanItem[]>([]);
  const [venues, setVenues] = useState<ApVenue[]>([]);
  const [spaceNames, setSpaceNames] = useState<Record<string, string>>({});
  const [edl, setEdl] = useState<ApRoomInspection[]>([]);
  const [conventions, setConventions] = useState<{ id: string; titre: string; status: string }[]>([]);
  const [personnelByEvent, setPersonnelByEvent] = useState<Record<string, ApEventPersonnel[]>>({});
  const [teamCount, setTeamCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    const [allEvents, allEdl, allConv, team, planRows, dayNote, venueList] = await Promise.all([
      listApEvents(),
      listApInspections(),
      listApConventions(),
      listApPersonnel({ kind: 'lieu' }),
      listApDayPlanItems(date),
      getApDayNote(date),
      listApVenues(),
    ]);
    const dayEvents = eventsOnDate(allEvents, date);
    const venueIds = [...new Set(dayEvents.map(e => e.venue_id).filter(Boolean))] as string[];
    const venueRows = await Promise.all(venueIds.map(id => getApVenue(id)));
    const persEntries = await Promise.all(dayEvents.map(async ev => [ev.id, await listApEventPersonnel(ev.id)] as const));
    const spaces = await Promise.all(venueList.map(v => listSpaces(v.id)));
    setEvents(dayEvents);
    setDayPlan(sortDayPlanItems(planRows));
    setVenues(venueRows.filter(Boolean) as ApVenue[]);
    setSpaceNames(Object.fromEntries(spaces.flat().map(s => [s.id, s.name])));
    setEdl(allEdl.filter(e => dayEvents.some(ev => ev.id === e.event_id)));
    setConventions(
      allConv
        .filter(c => c.event_id && dayEvents.some(ev => ev.id === c.event_id))
        .map(c => ({ id: c.id, titre: c.titre, status: c.status }))
    );
    setPersonnelByEvent(Object.fromEntries(persEntries));
    setTeamCount(team.filter(m => venueIds.includes(m.venue_id)).length);
    setNote(dayNote?.note ?? '');
  }, [date]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load().finally(() => setLoading(false));
    }, [load])
  );

  const dateLabel = useMemo(() => {
    try {
      return new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return date;
    }
  }, [date]);

  const onExport = async () => {
    setExporting(true);
    try {
      await exportAccueilProFeuilleRoutePdf({
        date,
        dateLabel,
        events,
        venues,
        edl,
        conventions,
        personnelByEvent,
        note,
        teamCount,
        dayPlan,
        spaceNames,
      });
    } catch (e) {
      Alert.alert(t('accueilpro.feuille.exportError'), e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  };

  return (
    <AccueilProScreenLayout
      backLabel={t('accueilpro.back')}
      onBack={() => navigation.goBack()}
      headerIcon={<Text style={{ fontSize: 22 }}>🗒</Text>}
      headerTitle={t('accueilpro.feuille.title')}
      headerSubtitle={t('accueilpro.feuille.subtitle')}
      loading={loading}
      footer={<AccueilProPrimaryButton label={t('accueilpro.feuille.export')} onPress={() => void onExport()} loading={exporting} />}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <TouchableOpacity onPress={() => setDate(d => shiftIsoDate(d, -1))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={{ fontSize: 22, paddingHorizontal: 8 }}>‹</Text>
        </TouchableOpacity>
        <TextInput
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          style={{
            flex: 1,
            backgroundColor: '#fff',
            borderRadius: 8,
            borderWidth: 1,
            borderColor: AccueilProColors.borderSubtle,
            padding: 12,
          }}
        />
        <TouchableOpacity onPress={() => setDate(d => shiftIsoDate(d, 1))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={{ fontSize: 22, paddingHorizontal: 8 }}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={{ backgroundColor: AccueilProColors.navy, borderRadius: 14, padding: 16, marginBottom: 16 }}>
        <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, textTransform: 'uppercase' }}>{t('accueilpro.feuille.dayOf')}</Text>
        <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700', textTransform: 'capitalize', marginTop: 4 }}>{dateLabel}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 14, gap: 8 }}>
          {[
            { v: events.length, l: t('accueilpro.feuille.statEvents') },
            { v: venues.length, l: t('accueilpro.feuille.statVenues') },
            { v: teamCount, l: t('accueilpro.feuille.statTeam') },
            { v: edl.length, l: 'EDL' },
            { v: conventions.length, l: t('accueilpro.nav.conventions') },
          ].map(s => (
            <View key={s.l} style={{ alignItems: 'center', minWidth: '18%' }}>
              <Text style={{ color: AccueilProColors.gold, fontSize: 24, fontWeight: '800' }}>{s.v}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>{s.l}</Text>
            </View>
          ))}
        </View>
      </View>

      {events.length === 0 && dayPlan.length === 0 ?
        <AccueilProEmpty message={t('accueilpro.feuille.empty')} />
      : <>
          {dayPlan.length > 0 ?
            <AccueilProSectionCard
              title={t('accueilpro.dayPlan.schedule')}
              actionLabel={t('accueilpro.edit')}
              onAction={() => navigation.navigate('AccueilProDayPlan', { date })}
            >
              {dayPlan.map(item => (
                <View key={item.id} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: AccueilProColors.borderSubtle }}>
                  <Text style={{ fontWeight: '700', color: AccueilProColors.gold }}>{formatDayPlanTimeRange(item)}</Text>
                  <Text style={{ fontWeight: '600', marginTop: 2 }}>{item.title}</Text>
                  <Text style={{ fontSize: 12, color: AccueilProColors.textMuted, marginTop: 2 }}>
                    {t('accueilpro.dayPlan.colWho')}: {item.assignee_name ?? '—'} · {t('accueilpro.dayPlan.colWhere')}:{' '}
                    {(item.space_id && spaceNames[item.space_id]) || '—'}
                  </Text>
                </View>
              ))}
            </AccueilProSectionCard>
          : <View style={{ marginBottom: 12 }}>
              <AccueilProLinkButton
                label={t('accueilpro.dayPlan.openDetailed')}
                onPress={() => navigation.navigate('AccueilProDayPlan', { date })}
              />
            </View>}

          {events.length > 0 ?
          <AccueilProSectionCard title={t('accueilpro.feuille.events')}>
            {events.map(ev => (
              <View key={ev.id} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: AccueilProColors.borderSubtle }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                      <AccueilProStatusBadge status={ev.status} />
                      <AccueilProTypeBadge type={ev.type} />
                    </View>
                    <Text style={{ fontWeight: '700', fontSize: 15 }}>{ev.name}</Text>
                    <Text style={{ color: AccueilProColors.textMuted, fontSize: 13 }}>{ev.organisateur ?? '—'}</Text>
                    {(personnelByEvent[ev.id] ?? []).length > 0 ?
                      <Text style={{ color: AccueilProColors.textSecondary, fontSize: 12, marginTop: 4 }}>
                        {t('accueilpro.feuille.teamDay')}: {(personnelByEvent[ev.id] ?? []).map(p => p.name).join(', ')}
                      </Text>
                    : null}
                  </View>
                  <Text style={{ fontWeight: '700', color: AccueilProColors.gold, fontSize: 18 }}>{ev.heure_debut ?? '—'}</Text>
                </View>
              </View>
            ))}
          </AccueilProSectionCard>
          : null}

          {edl.length > 0 ?
            <AccueilProSectionCard title={t('accueilpro.nav.inspections')}>
              {edl.map(item => (
                <AccueilProListRow
                  key={item.id}
                  title={`EDL ${item.type}`}
                  meta={item.inspection_date ?? item.updated_at?.slice(0, 10) ?? '—'}
                  rightAccessory={<AccueilProStatusBadge status={item.status} />}
                  showChevron={false}
                />
              ))}
            </AccueilProSectionCard>
          : null}

          {conventions.length > 0 ?
            <AccueilProSectionCard title={t('accueilpro.nav.conventions')}>
              {conventions.map(c => (
                <AccueilProListRow key={c.id} title={c.titre} meta={c.status} showChevron={false} />
              ))}
            </AccueilProSectionCard>
          : null}

          <AccueilProSectionCard title={t('accueilpro.feuille.notes')}>
            <TextInput
              value={note}
              onChangeText={setNote}
              onBlur={() => void saveApDayNote(date, note)}
              multiline
              numberOfLines={5}
              placeholder={t('accueilpro.feuille.notesPlaceholder')}
              style={{ backgroundColor: AccueilProColors.cream, borderRadius: 8, padding: 12, minHeight: 100, textAlignVertical: 'top' }}
            />
          </AccueilProSectionCard>
        </>}
    </AccueilProScreenLayout>
  );
}

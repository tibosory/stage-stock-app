import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import {
  AccueilProEmpty,
  AccueilProLinkButton,
  AccueilProPrimaryButton,
  AccueilProScreenLayout,
  AccueilProSectionCard,
  AccueilProColors,
} from '../../components/accueilpro/AccueilProUI';
import { useLanguage } from '../../context/LanguageContext';
import {
  deleteApDayPlanItem,
  getApDayNote,
  listApDayPlanItems,
  listApEvents,
  listApVenues,
  listSpaces,
  saveApDayNote,
  seedApDayPlanFromEvents,
} from '../../db/accueilProDb';
import { formatDayPlanTimeRange, sortDayPlanItems } from '../../lib/accueilProDayPlanHelpers';
import { shiftIsoDate } from '../../lib/accueilProFeuilleHelpers';
import type { ApDayPlanItem, ApEvent } from '../../types/accueilPro';
import { todayIsoDate } from './accueilProScreenCommon';

export default function AccueilProDayPlanScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { t } = useLanguage();
  const initialDate = (route.params?.date as string | undefined) ?? todayIsoDate();
  const [date, setDate] = useState(initialDate);
  const [items, setItems] = useState<ApDayPlanItem[]>([]);
  const [events, setEvents] = useState<Record<string, ApEvent>>({});
  const [spaceNames, setSpaceNames] = useState<Record<string, string>>({});
  const [venueNames, setVenueNames] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingNote, setSavingNote] = useState(false);

  const load = useCallback(async () => {
    const [rows, dayNote, allEvents, venues] = await Promise.all([
      listApDayPlanItems(date),
      getApDayNote(date),
      listApEvents(),
      listApVenues(),
    ]);
    const eventMap = Object.fromEntries(allEvents.map(e => [e.id, e]));
    const vMap = Object.fromEntries(venues.map(v => [v.id, v.name]));
    const spaces = await Promise.all(venues.map(v => listSpaces(v.id)));
    const sMap = Object.fromEntries(spaces.flat().map(s => [s.id, s.name]));
    setItems(sortDayPlanItems(rows));
    setEvents(eventMap);
    setSpaceNames(sMap);
    setVenueNames(vMap);
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

  const onSeed = async () => {
    const n = await seedApDayPlanFromEvents(date);
    if (n === 0) {
      Alert.alert(t('accueilpro.dayPlan.seedTitle'), t('accueilpro.dayPlan.seedNothing'));
      return;
    }
    Alert.alert(t('accueilpro.dayPlan.seedTitle'), t('accueilpro.dayPlan.seedOk', { count: String(n) }));
    await load();
  };

  const onDelete = (item: ApDayPlanItem) => {
    Alert.alert(t('accueilpro.deleteConfirmTitle'), t('accueilpro.dayPlan.deleteBody'), [
      { text: t('accueilpro.cancel'), style: 'cancel' },
      {
        text: t('accueilpro.delete'),
        style: 'destructive',
        onPress: () => void deleteApDayPlanItem(item.id).then(load),
      },
    ]);
  };

  const onSaveNote = async () => {
    setSavingNote(true);
    try {
      await saveApDayNote(date, note);
    } finally {
      setSavingNote(false);
    }
  };

  const whereLabel = (item: ApDayPlanItem) => {
    if (item.space_id && spaceNames[item.space_id]) return spaceNames[item.space_id];
    if (item.venue_id && venueNames[item.venue_id]) return venueNames[item.venue_id];
    const ev = item.event_id ? events[item.event_id] : undefined;
    if (ev?.venue_id && venueNames[ev.venue_id]) return venueNames[ev.venue_id];
    return '—';
  };

  return (
    <AccueilProScreenLayout
      backLabel={t('accueilpro.back')}
      onBack={() => navigation.goBack()}
      headerIcon={<Text style={{ fontSize: 22 }}>🗓</Text>}
      headerTitle={t('accueilpro.dayPlan.title')}
      headerSubtitle={t('accueilpro.dayPlan.subtitle')}
      headerRightLabel={`+ ${t('accueilpro.add')}`}
      onHeaderRight={() => navigation.navigate('AccueilProDayPlanEdit', { date })}
      loading={loading}
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
        <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, textTransform: 'uppercase' }}>
          {t('accueilpro.feuille.dayOf')}
        </Text>
        <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700', textTransform: 'capitalize', marginTop: 4 }}>
          {dateLabel}
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 8 }}>{t('accueilpro.dayPlan.modelHint')}</Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <AccueilProLinkButton
          label={t('accueilpro.dayPlan.seedFromEvents')}
          onPress={() => void onSeed()}
        />
        <AccueilProLinkButton
          label={t('accueilpro.feuille.title')}
          onPress={() => navigation.navigate('AccueilProFeuilleRoute', { date })}
        />
      </View>

      {items.length === 0 ?
        <AccueilProEmpty emoji="🗓" message={t('accueilpro.dayPlan.empty')} />
      : <AccueilProSectionCard title={t('accueilpro.dayPlan.schedule')}>
          {items.map(item => (
            <TouchableOpacity
              key={item.id}
              onPress={() => navigation.navigate('AccueilProDayPlanEdit', { id: item.id, date: item.plan_date })}
              onLongPress={() => onDelete(item)}
              style={{
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: AccueilProColors.borderSubtle,
              }}
            >
              <Text style={{ fontWeight: '800', color: AccueilProColors.gold, fontSize: 16, marginBottom: 6 }}>
                {formatDayPlanTimeRange(item)}
              </Text>
              <Text style={{ fontSize: 12, color: AccueilProColors.textMuted, marginBottom: 2 }}>
                {t('accueilpro.dayPlan.colWhat')}
              </Text>
              <Text style={{ fontWeight: '700', fontSize: 15, marginBottom: 6 }}>{item.title}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                <View style={{ minWidth: '45%' }}>
                  <Text style={{ fontSize: 11, color: AccueilProColors.textMuted }}>{t('accueilpro.dayPlan.colWho')}</Text>
                  <Text style={{ fontSize: 13 }}>{item.assignee_name?.trim() || '—'}</Text>
                </View>
                <View style={{ minWidth: '45%' }}>
                  <Text style={{ fontSize: 11, color: AccueilProColors.textMuted }}>{t('accueilpro.dayPlan.colWhere')}</Text>
                  <Text style={{ fontSize: 13 }}>{whereLabel(item)}</Text>
                </View>
              </View>
              {item.event_id && events[item.event_id] ?
                <Text style={{ fontSize: 11, color: AccueilProColors.textSecondary, marginTop: 6 }}>
                  {t('accueilpro.dayPlan.linkedEvent')}: {events[item.event_id].name}
                </Text>
              : null}
              {item.notes?.trim() ?
                <Text style={{ fontSize: 12, color: AccueilProColors.textSecondary, marginTop: 4 }}>{item.notes}</Text>
              : null}
            </TouchableOpacity>
          ))}
        </AccueilProSectionCard>}

      <AccueilProSectionCard title={t('accueilpro.feuille.notes')}>
        <TextInput
          value={note}
          onChangeText={setNote}
          onBlur={() => void onSaveNote()}
          multiline
          numberOfLines={4}
          placeholder={t('accueilpro.feuille.notesPlaceholder')}
          style={{
            backgroundColor: AccueilProColors.cream,
            borderRadius: 8,
            padding: 12,
            minHeight: 90,
            textAlignVertical: 'top',
          }}
        />
        <View style={{ marginTop: 10 }}>
          <AccueilProPrimaryButton label={t('accueilpro.save')} onPress={() => void onSaveNote()} loading={savingNote} />
        </View>
      </AccueilProSectionCard>
    </AccueilProScreenLayout>
  );
}

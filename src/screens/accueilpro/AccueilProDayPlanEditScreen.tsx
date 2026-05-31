import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Text } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  AccueilProFormCard,
  AccueilProFormSelectPicker,
  AccueilProFormTimeField,
  AccueilProInput,
  AccueilProPrimaryButton,
  AccueilProScreenLayout,
  AccueilProLinkButton,
  apStyles,
} from '../../components/accueilpro/AccueilProUI';
import { useLanguage } from '../../context/LanguageContext';
import {
  deleteApDayPlanItem,
  getApDayPlanItem,
  getApEvent,
  listApEventPersonnel,
  listApEvents,
  listSpaces,
  saveApDayPlanItem,
} from '../../db/accueilProDb';
import { eventsOnDate } from '../../lib/accueilProFeuilleHelpers';
import { useAccueilProReferenceData } from './accueilProScreenCommon';

export default function AccueilProDayPlanEditScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { t } = useLanguage();
  const itemId = route.params?.id as string | undefined;
  const planDate = (route.params?.date as string) ?? new Date().toISOString().slice(0, 10);
  const presetEventId = route.params?.eventId as string | undefined;
  const { venueOptions, loading: refLoading } = useAccueilProReferenceData();
  const [loading, setLoading] = useState(!!itemId);
  const [saving, setSaving] = useState(false);
  const [eventId, setEventId] = useState(presetEventId ?? '');
  const [venueId, setVenueId] = useState('');
  const [spaceId, setSpaceId] = useState('');
  const [timeStart, setTimeStart] = useState('');
  const [timeEnd, setTimeEnd] = useState('');
  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState('');
  const [notes, setNotes] = useState('');
  const [spaceOptions, setSpaceOptions] = useState<{ label: string; value: string }[]>([]);
  const [eventOptions, setEventOptions] = useState<{ label: string; value: string }[]>([]);

  useEffect(() => {
    void (async () => {
      const all = await listApEvents();
      const dayEvents = eventsOnDate(all, planDate);
      setEventOptions([
        { label: t('accueilpro.dayPlan.noEvent'), value: '' },
        ...dayEvents.map(e => ({ label: e.name, value: e.id })),
      ]);
    })();
  }, [planDate, t]);

  useEffect(() => {
    if (!itemId) {
      setLoading(false);
      if (presetEventId) {
        void (async () => {
          const ev = await getApEvent(presetEventId);
          if (!ev) return;
          setEventId(ev.id);
          setVenueId(ev.venue_id ?? '');
          setTitle(ev.name);
          setTimeStart(ev.heure_debut ?? '');
          setTimeEnd(ev.heure_fin ?? '');
          const team = await listApEventPersonnel(ev.id);
          setAssignee(team.map(p => p.name).join(', '));
        })();
      }
      return;
    }
    void (async () => {
      const row = await getApDayPlanItem(itemId);
      if (row) {
        setEventId(row.event_id ?? '');
        setVenueId(row.venue_id ?? '');
        setSpaceId(row.space_id ?? '');
        setTimeStart(row.time_start ?? '');
        setTimeEnd(row.time_end ?? '');
        setTitle(row.title);
        setAssignee(row.assignee_name ?? '');
        setNotes(row.notes ?? '');
      }
      setLoading(false);
    })();
  }, [itemId, presetEventId]);

  useEffect(() => {
    void (async () => {
      let vId = venueId;
      if (!vId && eventId) {
        const ev = await getApEvent(eventId);
        vId = ev?.venue_id ?? '';
        if (vId && !venueId) setVenueId(vId);
      }
      if (!vId) {
        setSpaceOptions([]);
        return;
      }
      const spaces = await listSpaces(vId);
      setSpaceOptions([
        { label: t('accueilpro.dayPlan.noSpace'), value: '' },
        ...spaces.map(s => ({ label: s.name, value: s.id })),
      ]);
    })();
  }, [venueId, eventId, t]);

  const onEventChange = useCallback(
    async (id: string) => {
      setEventId(id);
      if (!id) return;
      const ev = await getApEvent(id);
      if (!ev) return;
      setVenueId(ev.venue_id ?? '');
      if (!title.trim()) setTitle(ev.name);
      if (!timeStart.trim()) setTimeStart(ev.heure_debut ?? '');
      if (!timeEnd.trim()) setTimeEnd(ev.heure_fin ?? '');
      const team = await listApEventPersonnel(id);
      if (!assignee.trim() && team.length) setAssignee(team.map(p => p.name).join(', '));
    },
    [assignee, timeEnd, timeStart, title]
  );

  const onSave = async () => {
    if (!title.trim()) {
      Alert.alert(t('accueilpro.orgs.errTitle'), t('accueilpro.dayPlan.errTitle'));
      return;
    }
    setSaving(true);
    try {
      await saveApDayPlanItem({
        id: itemId,
        plan_date: planDate,
        event_id: eventId || null,
        venue_id: venueId || null,
        space_id: spaceId || null,
        time_start: timeStart.trim() || null,
        time_end: timeEnd.trim() || null,
        title: title.trim(),
        assignee_name: assignee.trim() || null,
        notes: notes.trim() || null,
      });
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  };

  const onDelete = () => {
    if (!itemId) return;
    Alert.alert(t('accueilpro.deleteConfirmTitle'), t('accueilpro.dayPlan.deleteBody'), [
      { text: t('accueilpro.cancel'), style: 'cancel' },
      {
        text: t('accueilpro.delete'),
        style: 'destructive',
        onPress: () => void deleteApDayPlanItem(itemId).then(() => navigation.goBack()),
      },
    ]);
  };

  const headerTitle = useMemo(
    () => (itemId ? t('accueilpro.dayPlan.edit') : t('accueilpro.dayPlan.new')),
    [itemId, t]
  );

  return (
    <AccueilProScreenLayout
      backLabel={t('accueilpro.back')}
      onBack={() => navigation.goBack()}
      headerIcon={<Text style={{ fontSize: 22 }}>🗓</Text>}
      headerTitle={headerTitle}
      headerSubtitle={planDate}
      loading={loading || refLoading}
      footer={<AccueilProPrimaryButton label={t('accueilpro.save')} onPress={() => void onSave()} loading={saving} />}
    >
      <AccueilProFormCard>
        <Text style={apStyles.sectionTitle}>{t('accueilpro.dayPlan.colWhen')}</Text>
        <AccueilProFormTimeField label={t('accueilpro.requests.fieldTimeStart')} value={timeStart} onChange={setTimeStart} />
        <AccueilProFormTimeField label={t('accueilpro.requests.fieldTimeEnd')} value={timeEnd} onChange={setTimeEnd} />

        <Text style={[apStyles.sectionTitle, { marginTop: 12 }]}>{t('accueilpro.dayPlan.colWhat')}</Text>
        <AccueilProInput label={t('accueilpro.dayPlan.fieldActivity')} value={title} onChangeText={setTitle} required />

        <Text style={[apStyles.sectionTitle, { marginTop: 12 }]}>{t('accueilpro.dayPlan.colWho')}</Text>
        <AccueilProInput label={t('accueilpro.dayPlan.fieldPerson')} value={assignee} onChangeText={setAssignee} placeholder={t('accueilpro.dayPlan.fieldPersonPh')} />

        <Text style={[apStyles.sectionTitle, { marginTop: 12 }]}>{t('accueilpro.dayPlan.colWhere')}</Text>
<AccueilProFormSelectPicker 
          label={t('accueilpro.requests.fieldVenue')}
          value={venueId}
          onChange={setVenueId}
          options={[{ label: '—', value: '' }, ...venueOptions]}
        />
<AccueilProFormSelectPicker 
          label={t('accueilpro.spaces.title')}
          value={spaceId}
          onChange={setSpaceId}
          options={spaceOptions}
        />

        <Text style={[apStyles.sectionTitle, { marginTop: 12 }]}>{t('accueilpro.dayPlan.linkedEvent')}</Text>
<AccueilProFormSelectPicker 
          label={t('accueilpro.events.fieldName')}
          value={eventId}
          onChange={v => void onEventChange(v)}
          options={eventOptions}
        />

        <AccueilProInput label={t('accueilpro.field.notes')} value={notes} onChangeText={setNotes} multiline />
      </AccueilProFormCard>

      {itemId ?
        <AccueilProLinkButton label={t('accueilpro.delete')} onPress={onDelete} />
      : null}
    </AccueilProScreenLayout>
  );
}

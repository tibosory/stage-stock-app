import React, { useCallback, useEffect, useState } from 'react';
import { Text, Alert, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import {
  AccueilProFormCard,
  AccueilProFormDateField,
  AccueilProFormSelectPicker,
  AccueilProFormTimeField,
  AccueilProInput,
  AccueilProLinkButton,
  AccueilProPrimaryButton,
  AccueilProScreenLayout,
  apStyles,
} from '../../components/accueilpro/AccueilProUI';
import { useLanguage } from '../../context/LanguageContext';
import {
  generateApId,
  getApEvent,
  listEventSpaceIds,
  saveApEvent,
  setEventSpaces,
} from '../../db/accueilProDb';
import type { ApSpacesMode, ApEventStatus } from '../../types/accueilPro';
import { SpaceSelectionEditor } from '../../components/accueilpro/SpaceSelectionEditor';
import { todayIsoDate, useAccueilProReferenceData } from './accueilProScreenCommon';
import {
  findBookingConflictsForDraft,
  formatBookingConflictLine,
} from '../../lib/accueilProBookingConflicts';
import { logAccueilProAction } from '../../lib/accueilProActivityLog';
import { AP_EVENT_STATUS_OPTIONS } from '../../lib/accueilProEventFilters';
import { useAppAuth } from '../../context/AuthContext';

export default function AccueilProEventEditScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { t } = useLanguage();
  const { user } = useAppAuth();
  const eventId = route.params?.id as string | undefined;
  const { orgOptions, venueOptions, loading: refLoading, reload: reloadRefs } = useAccueilProReferenceData();
  const [loading, setLoading] = useState(!!eventId);
  const [saving, setSaving] = useState(false);
  const [organizationId, setOrganizationId] = useState('');
  const [venueId, setVenueId] = useState('');
  const [spaceId, setSpaceId] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [dateDebut, setDateDebut] = useState(todayIsoDate());
  const [dateFin, setDateFin] = useState('');
  const [heureDebut, setHeureDebut] = useState('09:00');
  const [heureFin, setHeureFin] = useState('18:00');
  const [participants, setParticipants] = useState('0');
  const [description, setDescription] = useState('');
  const [spacesMode, setSpacesMode] = useState<ApSpacesMode>('all');
  const [selectedSpaceIds, setSelectedSpaceIds] = useState<string[]>([]);
  const [status, setStatus] = useState<ApEventStatus>('confirmé');

  useEffect(() => {
    if (!eventId) {
      setLoading(false);
      return;
    }
    void (async () => {
      const ev = await getApEvent(eventId);
      if (ev) {
        setOrganizationId(ev.organization_id ?? '');
        setVenueId(ev.venue_id ?? '');
        setSpaceId(ev.space_id ?? '');
        setName(ev.name);
        setType(ev.type ?? '');
        setDateDebut(ev.date_debut);
        setDateFin(ev.date_fin ?? '');
        setHeureDebut(ev.heure_debut ?? '09:00');
        setHeureFin(ev.heure_fin ?? '18:00');
        setParticipants(String(ev.participants ?? 0));
        setDescription(ev.description ?? '');
        setSpacesMode(ev.spaces_mode ?? 'all');
        setSelectedSpaceIds(await listEventSpaceIds(eventId));
        setStatus(ev.status ?? 'confirmé');
      }
      setLoading(false);
    })();
  }, [eventId]);

  useFocusEffect(
    useCallback(() => {
      reloadRefs();
      const selectOrg = route.params?.selectOrganizationId as string | undefined;
      const selectOrgName = route.params?.selectOrganizationName as string | undefined;
      const selectVenue = route.params?.selectVenueId as string | undefined;
      if (selectOrg) setOrganizationId(selectOrg);
      if (selectOrgName && !eventId) {
        setName(prev => (prev.trim() ? prev : selectOrgName));
      }
      if (selectVenue) {
        setVenueId(selectVenue);
        setSpaceId('');
      }
    }, [reloadRefs, route.params?.selectOrganizationId, route.params?.selectOrganizationName, route.params?.selectVenueId, eventId])
  );

  const persistEvent = useCallback(async () => {
    const id = eventId ?? generateApId();
    const existing = eventId ? await getApEvent(eventId) : null;
    await saveApEvent({
      id,
      organization_id: organizationId || null,
      venue_id: venueId || null,
      space_id: spaceId || null,
      name: name.trim(),
      type: type.trim() || null,
      date_debut: dateDebut,
      date_fin: dateFin || null,
      heure_debut: heureDebut.trim() || null,
      heure_fin: heureFin.trim() || null,
      participants: parseInt(participants, 10) || 0,
      description: description.trim() || null,
      status,
      spaces_mode: spacesMode,
      selected_space_ids: selectedSpaceIds,
      readiness_manual: existing?.readiness_manual ?? {},
    });
    await setEventSpaces(id, selectedSpaceIds, spacesMode);
    void logAccueilProAction({
      action: 'event.saved',
      entity: 'event',
      entityId: id,
      summary: `Événement ${eventId ? 'modifié' : 'créé'} : ${name.trim()}`,
      actorName: user?.nom,
    });
    if (!eventId) {
      navigation.replace('AccueilProEventDetail', { id });
    } else {
      navigation.goBack();
    }
  }, [
    eventId,
    organizationId,
    venueId,
    spaceId,
    name,
    type,
    dateDebut,
    dateFin,
    heureDebut,
    heureFin,
    participants,
    description,
    spacesMode,
    selectedSpaceIds,
    status,
    navigation,
    user?.nom,
  ]);

  const onSave = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert(t('accueilpro.orgs.errTitle'), t('accueilpro.events.errName'));
      return;
    }
    if (!dateDebut) {
      Alert.alert(t('accueilpro.orgs.errTitle'), t('accueilpro.requests.errDate'));
      return;
    }
    setSaving(true);
    try {
      const conflicts = await findBookingConflictsForDraft({
        venueId: venueId || null,
        spacesMode,
        selectedSpaceIds,
        dateDebut,
        dateFin: dateFin || null,
        heureDebut: heureDebut.trim() || null,
        heureFin: heureFin.trim() || null,
        excludeEventId: eventId ?? null,
      });
      if (conflicts.length > 0) {
        const body = [
          t('accueilpro.booking.conflictBody'),
          ...conflicts.slice(0, 5).map(c => t('accueilpro.booking.conflictItem', { line: formatBookingConflictLine(c) })),
        ].join('\n');
        Alert.alert(t('accueilpro.booking.conflictTitle'), body, [
          { text: t('accueilpro.cancel'), style: 'cancel' },
          { text: t('accueilpro.booking.conflictContinue'), onPress: () => void persistEvent() },
        ]);
        return;
      }
      await persistEvent();
    } finally {
      setSaving(false);
    }
  }, [
    name,
    dateDebut,
    venueId,
    spacesMode,
    selectedSpaceIds,
    dateFin,
    heureDebut,
    heureFin,
    eventId,
    t,
    persistEvent,
  ]);

  const eventReturnParams = eventId ? { eventEditId: eventId } : {};

  return (
    <AccueilProScreenLayout
      backLabel={t('accueilpro.back')}
      onBack={() => navigation.goBack()}
      headerIcon={<Text style={{ fontSize: 22 }}>📅</Text>}
      headerTitle={eventId ? t('accueilpro.events.edit') : t('accueilpro.events.new')}
      loading={loading || refLoading}
      footer={
        <AccueilProPrimaryButton
          label={t('accueilpro.save')}
          onPress={() => void onSave()}
          loading={saving}
        />
      }
    >
      <AccueilProFormCard>
        <AccueilProInput label={t('accueilpro.events.fieldName')} value={name} onChangeText={setName} required />
        <AccueilProInput label={t('accueilpro.events.fieldType')} value={type} onChangeText={setType} />
        <AccueilProInput
          label={t('accueilpro.events.fieldParticipants')}
          value={participants}
          onChangeText={setParticipants}
          keyboardType="number-pad"
        />
        <AccueilProInput label={t('accueilpro.events.fieldDesc')} value={description} onChangeText={setDescription} multiline />
        <AccueilProFormSelectPicker
          label={t('accueilpro.events.fieldStatus')}
          value={status}
          options={AP_EVENT_STATUS_OPTIONS.map(s => ({ value: s, label: t(`accueilpro.events.status.${s}`) }))}
          onChange={v => setStatus(v as ApEventStatus)}
        />
      </AccueilProFormCard>

      <AccueilProFormCard>
        <Text style={apStyles.sectionTitle}>{t('accueilpro.events.sectionSchedule')}</Text>
        <AccueilProFormDateField label={t('accueilpro.requests.fieldDateStart')} value={dateDebut} onChange={setDateDebut} required />
        <AccueilProFormDateField label={t('accueilpro.requests.fieldDateEnd')} value={dateFin} onChange={setDateFin} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <AccueilProFormTimeField label={t('accueilpro.requests.fieldTimeStart')} value={heureDebut} onChange={setHeureDebut} required />
          </View>
          <View style={{ flex: 1 }}>
            <AccueilProFormTimeField label={t('accueilpro.requests.fieldTimeEnd')} value={heureFin} onChange={setHeureFin} required />
          </View>
        </View>
      </AccueilProFormCard>

      <AccueilProFormCard>
        <Text style={apStyles.sectionTitle}>{t('accueilpro.events.sectionOrgVenue')}</Text>
        <AccueilProFormSelectPicker
          label={t('accueilpro.requests.fieldOrg')}
          value={organizationId}
          options={orgOptions}
          onChange={setOrganizationId}
        />
        <AccueilProLinkButton
          label={`+ ${t('accueilpro.events.newOrganization')}`}
          onPress={() =>
            navigation.navigate('AccueilProOrganizationEdit', { returnToEvent: true, ...eventReturnParams })
          }
        />
        <AccueilProFormSelectPicker
          label={t('accueilpro.requests.fieldVenue')}
          value={venueId}
          options={venueOptions}
          onChange={v => {
            setVenueId(v);
            setSpaceId('');
          }}
        />
        <AccueilProLinkButton
          label={`+ ${t('accueilpro.events.newVenueSpaces')}`}
          onPress={() =>
            navigation.navigate('AccueilProVenueEdit', { returnToEvent: true, ...eventReturnParams })
          }
        />
        {venueId ?
          <AccueilProLinkButton
            label={`+ ${t('accueilpro.venues.addSpace')}`}
            onPress={() =>
              navigation.navigate('AccueilProSpaceEdit', { venueId, returnToEvent: true, ...eventReturnParams })
            }
            style={{ marginTop: 4 }}
          />
        : null}
        <SpaceSelectionEditor
          venueId={venueId}
          mode={spacesMode}
          selectedIds={selectedSpaceIds}
          onModeChange={setSpacesMode}
          onSelectionChange={setSelectedSpaceIds}
        />
      </AccueilProFormCard>
    </AccueilProScreenLayout>
  );
}

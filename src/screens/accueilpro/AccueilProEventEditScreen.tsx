import React, { useCallback, useEffect, useState } from 'react';
import { Text, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  AccueilProChip,
  AccueilProFormCard,
  AccueilProFormDateField,
  AccueilProFormSelectPicker,
  AccueilProInput,
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
import type { ApEventStatus, ApSpacesMode } from '../../types/accueilPro';
import { SpaceSelectionEditor } from '../../components/accueilpro/SpaceSelectionEditor';
import { todayIsoDate, useAccueilProReferenceData } from './accueilProScreenCommon';
import {
  findBookingConflictsForDraft,
  formatBookingConflictLine,
} from '../../lib/accueilProBookingConflicts';
import { logAccueilProAction } from '../../lib/accueilProActivityLog';
import { useAppAuth } from '../../context/AuthContext';

export default function AccueilProEventEditScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { t } = useLanguage();
  const { user } = useAppAuth();
  const eventId = route.params?.id as string | undefined;
  const { orgOptions, venueOptions, loading: refLoading } = useAccueilProReferenceData();
  const [loading, setLoading] = useState(!!eventId);
  const [saving, setSaving] = useState(false);
  const [organizationId, setOrganizationId] = useState('');
  const [venueId, setVenueId] = useState('');
  const [spaceId, setSpaceId] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [dateDebut, setDateDebut] = useState(todayIsoDate());
  const [dateFin, setDateFin] = useState('');
  const [heureDebut, setHeureDebut] = useState('');
  const [heureFin, setHeureFin] = useState('');
  const [participants, setParticipants] = useState('0');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ApEventStatus>('brouillon');
  const [spacesMode, setSpacesMode] = useState<ApSpacesMode>('all');
  const [selectedSpaceIds, setSelectedSpaceIds] = useState<string[]>([]);

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
        setHeureDebut(ev.heure_debut ?? '');
        setHeureFin(ev.heure_fin ?? '');
        setParticipants(String(ev.participants ?? 0));
        setDescription(ev.description ?? '');
        setStatus(ev.status);
        setSpacesMode(ev.spaces_mode ?? 'all');
        setSelectedSpaceIds(await listEventSpaceIds(eventId));
      }
      setLoading(false);
    })();
  }, [eventId]);

  const persistEvent = useCallback(async () => {
    const id = eventId ?? generateApId();
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
    status,
    spacesMode,
    selectedSpaceIds,
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

  const statuses: ApEventStatus[] = ['brouillon', 'confirmé', 'annulé', 'terminé'];

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
<AccueilProFormSelectPicker 
          label={t('accueilpro.requests.fieldOrg')}
          value={organizationId}
          options={orgOptions}
          onChange={setOrganizationId}
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
        <SpaceSelectionEditor
          venueId={venueId}
          mode={spacesMode}
          selectedIds={selectedSpaceIds}
          onModeChange={setSpacesMode}
          onSelectionChange={setSelectedSpaceIds}
        />
        <AccueilProInput label={t('accueilpro.events.fieldType')} value={type} onChangeText={setType} />
        <AccueilProFormDateField label={t('accueilpro.requests.fieldDateStart')} value={dateDebut} onChange={setDateDebut} />
        <AccueilProFormDateField label={t('accueilpro.requests.fieldDateEnd')} value={dateFin} onChange={setDateFin} />
        <AccueilProInput label={t('accueilpro.requests.fieldTimeStart')} value={heureDebut} onChangeText={setHeureDebut} />
        <AccueilProInput label={t('accueilpro.requests.fieldTimeEnd')} value={heureFin} onChangeText={setHeureFin} />
        <AccueilProInput
          label={t('accueilpro.events.fieldParticipants')}
          value={participants}
          onChangeText={setParticipants}
          keyboardType="number-pad"
        />
        <AccueilProInput label={t('accueilpro.events.fieldDesc')} value={description} onChangeText={setDescription} multiline />
        <Text style={apStyles.label}>{t('accueilpro.orgs.status')}</Text>
        {statuses.map(st => (
          <AccueilProChip key={st} label={st} selected={status === st} onPress={() => setStatus(st)} />
        ))}
      </AccueilProFormCard>
    </AccueilProScreenLayout>
  );
}

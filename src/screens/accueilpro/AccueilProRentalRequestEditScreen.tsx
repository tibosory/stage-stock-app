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
  getApRentalRequest,
  listRentalRequestSpaceIds,
  saveApRentalRequest,
  setRentalRequestSpaces,
} from '../../db/accueilProDb';
import type { ApRentalStatus, ApSpacesMode } from '../../types/accueilPro';
import { SpaceSelectionEditor } from '../../components/accueilpro/SpaceSelectionEditor';
import { todayIsoDate, useAccueilProReferenceData } from './accueilProScreenCommon';
import {
  findBookingConflictsForDraft,
  formatBookingConflictLine,
} from '../../lib/accueilProBookingConflicts';
import { notifyAdminsNewAccueilProRentalRequest } from '../../lib/accueilProRentalNotifications';
import { logAccueilProAction } from '../../lib/accueilProActivityLog';
import { useAccueilProRole } from '../../modules/accueilpro/hooks/useAccueilProRole';
import { useAppAuth } from '../../context/AuthContext';
import type { ApRentalRequest } from '../../types/accueilPro';

export default function AccueilProRentalRequestEditScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { t } = useLanguage();
  const { isStaff } = useAccueilProRole();
  const { user } = useAppAuth();
  const requestId = route.params?.id as string | undefined;
  const presetOrgId = route.params?.organizationId as string | undefined;
  const { orgOptions, venueOptions, loading: refLoading } = useAccueilProReferenceData();
  const [loading, setLoading] = useState(!!requestId);
  const [saving, setSaving] = useState(false);
  const [organizationId, setOrganizationId] = useState(presetOrgId ?? '');
  const [venueId, setVenueId] = useState('');
  const [spaceId, setSpaceId] = useState('');
  const [eventName, setEventName] = useState('');
  const [dateDebut, setDateDebut] = useState(todayIsoDate());
  const [dateFin, setDateFin] = useState('');
  const [heureDebut, setHeureDebut] = useState('14:00');
  const [heureFin, setHeureFin] = useState('23:00');
  const [motif, setMotif] = useState('');
  const [staffNotes, setStaffNotes] = useState('');
  const [status, setStatus] = useState<ApRentalStatus>('soumise');
  const [spacesMode, setSpacesMode] = useState<ApSpacesMode>('all');
  const [selectedSpaceIds, setSelectedSpaceIds] = useState<string[]>([]);

  useEffect(() => {
    if (!requestId) {
      setLoading(false);
      return;
    }
    void (async () => {
      const r = await getApRentalRequest(requestId);
      if (r) {
        setOrganizationId(r.organization_id);
        setVenueId(r.venue_id ?? '');
        setSpaceId(r.space_id ?? '');
        setEventName(r.event_name ?? '');
        setDateDebut(r.date_debut);
        setDateFin(r.date_fin ?? '');
        setHeureDebut(r.heure_debut ?? '');
        setHeureFin(r.heure_fin ?? '');
        setMotif(r.motif ?? '');
        setStaffNotes(r.staff_notes ?? '');
        setStatus(r.status);
        setSpacesMode(r.spaces_mode ?? 'all');
        setSelectedSpaceIds(await listRentalRequestSpaceIds(requestId));
      }
      setLoading(false);
    })();
  }, [requestId]);

  const persistRequest = useCallback(async () => {
    const id = requestId ?? generateApId();
    const effectiveStatus = isStaff ? status : 'soumise';
    const row: ApRentalRequest = {
      id,
      organization_id: organizationId,
      venue_id: venueId || null,
      space_id: selectedSpaceIds[0] ?? (spaceId || null),
      event_name: eventName.trim() || null,
      date_debut: dateDebut,
      date_fin: dateFin || null,
      heure_debut: heureDebut.trim() || null,
      heure_fin: heureFin.trim() || null,
      motif: motif.trim() || null,
      staff_notes: isStaff ? staffNotes.trim() || null : null,
      status: effectiveStatus,
      spaces_mode: spacesMode,
      selected_space_ids: selectedSpaceIds,
    };
    await saveApRentalRequest(row);
    await setRentalRequestSpaces(id, selectedSpaceIds, spacesMode);
    if (!requestId && effectiveStatus === 'soumise') {
      void notifyAdminsNewAccueilProRentalRequest(row);
      void logAccueilProAction({
        action: 'rental.submitted',
        entity: 'rental_request',
        entityId: id,
        summary: `Demande soumise : ${row.event_name ?? id}`,
        actorName: user?.nom,
      });
    }
    navigation.goBack();
  }, [
    requestId,
    organizationId,
    venueId,
    spaceId,
    eventName,
    dateDebut,
    dateFin,
    heureDebut,
    heureFin,
    motif,
    staffNotes,
    status,
    spacesMode,
    selectedSpaceIds,
    navigation,
    isStaff,
    user?.nom,
  ]);

  const onSave = useCallback(async () => {
    if (!organizationId) {
      Alert.alert(t('accueilpro.orgs.errTitle'), t('accueilpro.requests.errOrg'));
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
        excludeRentalId: requestId ?? null,
      });
      if (conflicts.length > 0) {
        const body = [
          t('accueilpro.booking.conflictBody'),
          ...conflicts.slice(0, 5).map(c => t('accueilpro.booking.conflictItem', { line: formatBookingConflictLine(c) })),
        ].join('\n');
        Alert.alert(t('accueilpro.booking.conflictTitle'), body, [
          { text: t('accueilpro.cancel'), style: 'cancel' },
          { text: t('accueilpro.booking.conflictContinue'), onPress: () => void persistRequest() },
        ]);
        return;
      }
      await persistRequest();
    } finally {
      setSaving(false);
    }
  }, [
    organizationId,
    dateDebut,
    venueId,
    spacesMode,
    selectedSpaceIds,
    dateFin,
    heureDebut,
    heureFin,
    requestId,
    t,
    persistRequest,
  ]);

  const statuses: ApRentalStatus[] = ['soumise', 'validée', 'refusée', 'annulée'];

  return (
    <AccueilProScreenLayout
      backLabel={t('accueilpro.back')}
      onBack={() => navigation.goBack()}
      headerIcon={<Text style={{ fontSize: 22 }}>📋</Text>}
      headerTitle={requestId ? t('accueilpro.requests.edit') : t('accueilpro.requests.new')}
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
<AccueilProFormSelectPicker 
          label={t('accueilpro.requests.fieldOrg')}
          value={organizationId}
          options={orgOptions}
          onChange={setOrganizationId}
          required
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
        <AccueilProInput label={t('accueilpro.requests.fieldEventName')} value={eventName} onChangeText={setEventName} />
        <AccueilProFormDateField label={t('accueilpro.requests.fieldDateStart')} value={dateDebut} onChange={setDateDebut} />
        <AccueilProFormDateField label={t('accueilpro.requests.fieldDateEnd')} value={dateFin} onChange={setDateFin} />
        <AccueilProInput label={t('accueilpro.requests.fieldTimeStart')} value={heureDebut} onChangeText={setHeureDebut} />
        <AccueilProInput label={t('accueilpro.requests.fieldTimeEnd')} value={heureFin} onChangeText={setHeureFin} />
        <AccueilProInput label={t('accueilpro.requests.fieldMotif')} value={motif} onChangeText={setMotif} multiline />
        {isStaff ?
          <>
            <AccueilProInput
              label={t('accueilpro.requests.fieldStaffNotes')}
              value={staffNotes}
              onChangeText={setStaffNotes}
              multiline
            />
            <Text style={apStyles.label}>{t('accueilpro.orgs.status')}</Text>
            {statuses.map(st => (
              <AccueilProChip key={st} label={st} selected={status === st} onPress={() => setStatus(st)} />
            ))}
          </>
        : null}
      </AccueilProFormCard>
    </AccueilProScreenLayout>
  );
}

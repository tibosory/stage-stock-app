import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, Alert, Switch, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ContactPhotoPicker } from '../../components/accueilpro/ContactPhotoPicker';
import {
  AccueilProFormCard,
  AccueilProFormSelectPicker,
  AccueilProInput,
  AccueilProPrimaryButton,
  AccueilProScreenLayout,
  apStyles,
} from '../../components/accueilpro/AccueilProUI';
import { Spacing } from '../../theme/spacing';
import { useLanguage } from '../../context/LanguageContext';
import {
  addPersonnelToEventFromDirectory,
  generateApId,
  getApPersonnel,
  listApEvents,
  saveApPersonnel,
} from '../../db/accueilProDb';
import { buildPersonnelDisplayName } from '../../lib/accueilProPersonnelHelpers';
import { useAccueilProReferenceData } from './accueilProScreenCommon';
import type { ApPersonnelKind } from '../../types/accueilPro';

/** UI (`association`), persiste en `organisation` côté SQLite/API. */
type PersonnelKindUi = 'lieu' | 'association' | 'externe';

export default function AccueilProPersonnelEditScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { t } = useLanguage();
  const personnelId = route.params?.id as string | undefined;
  const [recordId] = useState(() => personnelId ?? generateApId());
  const resolvedParam = route.params?.kind as ApPersonnelKind | 'association' | undefined;
  const defaultKind: PersonnelKindUi =
    resolvedParam === 'organisation' || resolvedParam === 'association' ? 'association'
    : resolvedParam === 'externe' ? 'externe'
    : 'lieu';
  const { orgOptions, venueOptions, loading: refLoading } = useAccueilProReferenceData();
  const [loading, setLoading] = useState(!!personnelId);
  const [saving, setSaving] = useState(false);
  const [kind, setKind] = useState<PersonnelKindUi>(defaultKind);
  const [venueId, setVenueId] = useState(route.params?.venueId ?? '');
  const [associationVenueId, setAssociationVenueId] = useState('');
  const [organizationId, setOrganizationId] = useState(route.params?.organizationId ?? '');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [address, setAddress] = useState('');
  const [role, setRole] = useState('');
  const [rolePermanent, setRolePermanent] = useState(false);
  const [mission, setMission] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [assignEventId, setAssignEventId] = useState('');
  const [assignDayRole, setAssignDayRole] = useState('');
  const [eventOptions, setEventOptions] = useState<{ label: string; value: string }[]>([]);

  useEffect(() => {
    void listApEvents().then(events => {
      setEventOptions([
        { label: '—', value: '' },
        ...events.map(e => ({ label: `${e.name} (${e.date_debut})`, value: e.id })),
      ]);
    });
  }, []);

  useEffect(() => {
    if (!personnelId) {
      setLoading(false);
      return;
    }
    void getApPersonnel(personnelId).then(p => {
      if (p) {
        const uiKind: PersonnelKindUi =
          p.kind === 'organisation' ? 'association' : p.kind === 'externe' ? 'externe' : 'lieu';
        setKind(uiKind);
        setVenueId(p.kind === 'lieu' ? (p.venue_id ?? '') : '');
        setAssociationVenueId(p.kind !== 'lieu' ? (p.venue_id ?? '') : '');
        setOrganizationId(p.organization_id ?? '');
        setFirstName(p.first_name ?? '');
        setLastName(p.last_name ?? '');
        if (!p.first_name && !p.last_name && p.name) {
          const parts = p.name.trim().split(/\s+/);
          if (parts.length > 1) {
            setFirstName(parts.slice(0, -1).join(' '));
            setLastName(parts[parts.length - 1] ?? '');
          } else {
            setLastName(p.name);
          }
        }
        setAddress(p.address ?? '');
        setRole(p.role ?? '');
        setMission(p.mission ?? '');
        setPhone(p.phone ?? '');
        setEmail(p.email ?? '');
        setNotes(p.notes ?? '');
        setPhotoUri(p.photo_uri ?? null);
        setRolePermanent(!!p.role_permanent);
      }
      setLoading(false);
    });
  }, [personnelId]);

  const displayName = useMemo(
    () => buildPersonnelDisplayName({ first_name: firstName, last_name: lastName }),
    [firstName, lastName]
  );

  const persistPersonnel = useCallback(async (): Promise<string | null> => {
    if (!displayName.trim()) {
      Alert.alert(t('accueilpro.orgs.errTitle'), t('accueilpro.personnel.errNameParts'));
      return null;
    }
    const effectiveVenueId = kind === 'lieu' ? venueId : associationVenueId;
    if (!effectiveVenueId) {
      Alert.alert(t('accueilpro.orgs.errTitle'), t('accueilpro.requests.fieldVenue'));
      return null;
    }
    if (kind === 'association' && !organizationId) {
      Alert.alert(t('accueilpro.orgs.errTitle'), t('accueilpro.requests.fieldOrg'));
      return null;
    }
    const persistedKind: ApPersonnelKind = kind === 'association' ? 'organisation' : kind;
    const id = personnelId ?? recordId;
    await saveApPersonnel({
      id,
      kind: persistedKind,
      venue_id: effectiveVenueId,
      organization_id: kind === 'association' ? organizationId || null : null,
      name: displayName.trim(),
      first_name: firstName.trim() || null,
      last_name: lastName.trim() || null,
      address: address.trim() || null,
      role: role.trim() || null,
      role_permanent: rolePermanent,
      mission: mission.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      notes: notes.trim() || null,
      photo_uri: photoUri,
    });
    return id;
  }, [
    personnelId,
    recordId,
    kind,
    venueId,
    associationVenueId,
    organizationId,
    displayName,
    firstName,
    lastName,
    address,
    role,
    rolePermanent,
    mission,
    phone,
    email,
    notes,
    photoUri,
    t,
  ]);

  const onSave = useCallback(async () => {
    setSaving(true);
    try {
      const id = await persistPersonnel();
      if (id) navigation.goBack();
    } finally {
      setSaving(false);
    }
  }, [persistPersonnel, navigation]);

  const onAssignToEvent = async () => {
    if (!assignEventId) {
      Alert.alert(t('accueilpro.orgs.errTitle'), t('accueilpro.personnel.pickEvent'));
      return;
    }
    setSaving(true);
    try {
      const id = personnelId ?? (await persistPersonnel());
      if (!id) return;
      const res = await addPersonnelToEventFromDirectory(assignEventId, id, assignDayRole);
      if (!res.ok) {
        const msg =
          res.reason === 'person' ? t('accueilpro.eventTeam.errPersonNotFound')
          : res.reason === 'event' ? t('accueilpro.eventTeam.errEventNotFound')
          : res.message ?? t('accueilpro.eventTeam.errAdd');
        Alert.alert(t('accueilpro.orgs.errTitle'), msg);
        return;
      }
      Alert.alert(
        t('accueilpro.save'),
        res.updated ? t('accueilpro.eventTeam.updatedMember') : t('accueilpro.personnel.addedToEvent')
      );
      setAssignEventId('');
      setAssignDayRole('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AccueilProScreenLayout
      backLabel={t('accueilpro.back')}
      onBack={() => navigation.goBack()}
      headerIcon={<Text style={{ fontSize: 22 }}>👷</Text>}
      headerTitle={personnelId ? t('accueilpro.personnel.edit') : t('accueilpro.personnel.new')}
      loading={loading || refLoading}
      footer={
        <AccueilProPrimaryButton
          label={t('accueilpro.save')}
          onPress={() => void onSave()}
          loading={saving}
        />
      }
    >
      <ContactPhotoPicker contactId={recordId} photoUri={photoUri} onChange={setPhotoUri} />
      <AccueilProFormCard>
        <AccueilProFormSelectPicker
          label={t('accueilpro.personnel.kind')}
          value={kind}
          options={[
            { label: t('accueilpro.personnel.kindVenue'), value: 'lieu' },
            { label: t('accueilpro.personnel.kindOrg'), value: 'association' },
            { label: t('accueilpro.personnel.kindExternal'), value: 'externe' },
          ]}
          onChange={v => setKind(v as PersonnelKindUi)}
        />
        {kind === 'lieu' ?
          <AccueilProFormSelectPicker
            label={t('accueilpro.requests.fieldVenue')}
            value={venueId}
            options={venueOptions}
            onChange={setVenueId}
            required
          />
        : <>
            {kind === 'association' ?
              <AccueilProFormSelectPicker
                label={t('accueilpro.requests.fieldOrg')}
                value={organizationId}
                options={orgOptions}
                onChange={setOrganizationId}
                required
              />
            : null}
            <AccueilProFormSelectPicker
              label={t('accueilpro.requests.fieldVenue')}
              value={associationVenueId}
              options={venueOptions}
              onChange={setAssociationVenueId}
              required
            />
          </>
        }
        <AccueilProInput
          label={t('accueilpro.personnel.fieldFirstName')}
          value={firstName}
          onChangeText={setFirstName}
        />
        <AccueilProInput
          label={t('accueilpro.personnel.fieldLastName')}
          value={lastName}
          onChangeText={setLastName}
          required
        />
        <AccueilProInput label={t('accueilpro.contacts.fieldRole')} value={role} onChangeText={setRole} />
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginVertical: Spacing.sm,
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '600' }}>{t('accueilpro.personnel.rolePermanent')}</Text>
          <Switch value={rolePermanent} onValueChange={setRolePermanent} />
        </View>
        <AccueilProInput label={t('accueilpro.events.fieldDesc')} value={mission} onChangeText={setMission} />
        <AccueilProInput label={t('accueilpro.field.phone')} value={phone} onChangeText={setPhone} />
        <AccueilProInput label={t('accueilpro.field.email')} value={email} onChangeText={setEmail} />
        <AccueilProInput
          label={t('accueilpro.field.address')}
          value={address}
          onChangeText={setAddress}
          multiline
        />
        <AccueilProInput label={t('accueilpro.field.notes')} value={notes} onChangeText={setNotes} multiline />
      </AccueilProFormCard>

      {personnelId || displayName.trim() ?
        <AccueilProFormCard style={{ marginTop: Spacing.md }}>
          <Text style={apStyles.sectionTitle}>{t('accueilpro.personnel.addToEvent')}</Text>
          {!personnelId ?
            <Text style={[apStyles.rowMeta, { marginBottom: Spacing.sm }]}>
              {t('accueilpro.personnel.assignSaveHint')}
            </Text>
          : null}
          <AccueilProFormSelectPicker
            label={t('accueilpro.events.fieldName')}
            value={assignEventId}
            options={eventOptions}
            onChange={setAssignEventId}
          />
          <AccueilProInput
            label={t('accueilpro.eventTeam.dayRole')}
            value={assignDayRole}
            onChangeText={setAssignDayRole}
            placeholder={t('accueilpro.eventTeam.dayRolePh')}
          />
          <AccueilProPrimaryButton
            label={t('accueilpro.personnel.addToEventBtn')}
            onPress={() => void onAssignToEvent()}
            style={{ marginTop: Spacing.sm }}
          />
        </AccueilProFormCard>
      : null}
    </AccueilProScreenLayout>
  );
}

import React, { useCallback, useEffect, useState } from 'react';
import { Text, Alert, Switch, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  AccueilProFormCard,
  AccueilProFormSelectPicker,
  AccueilProInput,
  AccueilProPrimaryButton,
  AccueilProScreenLayout,
} from '../../components/accueilpro/AccueilProUI';
import { Spacing } from '../../theme/spacing';
import { useLanguage } from '../../context/LanguageContext';
import { generateApId, getApPersonnel, saveApPersonnel } from '../../db/accueilProDb';
import { useAccueilProReferenceData } from './accueilProScreenCommon';
import type { ApPersonnelKind } from '../../types/accueilPro';

/** UI (`association`), persiste en `organisation` côté SQLite/API. */
type PersonnelKindUi = 'lieu' | 'association' | 'externe';

export default function AccueilProPersonnelEditScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { t } = useLanguage();
  const personnelId = route.params?.id as string | undefined;
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
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [rolePermanent, setRolePermanent] = useState(false);
  const [mission, setMission] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');

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
        setName(p.name);
        setRole(p.role ?? '');
        setMission(p.mission ?? '');
        setPhone(p.phone ?? '');
        setEmail(p.email ?? '');
        setNotes(p.notes ?? '');
        setRolePermanent(!!p.role_permanent);
      }
      setLoading(false);
    });
  }, [personnelId]);

  const onSave = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert(t('accueilpro.orgs.errTitle'), t('accueilpro.contacts.errName'));
      return;
    }
    const effectiveVenueId = kind === 'lieu' ? venueId : associationVenueId;
    if (!effectiveVenueId) {
      Alert.alert(t('accueilpro.orgs.errTitle'), t('accueilpro.requests.fieldVenue'));
      return;
    }
    if (kind === 'association' && !organizationId) {
      Alert.alert(t('accueilpro.orgs.errTitle'), t('accueilpro.requests.fieldOrg'));
      return;
    }
    setSaving(true);
    try {
      const persistedKind: ApPersonnelKind = kind === 'association' ? 'organisation' : kind;
      await saveApPersonnel({
        id: personnelId ?? generateApId(),
        kind: persistedKind,
        venue_id: effectiveVenueId,
        organization_id: kind === 'association' ? organizationId || null : null,
        name: name.trim(),
        role: role.trim() || null,
        role_permanent: rolePermanent,
        mission: mission.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        notes: notes.trim() || null,
      });
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  }, [
    personnelId,
    kind,
    venueId,
    associationVenueId,
    organizationId,
    name,
    role,
    rolePermanent,
    mission,
    phone,
    email,
    notes,
    navigation,
    t,
  ]);

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
      <AccueilProFormCard>
<AccueilProFormSelectPicker 
          label={t('accueilpro.personnel.kind')}
          value={kind}
          options={[
            { label: t('accueilpro.personnel.kindVenue'), value: 'lieu' },
            { label: t('accueilpro.personnel.kindOrg'), value: 'association' },
            { label: 'Externe', value: 'externe' },
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
        <AccueilProInput label={t('accueilpro.contacts.fieldName')} value={name} onChangeText={setName} required />
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
        <AccueilProInput label={t('accueilpro.field.notes')} value={notes} onChangeText={setNotes} multiline />
      </AccueilProFormCard>
    </AccueilProScreenLayout>
  );
}

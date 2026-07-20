import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, FlatList, Alert, TouchableOpacity } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { AccueilProContactCard } from '../../components/accueilpro/AccueilProContactCard';
import { EventTeamSmsComposer } from '../../components/accueilpro/EventTeamSmsComposer';
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
  createDirectoryPersonnelForEvent,
  getApEvent,
  listApEventPersonnel,
  listApPersonnel,
} from '../../db/accueilProDb';
import { contactFieldLabelsFromT, eventPersonnelContactLines } from '../../lib/accueilProContactDisplay';
import { personnelDisplayName } from '../../lib/accueilProPersonnelHelpers';
import type { ApEvent, ApEventPersonnel } from '../../types/accueilPro';

export default function AccueilProEventPersonnelScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { t } = useLanguage();
  const eventId = route.params?.eventId as string;
  const [event, setEvent] = useState<ApEvent | null>(null);
  const [rows, setRows] = useState<ApEventPersonnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [directory, setDirectory] = useState<{ label: string; value: string }[]>([]);
  const [pickId, setPickId] = useState('');
  const [dayRole, setDayRole] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [role, setRole] = useState('');
  const [smsOpen, setSmsOpen] = useState(false);

  const fieldLabels = useMemo(() => contactFieldLabelsFromT(t), [t]);
  const smsLabels = useMemo(
    () => ({
      title: t('accueilpro.eventTeam.smsTitle'),
      hint: t('accueilpro.eventTeam.smsHint'),
      fieldMessage: t('accueilpro.eventTeam.smsFieldMessage'),
      placeholder: t('accueilpro.eventTeam.smsPlaceholder'),
      recipients: t('accueilpro.eventTeam.smsRecipients'),
      withoutPhone: t('accueilpro.eventTeam.smsWithoutPhone'),
      send: t('accueilpro.eventTeam.smsSend'),
      cancel: t('accueilpro.cancel'),
      errEmpty: t('accueilpro.eventTeam.smsErrEmpty'),
      noPhones: t('accueilpro.eventTeam.smsNoPhones'),
      unavailable: t('accueilpro.eventTeam.smsUnavailable'),
      quickBreak: t('accueilpro.eventTeam.smsQuickBreak'),
      quickStart: t('accueilpro.eventTeam.smsQuickStart'),
    }),
    [t]
  );

  const load = useCallback(async () => {
    try {
      const [ev, evp, pers] = await Promise.all([
        getApEvent(eventId),
        listApEventPersonnel(eventId),
        listApPersonnel(),
      ]);
      setEvent(ev);
      setRows(evp);
      setDirectory([
        { label: '—', value: '' },
        ...pers.map(p => ({
          label: `${p.capi_contact_ref_id ? 'CAPI · ' : ''}${personnelDisplayName(p)}${p.role ? ` — ${p.role}` : ''} (${p.kind})`,
          value: p.id,
        })),
      ]);
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

  const onAddFromDirectory = async () => {
    if (!pickId) {
      Alert.alert(t('accueilpro.orgs.errTitle'), t('accueilpro.personnel.pickOne'));
      return;
    }
    const res = await addPersonnelToEventFromDirectory(eventId, pickId, dayRole);
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
    setPickId('');
    setDayRole('');
    await load();
  };

  const onCreateCard = async () => {
    if (!firstName.trim() && !lastName.trim()) {
      Alert.alert(t('accueilpro.orgs.errTitle'), t('accueilpro.personnel.errNameParts'));
      return;
    }
    const venueId = event?.venue_id;
    if (!venueId) {
      Alert.alert(t('accueilpro.orgs.errTitle'), t('accueilpro.eventTeam.errVenue'));
      return;
    }
    try {
      await createDirectoryPersonnelForEvent({
        eventId,
        venueId,
        first_name: firstName,
        last_name: lastName,
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        role: role.trim() || null,
        day_role: role.trim() || null,
      });
      Alert.alert(t('accueilpro.save'), t('accueilpro.personnel.addedToEvent'));
    } catch (e) {
      Alert.alert(t('accueilpro.orgs.errTitle'), e instanceof Error ? e.message : String(e));
      return;
    }
    setFirstName('');
    setLastName('');
    setPhone('');
    setEmail('');
    setAddress('');
    setRole('');
    await load();
  };

  return (
    <AccueilProScreenLayout
      backLabel={t('accueilpro.back')}
      onBack={() => navigation.goBack()}
      headerIcon={<Text style={{ fontSize: 22 }}>👥</Text>}
      headerTitle={t('accueilpro.eventTeam.title')}
      headerRightLabel={t('accueilpro.contacts.title')}
      onHeaderRight={() => navigation.navigate('AccueilProContacts')}
      loading={loading}
      scroll={false}
    >
      <FlatList
        data={rows}
        keyExtractor={i => i.id}
        style={{ flex: 1 }}
        contentContainerStyle={[apStyles.list, { paddingBottom: Spacing.xxl * 2, flexGrow: 1 }]}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <>
            <AccueilProFormCard style={{ marginBottom: Spacing.md }}>
              <Text style={apStyles.sectionTitle}>{t('accueilpro.eventTeam.fromDirectory')}</Text>
              <AccueilProFormSelectPicker
                label={t('accueilpro.personnel.pick')}
                value={pickId}
                options={directory}
                onChange={setPickId}
              />
              <AccueilProInput
                label={t('accueilpro.eventTeam.dayRole')}
                value={dayRole}
                onChangeText={setDayRole}
                placeholder={t('accueilpro.eventTeam.dayRolePh')}
              />
              <AccueilProPrimaryButton
                label={t('accueilpro.eventTeam.addFromDir')}
                onPress={() => void onAddFromDirectory()}
                style={{ marginTop: Spacing.sm }}
              />
              <TouchableOpacity
                onPress={() => navigation.navigate('AccueilProContacts')}
                style={{ marginTop: Spacing.sm }}
              >
                <Text style={apStyles.sectionLink}>{t('accueilpro.eventTeam.openDirectory')}</Text>
              </TouchableOpacity>
            </AccueilProFormCard>

            <AccueilProFormCard style={{ marginBottom: Spacing.md }}>
              <Text style={apStyles.sectionTitle}>{t('accueilpro.eventTeam.newCard')}</Text>
              <Text style={[apStyles.rowMeta, { marginBottom: Spacing.sm }]}>
                {t('accueilpro.eventTeam.directoryHint')}
              </Text>
              <AccueilProInput
                label={t('accueilpro.personnel.fieldFirstName')}
                value={firstName}
                onChangeText={setFirstName}
              />
              <AccueilProInput
                label={t('accueilpro.personnel.fieldLastName')}
                value={lastName}
                onChangeText={setLastName}
              />
              <AccueilProInput label={t('accueilpro.field.phone')} value={phone} onChangeText={setPhone} />
              <AccueilProInput label={t('accueilpro.field.email')} value={email} onChangeText={setEmail} />
              <AccueilProInput
                label={t('accueilpro.field.address')}
                value={address}
                onChangeText={setAddress}
                multiline
              />
              <AccueilProInput
                label={t('accueilpro.contacts.fieldRole')}
                value={role}
                onChangeText={setRole}
              />
              <AccueilProPrimaryButton
                label={t('accueilpro.eventTeam.addAdhoc')}
                onPress={() => void onCreateCard()}
                style={{ marginTop: Spacing.sm }}
              />
            </AccueilProFormCard>

            <Text style={apStyles.sectionTitle}>{t('accueilpro.eventTeam.list')}</Text>
            {rows.length > 0 ?
              <AccueilProPrimaryButton
                label={t('accueilpro.eventTeam.smsAll')}
                onPress={() => setSmsOpen(true)}
                style={{ marginBottom: Spacing.sm, marginTop: Spacing.xs }}
              />
            : null}
          </>
        }
        ListEmptyComponent={<Text style={apStyles.empty}>{t('accueilpro.eventTeam.empty')}</Text>}
        renderItem={({ item }) => (
          <AccueilProContactCard
            displayName={item.name.trim()}
            lines={eventPersonnelContactLines(item, fieldLabels)}
            phone={item.phone}
            email={item.email}
            emailSubject={`StageStock · ${item.name}`}
          />
        )}
      />

      <EventTeamSmsComposer
        visible={smsOpen}
        team={rows}
        eventName={event?.name}
        labels={smsLabels}
        errTitle={t('accueilpro.orgs.errTitle')}
        onClose={() => setSmsOpen(false)}
      />
    </AccueilProScreenLayout>
  );
}

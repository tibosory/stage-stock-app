import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Alert } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { ContactActionRow } from '../../components/accueilpro/ContactActionRow';
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
  listApEventPersonnel,
  listApPersonnel,
  saveApEventPersonnel,
} from '../../db/accueilProDb';
import type { ApEventPersonnel } from '../../types/accueilPro';

export default function AccueilProEventPersonnelScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { t } = useLanguage();
  const eventId = route.params?.eventId as string;
  const [rows, setRows] = useState<ApEventPersonnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [directory, setDirectory] = useState<{ label: string; value: string }[]>([]);
  const [pickId, setPickId] = useState('');
  const [dayRole, setDayRole] = useState('');
  const [adhocName, setAdhocName] = useState('');
  const [adhocPhone, setAdhocPhone] = useState('');
  const [adhocEmail, setAdhocEmail] = useState('');
  const [adhocRole, setAdhocRole] = useState('');

  const load = useCallback(async () => {
    try {
      const [evp, pers] = await Promise.all([listApEventPersonnel(eventId), listApPersonnel()]);
      setRows(evp);
      setDirectory([
        { label: '—', value: '' },
        ...pers.map(p => ({ label: `${p.name} (${p.kind})`, value: p.id })),
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
    await addPersonnelToEventFromDirectory(eventId, pickId, dayRole);
    setPickId('');
    setDayRole('');
    await load();
  };

  const onAddAdhoc = async () => {
    if (!adhocName.trim()) {
      Alert.alert(t('accueilpro.orgs.errTitle'), t('accueilpro.contacts.errName'));
      return;
    }
    await saveApEventPersonnel({
      event_id: eventId,
      source: 'jour',
      name: adhocName.trim(),
      day_role: adhocRole.trim() || null,
      day_mission: adhocRole.trim() || null,
      phone: adhocPhone.trim() || null,
      email: adhocEmail.trim() || null,
    });
    setAdhocName('');
    setAdhocPhone('');
    setAdhocEmail('');
    setAdhocRole('');
    await load();
  };

  return (
    <AccueilProScreenLayout
      backLabel={t('accueilpro.back')}
      onBack={() => navigation.goBack()}
      headerIcon={<Text style={{ fontSize: 22 }}>👥</Text>}
      headerTitle={t('accueilpro.eventTeam.title')}
      loading={loading}
      scroll={false}
    >
      <FlatList
        data={rows}
        keyExtractor={i => i.id}
        contentContainerStyle={[apStyles.list, { paddingBottom: Spacing.xxl * 2 }]}
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
            </AccueilProFormCard>
            <AccueilProFormCard style={{ marginBottom: Spacing.md }}>
              <Text style={apStyles.sectionTitle}>{t('accueilpro.eventTeam.adhoc')}</Text>
              <AccueilProInput label={t('accueilpro.contacts.fieldName')} value={adhocName} onChangeText={setAdhocName} />
              <AccueilProInput label={t('accueilpro.eventTeam.dayRole')} value={adhocRole} onChangeText={setAdhocRole} />
              <AccueilProInput label={t('accueilpro.field.phone')} value={adhocPhone} onChangeText={setAdhocPhone} />
              <AccueilProInput label={t('accueilpro.field.email')} value={adhocEmail} onChangeText={setAdhocEmail} />
              <AccueilProPrimaryButton
                label={t('accueilpro.eventTeam.addAdhoc')}
                onPress={() => void onAddAdhoc()}
                style={{ marginTop: Spacing.sm }}
              />
            </AccueilProFormCard>
            <Text style={apStyles.sectionTitle}>{t('accueilpro.eventTeam.list')}</Text>
          </>
        }
        ListEmptyComponent={<Text style={apStyles.empty}>{t('accueilpro.eventTeam.empty')}</Text>}
        renderItem={({ item }) => (
          <View style={apStyles.row}>
            <Text style={apStyles.rowTitle}>{item.name}</Text>
            <Text style={apStyles.rowMeta}>
              {[item.day_role, item.day_mission, item.source].filter(Boolean).join(' · ')}
            </Text>
            <ContactActionRow phone={item.phone} email={item.email} emailSubject={`StageStock · ${item.name}`} />
          </View>
        )}
      />
    </AccueilProScreenLayout>
  );
}

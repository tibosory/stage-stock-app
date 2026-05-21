import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Alert, Switch } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { AccueilProFormCard, AccueilProInput } from '../../components/accueilpro/AccueilProUI';
import {
  AccueilProPrimaryButton,
  AccueilProScreenLayout,
  AccueilProColors,
  apStyles,
} from '../../components/accueilpro/AccueilProUI';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { useLanguage } from '../../context/LanguageContext';
import { generateApId, listApContactsByOrganization, saveApOrganizationContact } from '../../db/accueilProDb';
import type { ApOrganizationContact } from '../../types/accueilPro';

export default function AccueilProOrganizationContactsScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { t } = useLanguage();
  const organizationId = route.params?.organizationId as string;
  const [rows, setRows] = useState<ApOrganizationContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await listApContactsByOrganization(organizationId));
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load])
  );

  const onAdd = async () => {
    if (!name.trim()) {
      Alert.alert(t('accueilpro.orgs.errTitle'), t('accueilpro.contacts.errName'));
      return;
    }
    setSaving(true);
    try {
      await saveApOrganizationContact({
        id: generateApId(),
        organization_id: organizationId,
        name: name.trim(),
        role: role.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        is_primary: isPrimary,
      });
      setName('');
      setRole('');
      setPhone('');
      setEmail('');
      setIsPrimary(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <AccueilProScreenLayout
      backLabel={t('accueilpro.back')}
      onBack={() => navigation.goBack()}
      headerIcon={<Text style={{ fontSize: 22 }}>👤</Text>}
      headerTitle={t('accueilpro.contacts.title')}
      loading={loading}
      scroll={false}
    >
      <FlatList
        data={rows}
        keyExtractor={i => i.id}
        contentContainerStyle={[apStyles.list, { paddingBottom: Spacing.xxl * 2 }]}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <AccueilProFormCard style={{ marginBottom: Spacing.md }}>
            <AccueilProInput label={t('accueilpro.contacts.fieldName')} value={name} onChangeText={setName} />
            <AccueilProInput label={t('accueilpro.contacts.fieldRole')} value={role} onChangeText={setRole} />
            <AccueilProInput label={t('accueilpro.field.phone')} value={phone} onChangeText={setPhone} />
            <AccueilProInput label={t('accueilpro.field.email')} value={email} onChangeText={setEmail} />
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginVertical: Spacing.sm,
              }}
            >
              <Text style={apStyles.label}>{t('accueilpro.contacts.primary')}</Text>
              <Switch
                value={isPrimary}
                onValueChange={setIsPrimary}
                trackColor={{ false: Colors.border, true: AccueilProColors.primary }}
              />
            </View>
            <AccueilProPrimaryButton
              label={`+ ${t('accueilpro.contacts.add')}`}
              onPress={() => void onAdd()}
              loading={saving}
              style={{ marginTop: Spacing.sm }}
            />
          </AccueilProFormCard>
        }
        ListEmptyComponent={<Text style={apStyles.empty}>{t('accueilpro.contacts.empty')}</Text>}
        renderItem={({ item }) => (
          <View style={apStyles.row}>
            <Text style={apStyles.rowTitle}>
              {item.name}
              {item.is_primary ? ' ·' : ''}
            </Text>
            <Text style={apStyles.rowMeta}>{[item.role, item.phone, item.email].filter(Boolean).join(' · ') || '—'}</Text>
          </View>
        )}
      />
    </AccueilProScreenLayout>
  );
}

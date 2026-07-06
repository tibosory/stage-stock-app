import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, FlatList, Alert, Switch } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { AccueilProFormCard, AccueilProFormSelectPicker, AccueilProInput } from '../../components/accueilpro/AccueilProUI';
import { AccueilProContactCard } from '../../components/accueilpro/AccueilProContactCard';
import {
  AccueilProPrimaryButton,
  AccueilProScreenLayout,
  AccueilProColors,
  apStyles,
} from '../../components/accueilpro/AccueilProUI';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { useLanguage } from '../../context/LanguageContext';
import { generateApId, getApOrganization, listApContactsByOrganization, saveApOrganizationContact } from '../../db/accueilProDb';
import { contactFieldLabelsFromT, organizationContactLines } from '../../lib/accueilProContactDisplay';
import type { ApOrganizationContact } from '../../types/accueilPro';
import { useCapiAccueilProCatalog } from './accueilProScreenCommon';
import { getApCapiContactRef } from '../../lib/capiAccueilProHelpers';
import { pushAccueilProContactToCapi } from '../../lib/capiAccueilProApi';

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
  const [capiContactRefId, setCapiContactRefId] = useState('');
  const { capiContactOptions, loading: capiLoading, reload: reloadCapi } = useCapiAccueilProCatalog();

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
      reloadCapi();
      void load();
    }, [load, reloadCapi])
  );

  const onCapiContactChange = useCallback(async (refId: string) => {
    setCapiContactRefId(refId);
    if (!refId) return;
    const ref = await getApCapiContactRef(refId);
    if (!ref) return;
    setName(ref.nom);
    setRole(ref.role ?? '');
    setPhone(ref.telephone ?? '');
    setEmail(ref.email ?? '');
  }, []);

  const onAdd = async () => {
    if (!name.trim()) {
      Alert.alert(t('accueilpro.orgs.errTitle'), t('accueilpro.contacts.errName'));
      return;
    }
    setSaving(true);
    try {
      let capiRefId = capiContactRefId;
      let capiRef = capiRefId ? await getApCapiContactRef(capiRefId) : null;
      if (!capiRefId && name.trim()) {
        const org = await getApOrganization(organizationId);
        const pushed = await pushAccueilProContactToCapi({
          nom: name.trim(),
          role: role.trim() || null,
          email: email.trim() || null,
          telephone: phone.trim() || null,
          organisation: org?.name?.trim() || null,
          kind: 'personnel',
        });
        if (pushed?.capi_contact_ref_id) {
          capiRefId = pushed.capi_contact_ref_id;
          capiRef = await getApCapiContactRef(capiRefId);
        }
      }
      await saveApOrganizationContact({
        id: generateApId(),
        organization_id: organizationId,
        name: name.trim(),
        role: role.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        is_primary: isPrimary,
        capi_contact_ref_id: capiRefId || null,
        capi_contact_kind: capiRef?.kind ?? null,
      });
      setName('');
      setRole('');
      setPhone('');
      setEmail('');
      setIsPrimary(false);
      setCapiContactRefId('');
      await load();
    } finally {
      setSaving(false);
    }
  };

  const fieldLabels = useMemo(() => contactFieldLabelsFromT(t), [t]);

  return (
    <AccueilProScreenLayout
      backLabel={t('accueilpro.back')}
      onBack={() => navigation.goBack()}
      headerIcon={<Text style={{ fontSize: 22 }}>👤</Text>}
      headerTitle={t('accueilpro.contacts.title')}
      loading={loading || capiLoading}
      scroll={false}
    >
      <FlatList
        data={rows}
        keyExtractor={i => i.id}
        contentContainerStyle={[apStyles.list, { paddingBottom: Spacing.xxl * 2 }]}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <AccueilProFormCard style={{ marginBottom: Spacing.md }}>
            <AccueilProFormSelectPicker
              label={t('accueilpro.capi.fieldContact')}
              value={capiContactRefId}
              options={capiContactOptions}
              onChange={v => void onCapiContactChange(v)}
            />
            {capiContactOptions.length <= 1 ?
              <Text style={[apStyles.hint, { marginBottom: Spacing.sm }]}>{t('accueilpro.capi.syncHint')}</Text>
            : null}
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
          <AccueilProContactCard
            displayName={item.name.trim()}
            badge={item.is_primary ? t('accueilpro.contacts.primary') : null}
            lines={organizationContactLines(item, fieldLabels)}
            phone={item.phone}
            email={item.email}
          />
        )}
      />
    </AccueilProScreenLayout>
  );
}

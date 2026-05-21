import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Text } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AccueilProFormCard, AccueilProInput } from '../../components/accueilpro/AccueilProUI';
import {
  AccueilProLinkButton,
  AccueilProPrimaryButton,
  AccueilProScreenLayout,
  apStyles,
} from '../../components/accueilpro/AccueilProUI';
import { Spacing } from '../../theme/spacing';
import { useLanguage } from '../../context/LanguageContext';
import { generateApId, getApOrganization, saveOrganization } from '../../db/accueilProDb';
import { OrganizationDocumentsSection } from '../../components/accueilpro/OrganizationDocumentsSection';
import type { ApOrganizationDocument } from '../../types/accueilPro';
import { isSupabaseConfigured } from '../../lib/supabase';
import { useSupabaseAuth } from '../../hooks/useAuth';
import { isSupabaseStaffUser } from '../../lib/accueilProInvitationStaff';
import { PermissionGuard } from '../../modules/accueilpro/components/PermissionGuard';

export default function AccueilProOrganizationEditScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { t } = useLanguage();
  const orgId = route.params?.id as string | undefined;
  const [loading, setLoading] = useState(!!orgId);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [address, setAddress] = useState('');
  const [cp, setCp] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [notes, setNotes] = useState('');
  const { user: sbUser } = useSupabaseAuth();
  const canInviteCloud = isSupabaseConfigured() && isSupabaseStaffUser(sbUser);
  const [, setDocs] = useState<ApOrganizationDocument[]>([]);

  useEffect(() => {
    if (!orgId) return;
    void (async () => {
      const o = await getApOrganization(orgId);
      if (o) {
        setName(o.name);
        setType(o.type ?? '');
        setAddress(o.address ?? '');
        setCp(o.cp ?? '');
        setCity(o.city ?? '');
        setPhone(o.phone ?? '');
        setEmail(o.email ?? '');
        setWebsite(o.website ?? '');
        setNotes(o.notes_internes ?? '');
      }
      setLoading(false);
    })();
  }, [orgId]);

  const onSave = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert(t('accueilpro.orgs.errTitle'), t('accueilpro.orgs.errName'));
      return;
    }
    setSaving(true);
    try {
      const id = orgId ?? generateApId();
      await saveOrganization({
        id,
        name: name.trim(),
        type: type.trim() || null,
        address: address.trim() || null,
        cp: cp.trim() || null,
        city: city.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        website: website.trim() || null,
        notes_internes: notes.trim() || null,
        status: 'actif',
      });
      if (!orgId) navigation.replace('AccueilProOrganizationEdit', { id });
      else navigation.goBack();
    } finally {
      setSaving(false);
    }
  }, [orgId, name, type, address, cp, city, phone, email, website, notes, navigation, t]);

  const resolvedId = orgId;

  return (
    <AccueilProScreenLayout
      backLabel={t('accueilpro.back')}
      onBack={() => navigation.goBack()}
      headerIcon={<Text style={{ fontSize: 22 }}>🏢</Text>}
      headerTitle={orgId ? t('accueilpro.orgs.edit') : t('accueilpro.orgs.new')}
      loading={loading}
      footer={<AccueilProPrimaryButton label={t('accueilpro.save')} onPress={() => void onSave()} loading={saving} />}
    >
      <AccueilProFormCard>
        <AccueilProInput label={t('accueilpro.orgs.fieldName')} value={name} onChangeText={setName} required />
        <AccueilProInput label={t('accueilpro.orgs.fieldType')} value={type} onChangeText={setType} />
        <AccueilProInput label={t('accueilpro.orgs.fieldAddress')} value={address} onChangeText={setAddress} />
        <AccueilProInput label={t('accueilpro.field.cp')} value={cp} onChangeText={setCp} />
        <AccueilProInput label={t('accueilpro.field.city')} value={city} onChangeText={setCity} />
        <AccueilProInput label={t('accueilpro.field.phone')} value={phone} onChangeText={setPhone} />
        <AccueilProInput label={t('accueilpro.field.email')} value={email} onChangeText={setEmail} />
        <AccueilProInput label={t('accueilpro.orgs.fieldWebsite')} value={website} onChangeText={setWebsite} />
        <AccueilProInput label={t('accueilpro.orgs.fieldNotes')} value={notes} onChangeText={setNotes} multiline />
      </AccueilProFormCard>
      {resolvedId ?
        <AccueilProFormCard style={{ marginTop: Spacing.md }}>
          <Text style={apStyles.sectionTitle}>{t('accueilpro.orgs.contacts')}</Text>
          <AccueilProLinkButton label={t('accueilpro.orgs.manageContacts')} onPress={() => navigation.navigate('AccueilProOrganizationContacts', { organizationId: resolvedId })} />
          {canInviteCloud ? (
            <PermissionGuard staffOnly>
              <AccueilProLinkButton
                label={t('accueilpro.invite.openFromOrg')}
                onPress={() =>
                  navigation.navigate('AccueilProInviteOrganization', {
                    localOrganizationId: resolvedId,
                    prefillEmail: email.trim() || undefined,
                  })
                }
              />
            </PermissionGuard>
          ) : null}
          <OrganizationDocumentsSection
            organizationId={resolvedId}
            onEnsureOrganizationId={async () => resolvedId}
            onDocumentsChange={setDocs}
          />
        </AccueilProFormCard>
      : <Text style={[apStyles.hint, { marginTop: Spacing.md }]}>{t('accueilpro.orgs.saveFirstDocs')}</Text>}
    </AccueilProScreenLayout>
  );
}

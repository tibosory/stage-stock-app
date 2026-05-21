import React, { useCallback, useState } from 'react';
import { Alert, Text } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  AccueilProChecklistCard,
  AccueilProFormCard,
  AccueilProInput,
  AccueilProPrimaryButton,
  AccueilProScreenLayout,
} from '../components/accueilpro/AccueilProUI';
import {
  CLIENT_PORTAL_CHECKLIST,
  computeClientChecklistProgress,
} from '../modules/accueilpro/constants/clientChecklist';
import { OrganizationDocumentsSection } from '../components/accueilpro/OrganizationDocumentsSection';
import { useLanguage } from '../context/LanguageContext';
import { loadAssociationProfileLocal, saveAssociationProfileLocal } from '../lib/associationProfileStorage';
import { importAssociationProfileAsOrganization, listApOrganizationDocuments, listApOrganizations } from '../db/accueilProDb';
import type { ApOrganizationDocument } from '../types/accueilPro';
import { syncAccueilProBidirectional } from '../lib/accueilProApiSync';
import { useConnection } from '../context/ConnectionContext';

export default function AccueilAssociationScreen() {
  const navigation = useNavigation<any>();
  const { t } = useLanguage();
  const { status: connStatus } = useConnection();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [address, setAddress] = useState('');
  const [cp, setCp] = useState('');
  const [city, setCity] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [contactName, setContactName] = useState('');
  const [linkedOrgId, setLinkedOrgId] = useState<string | null>(null);
  const [docs, setDocs] = useState<ApOrganizationDocument[]>([]);

  const load = useCallback(async () => {
    const profile = await loadAssociationProfileLocal();
    setName(profile.name);
    setType(profile.type);
    setAddress(profile.address);
    setCp(profile.cp);
    setCity(profile.city);
    setEmail(profile.email);
    setPhone(profile.phone);
    setContactName(profile.contactName);
    setLinkedOrgId(profile.linkedOrganizationId ?? null);
    if (!profile.linkedOrganizationId) {
      const orgs = await listApOrganizations();
      if (orgs.length === 1) setLinkedOrgId(orgs[0].id);
    }
    const orgId = profile.linkedOrganizationId ?? (await listApOrganizations())[0]?.id ?? null;
    if (orgId) {
      setDocs(await listApOrganizationDocuments(orgId));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load().finally(() => setLoading(false));
    }, [load])
  );

  const checklistCtx = {
    name,
    address,
    email,
    contacts: contactName && phone ? [{ is_primary: true, phone }] : [],
    documents: docs,
    documentCategoriesPresent: docs.length > 0,
  };

  const progress = computeClientChecklistProgress(checklistCtx);

  const onSave = async () => {
    setSaving(true);
    try {
      await saveAssociationProfileLocal({
        name,
        type,
        siret: '',
        address,
        cp,
        city,
        website: '',
        contactName,
        email,
        phone,
        notes: '',
        hasPrimaryContact: !!(contactName && phone),
        documentCategories: [],
        linkedOrganizationId: linkedOrgId,
      });
      const orgId = await importAssociationProfileAsOrganization({
        name: name.trim(),
        type: type.trim(),
        address: address.trim(),
        cp: cp.trim(),
        city: city.trim(),
        email: email.trim(),
        phone: phone.trim(),
        contactName: contactName.trim(),
        linkedOrganizationId: linkedOrgId,
      });
      setLinkedOrgId(orgId);
      if (connStatus === 'ok') {
        await syncAccueilProBidirectional(null);
      }
      Alert.alert(t('accueilpro.portal.savedTitle'), t('accueilpro.portal.savedBody'));
    } catch (e) {
      Alert.alert(t('accueilpro.portal.errorTitle'), e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AccueilProScreenLayout
      backLabel={t('accueilpro.back')}
      onBack={() => navigation.goBack()}
      headerIcon={<Text style={{ fontSize: 22 }}>🤝</Text>}
      headerTitle={t('accueilpro.portal.title')}
      headerSubtitle={t('accueilpro.portal.subtitle')}
      loading={loading}
      showFieldStrip
      footer={<AccueilProPrimaryButton label={t('accueilpro.save')} onPress={() => void onSave()} loading={saving} />}
    >
      <AccueilProChecklistCard
        title={t('accueilpro.portal.checklist')}
        progressLabel={t('accueilpro.portal.checklistProgress', {
          done: String(progress.requiredDone),
          total: String(progress.requiredTotal),
        })}
        items={CLIENT_PORTAL_CHECKLIST.map(item => ({
          id: item.id,
          label: item.label,
          done: item.isComplete(checklistCtx),
        }))}
      />
      <AccueilProFormCard>
        <AccueilProInput label={t('accueilpro.portal.fieldName')} value={name} onChangeText={setName} required />
        <AccueilProInput label={t('accueilpro.portal.fieldType')} value={type} onChangeText={setType} />
        <AccueilProInput label={t('accueilpro.portal.fieldAddress')} value={address} onChangeText={setAddress} />
        <AccueilProInput label={t('accueilpro.field.cp')} value={cp} onChangeText={setCp} keyboardType="number-pad" />
        <AccueilProInput label={t('accueilpro.field.city')} value={city} onChangeText={setCity} />
        <AccueilProInput label={t('accueilpro.portal.contactName')} value={contactName} onChangeText={setContactName} />
        <AccueilProInput label={t('accueilpro.field.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <AccueilProInput label={t('accueilpro.field.email')} value={email} onChangeText={setEmail} keyboardType="email-address" />
      </AccueilProFormCard>
      {linkedOrgId ?
        <OrganizationDocumentsSection
          organizationId={linkedOrgId}
          onEnsureOrganizationId={async () => linkedOrgId}
          onDocumentsChange={setDocs}
        />
      : null}
    </AccueilProScreenLayout>
  );
}

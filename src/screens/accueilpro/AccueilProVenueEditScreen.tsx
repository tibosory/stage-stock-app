import React, { useCallback, useEffect, useState } from 'react';
import { Text, Alert } from 'react-native';
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
import { generateApId, getApVenue, listApSpaces, saveApVenue } from '../../db/accueilProDb';
import { ERP_CATS, ERP_TYPES } from '../../lib/inspectionChecklist';

export default function AccueilProVenueEditScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { t } = useLanguage();
  const venueId = route.params?.id as string | undefined;
  const [loading, setLoading] = useState(!!venueId);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [cp, setCp] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [erpType, setErpType] = useState('');
  const [erpCategory, setErpCategory] = useState('');
  const [capacity, setCapacity] = useState('');
  const [fireNotes, setFireNotes] = useState('');
  const [safetyRules, setSafetyRules] = useState('');
  const [spaceCount, setSpaceCount] = useState(0);

  useEffect(() => {
    if (!venueId) return;
    void (async () => {
      const v = await getApVenue(venueId);
      if (v) {
        setName(v.name);
        setAddress(v.address ?? '');
        setCp(v.cp ?? '');
        setCity(v.city ?? '');
        setPhone(v.phone ?? '');
        setEmail(v.email ?? '');
        setErpType(v.erp_type ?? '');
        setErpCategory(v.erp_category ?? '');
        setCapacity(v.capacity != null ? String(v.capacity) : '');
        setFireNotes(v.fire_notes ?? '');
        setSafetyRules(v.safety_rules ?? '');
        const sp = await listApSpaces(venueId);
        setSpaceCount(sp.length);
      }
      setLoading(false);
    })();
  }, [venueId]);

  const onSave = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert(t('accueilpro.orgs.errTitle'), t('accueilpro.venues.errName'));
      return;
    }
    setSaving(true);
    try {
      await saveApVenue({
        id: venueId ?? generateApId(),
        name: name.trim(),
        address: address.trim() || null,
        cp: cp.trim() || null,
        city: city.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        erp_type: erpType.trim() || null,
        erp_category: erpCategory.trim() || null,
        capacity: capacity.trim() ? parseInt(capacity, 10) || 0 : 0,
        fire_notes: fireNotes.trim() || null,
        safety_rules: safetyRules.trim() || null,
      });
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  }, [venueId, name, address, cp, city, phone, email, navigation, t]);

  return (
    <AccueilProScreenLayout
      backLabel={t('accueilpro.back')}
      onBack={() => navigation.goBack()}
      headerIcon={<Text style={{ fontSize: 22 }}>🏢</Text>}
      headerTitle={venueId ? t('accueilpro.venues.edit') : t('accueilpro.venues.new')}
      loading={loading}
      footer={
        <AccueilProPrimaryButton
          label={t('accueilpro.save')}
          onPress={() => void onSave()}
          loading={saving}
        />
      }
    >
      <AccueilProFormCard>
        <AccueilProInput label={t('accueilpro.venues.fieldName')} value={name} onChangeText={setName} required />
        <AccueilProInput label={t('accueilpro.venues.fieldAddress')} value={address} onChangeText={setAddress} />
        <AccueilProInput label={t('accueilpro.field.cp')} value={cp} onChangeText={setCp} />
        <AccueilProInput label={t('accueilpro.field.city')} value={city} onChangeText={setCity} />
        <AccueilProInput label={t('accueilpro.field.phone')} value={phone} onChangeText={setPhone} />
        <AccueilProInput label={t('accueilpro.field.email')} value={email} onChangeText={setEmail} />
        <AccueilProInput label="Type ERP (code)" value={erpType} onChangeText={setErpType} placeholder={ERP_TYPES.map(x => x.value).join(', ')} />
        <AccueilProInput label="Catégorie ERP" value={erpCategory} onChangeText={setErpCategory} placeholder={ERP_CATS.map(x => x.value).join(', ')} />
        <AccueilProInput label={t('accueilpro.venueTab.capacity')} value={capacity} onChangeText={setCapacity} keyboardType="numeric" />
        <AccueilProInput label={t('accueilpro.venueTab.fireNotes')} value={fireNotes} onChangeText={setFireNotes} multiline />
        <AccueilProInput label={t('accueilpro.venueTab.safetyRules')} value={safetyRules} onChangeText={setSafetyRules} multiline />
      </AccueilProFormCard>
      {venueId ?
        <AccueilProFormCard style={{ marginTop: Spacing.md }}>
          <Text style={apStyles.sectionTitle}>
            {t('accueilpro.venues.spacesSection', { n: String(spaceCount) })}
          </Text>
          <AccueilProLinkButton
            label={`+ ${t('accueilpro.venues.addSpace')}`}
            onPress={() => navigation.navigate('AccueilProSpaceEdit', { venueId })}
          />
          <AccueilProLinkButton
            label={t('accueilpro.venues.manageSpaces')}
            onPress={() => navigation.navigate('AccueilProVenueSpaces', { venueId })}
            style={{ marginTop: Spacing.sm }}
          />
          <AccueilProLinkButton
            label={t('accueilpro.personnel.venueStaff')}
            onPress={() => navigation.navigate('AccueilProPersonnel', { kind: 'lieu', venueId })}
            style={{ marginTop: Spacing.sm }}
          />
        </AccueilProFormCard>
      : <Text style={[apStyles.hint, { marginTop: Spacing.md }]}>{t('accueilpro.venues.saveFirstSpaces')}</Text>}
    </AccueilProScreenLayout>
  );
}

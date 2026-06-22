import React, { useCallback, useEffect, useState } from 'react';
import { Text, Alert, TouchableOpacity } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { VenuePlanSection } from '../../components/accueilpro/VenuePlanSection';
import { AccueilProFormCard, AccueilProInput } from '../../components/accueilpro/AccueilProUI';
import {
  AccueilProLinkButton,
  AccueilProPrimaryButton,
  AccueilProScreenLayout,
  apStyles,
} from '../../components/accueilpro/AccueilProUI';
import { Spacing } from '../../theme/spacing';
import { useLanguage } from '../../context/LanguageContext';
import {
  generateApId,
  getApVenue,
  listApConventionsByVenue,
  listApSpaces,
  saveApVenue,
  deleteApVenue,
} from '../../db/accueilProDb';
import { ERP_CATS, ERP_TYPES } from '../../lib/inspectionChecklist';
import type { ApConvention } from '../../types/accueilPro';

export default function AccueilProVenueEditScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { t } = useLanguage();
  const venueId = route.params?.id as string | undefined;
  const [recordId] = useState(() => venueId ?? generateApId());
  const returnToEvent = route.params?.returnToEvent === true;
  const eventEditId = route.params?.eventEditId as string | undefined;
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
  const [planLocalUri, setPlanLocalUri] = useState<string | null>(null);
  const [planFilename, setPlanFilename] = useState<string | null>(null);
  const [spaceCount, setSpaceCount] = useState(0);
  const [conventions, setConventions] = useState<ApConvention[]>([]);

  const loadVenue = useCallback(async (id: string) => {
    const v = await getApVenue(id);
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
      setPlanLocalUri(v.plan_local_uri ?? null);
      setPlanFilename(v.plan_filename ?? null);
      const [sp, conv] = await Promise.all([listApSpaces(id), listApConventionsByVenue(id)]);
      setSpaceCount(sp.length);
      setConventions(conv);
    }
  }, []);

  useEffect(() => {
    if (!venueId) return;
    void loadVenue(venueId).finally(() => setLoading(false));
  }, [venueId, loadVenue]);

  useFocusEffect(
    useCallback(() => {
      if (!venueId) return;
      void loadVenue(venueId);
    }, [venueId, loadVenue])
  );

  const onSave = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert(t('accueilpro.orgs.errTitle'), t('accueilpro.venues.errName'));
      return;
    }
    setSaving(true);
    try {
      const id = recordId;
      await saveApVenue({
        id,
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
        plan_local_uri: planLocalUri,
        plan_filename: planFilename,
      });
      if (venueId) {
        navigation.goBack();
      } else if (returnToEvent) {
        navigation.replace('AccueilProVenueEdit', {
          id,
          returnToEvent: true,
          eventEditId: eventEditId ?? undefined,
        });
      } else {
        navigation.replace('AccueilProVenueEdit', { id });
      }
    } finally {
      setSaving(false);
    }
  }, [
    venueId,
    recordId,
    name,
    address,
    cp,
    city,
    phone,
    email,
    erpType,
    erpCategory,
    capacity,
    fireNotes,
    safetyRules,
    planLocalUri,
    planFilename,
    navigation,
    t,
    returnToEvent,
    eventEditId,
  ]);

  const onDelete = useCallback(() => {
    if (!venueId) return;
    Alert.alert(t('accueilpro.deleteConfirmTitle'), t('accueilpro.venues.deleteVenueBody'), [
      { text: t('accueilpro.cancel'), style: 'cancel' },
      {
        text: t('accueilpro.delete'),
        style: 'destructive',
        onPress: () => void deleteApVenue(venueId).then(() => navigation.goBack()),
      },
    ]);
  }, [venueId, navigation, t]);

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

      {recordId ?
        <VenuePlanSection
          venueId={recordId}
          planLocalUri={planLocalUri}
          planFilename={planFilename}
          onChange={({ localUri, filename }) => {
            setPlanLocalUri(localUri);
            setPlanFilename(filename);
          }}
        />
      : null}

      {venueId ?
        <>
          <AccueilProFormCard style={{ marginTop: Spacing.md }}>
            <Text style={apStyles.sectionTitle}>{t('accueilpro.venues.conventionSection')}</Text>
            <Text style={[apStyles.hint, { marginBottom: Spacing.sm }]}>{t('accueilpro.venues.conventionHint')}</Text>
            {conventions.length === 0 ?
              <Text style={apStyles.empty}>{t('accueilpro.venues.conventionEmpty')}</Text>
            : conventions.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={[apStyles.row, { marginBottom: Spacing.xs }]}
                  onPress={() => navigation.navigate('AccueilProConventionEdit', { id: c.id, venueId })}
                >
                  <Text style={apStyles.rowTitle}>{c.titre}</Text>
                  <Text style={apStyles.rowMeta}>{c.status}{c.document_filename ? ` · PDF` : ''}</Text>
                </TouchableOpacity>
              ))
            }
            <AccueilProLinkButton
              label={`+ ${t('accueilpro.venues.addConvention')}`}
              onPress={() => navigation.navigate('AccueilProConventionEdit', { venueId })}
              style={{ marginTop: Spacing.sm }}
            />
          </AccueilProFormCard>

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
        </>
      : <Text style={[apStyles.hint, { marginTop: Spacing.md }]}>{t('accueilpro.venues.saveFirstSpaces')}</Text>}

      {venueId ?
        <AccueilProLinkButton label={t('accueilpro.venues.deleteVenue')} onPress={onDelete} style={{ marginTop: Spacing.md }} />
      : null}
    </AccueilProScreenLayout>
  );
}

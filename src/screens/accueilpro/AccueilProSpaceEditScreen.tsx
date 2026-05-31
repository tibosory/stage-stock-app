import React, { useCallback, useEffect, useState } from 'react';
import { Text, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AccueilProFormCard, AccueilProInput } from '../../components/accueilpro/AccueilProUI';
import {
  AccueilProPrimaryButton,
  AccueilProScreenLayout,
  apStyles,
} from '../../components/accueilpro/AccueilProUI';
import { SpaceControlPointsEditor } from '../../components/accueilpro/SpaceControlPointsEditor';
import { useLanguage } from '../../context/LanguageContext';
import { generateApId, getApSpace, saveApSpace } from '../../db/accueilProDb';
import type { ApInspectionControlPoint } from '../../types/accueilPro';

export default function AccueilProSpaceEditScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { t } = useLanguage();
  const venueId = route.params?.venueId as string;
  const spaceId = route.params?.id as string | undefined;
  const returnToEvent = route.params?.returnToEvent === true;
  const [loading, setLoading] = useState(!!spaceId);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('salle');
  const [capacity, setCapacity] = useState('100');
  const [description, setDescription] = useState('');
  const [controlPoints, setControlPoints] = useState<ApInspectionControlPoint[]>([]);

  useEffect(() => {
    if (!spaceId) return;
    void getApSpace(spaceId).then(sp => {
      if (sp) {
        setName(sp.name);
        setType(sp.type ?? 'salle');
        setCapacity(String(sp.capacity ?? 0));
        setDescription(sp.description ?? '');
        setControlPoints(sp.control_points ?? []);
      }
      setLoading(false);
    });
  }, [spaceId]);

  const onSave = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert(t('accueilpro.orgs.errTitle'), t('accueilpro.venues.errSpaceName'));
      return;
    }
    setSaving(true);
    try {
      await saveApSpace({
        id: spaceId ?? generateApId(),
        venue_id: venueId,
        name: name.trim(),
        type: type.trim() || null,
        capacity: parseInt(capacity, 10) || 0,
        description: description.trim() || null,
        control_points: controlPoints,
      });
      if (returnToEvent) {
        navigation.navigate('AccueilProEventEdit', {
          ...(route.params?.eventEditId ? { id: route.params.eventEditId as string } : {}),
          selectVenueId: venueId,
        });
        return;
      }
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  }, [spaceId, venueId, name, type, capacity, description, controlPoints, navigation, t, returnToEvent, route.params?.eventEditId]);

  return (
    <AccueilProScreenLayout
      backLabel={t('accueilpro.back')}
      onBack={() => navigation.goBack()}
      headerIcon={<Text style={{ fontSize: 22 }}>🏛️</Text>}
      headerTitle={spaceId ? t('accueilpro.venues.editSpace') : t('accueilpro.venues.newSpace')}
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
        <AccueilProInput label={t('accueilpro.venues.fieldSpaceName')} value={name} onChangeText={setName} required />
        <AccueilProInput label={t('accueilpro.venues.fieldSpaceType')} value={type} onChangeText={setType} />
        <AccueilProInput
          label={t('accueilpro.venues.fieldCapacity')}
          value={capacity}
          onChangeText={setCapacity}
          keyboardType="number-pad"
        />
        <AccueilProInput label={t('accueilpro.events.fieldDesc')} value={description} onChangeText={setDescription} multiline />
      </AccueilProFormCard>

      <AccueilProFormCard>
        <Text style={apStyles.sectionTitle}>{t('accueilpro.spaceChecks.title')}</Text>
        <Text style={[apStyles.hint, { marginBottom: 12 }]}>{t('accueilpro.spaceChecks.hint')}</Text>
        <SpaceControlPointsEditor
          points={controlPoints}
          onChange={setControlPoints}
          labels={{
            sectionControl: t('accueilpro.spaceChecks.sectionControl'),
            sectionVigilance: t('accueilpro.spaceChecks.sectionVigilance'),
            fieldLabel: t('accueilpro.spaceChecks.fieldLabel'),
            fieldHint: t('accueilpro.spaceChecks.fieldHint'),
            addControl: t('accueilpro.spaceChecks.addControl'),
            addVigilance: t('accueilpro.spaceChecks.addVigilance'),
            useStandard: t('accueilpro.spaceChecks.useStandard'),
            empty: t('accueilpro.spaceChecks.empty'),
            remove: t('accueilpro.spaceChecks.remove'),
          }}
        />
      </AccueilProFormCard>
    </AccueilProScreenLayout>
  );
}

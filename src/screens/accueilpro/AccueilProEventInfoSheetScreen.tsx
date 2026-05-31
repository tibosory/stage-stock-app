import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import {
  AccueilProFormCard,
  AccueilProInput,
  AccueilProLinkButton,
  AccueilProScreenLayout,
  AccueilProEmpty,
  apStyles,
} from '../../components/accueilpro/AccueilProUI';
import { useLanguage } from '../../context/LanguageContext';
import { getApEvent, getApVenue, resolveSpacesForEvent, saveApEventFeuilleInfo } from '../../db/accueilProDb';
import { emptyApEventFeuilleInfo, parseApEventFeuilleInfo } from '../../lib/accueilProFeuilleInfo';
import type { ApEventFeuilleInfo, ApSpace } from '../../types/accueilPro';

export default function AccueilProEventInfoSheetScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { t } = useLanguage();
  const eventId = route.params?.eventId as string;
  const [eventName, setEventName] = useState('');
  const [venueName, setVenueName] = useState('');
  const [spaces, setSpaces] = useState<ApSpace[]>([]);
  const [info, setInfo] = useState<ApEventFeuilleInfo>(emptyApEventFeuilleInfo());
  const infoRef = useRef(info);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    infoRef.current = info;
  }, [info]);

  const load = useCallback(async () => {
    const ev = await getApEvent(eventId);
    if (!ev) {
      setEventName('');
      setSpaces([]);
      return;
    }
    setEventName(ev.name);
    const [sp, venue] = await Promise.all([
      resolveSpacesForEvent(ev),
      ev.venue_id ? getApVenue(ev.venue_id) : Promise.resolve(null),
    ]);
    setSpaces(sp);
    setVenueName(venue?.name ?? '');
    setInfo(ev.feuille_info ?? parseApEventFeuilleInfo(null));
  }, [eventId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load().finally(() => setLoading(false));
    }, [load])
  );

  const persist = useCallback(
    async (next: ApEventFeuilleInfo) => {
      await saveApEventFeuilleInfo(eventId, next);
    },
    [eventId]
  );

  const setVenueEquipment = (text: string) => {
    setInfo(prev => ({ ...prev, venueEquipment: text }));
  };

  const setSpaceEquipment = (spaceId: string, text: string) => {
    setInfo(prev => ({
      ...prev,
      spaces: { ...prev.spaces, [spaceId]: text },
    }));
  };

  const flushSave = useCallback(() => {
    void persist(infoRef.current);
  }, [persist]);

  return (
    <AccueilProScreenLayout
      backLabel={t('accueilpro.back')}
      onBack={() => navigation.goBack()}
      headerIcon={<Text style={{ fontSize: 22 }}>📦</Text>}
      headerTitle={t('accueilpro.infoSheet.title')}
      headerSubtitle={eventName || undefined}
      loading={loading}
    >
      <Text style={[apStyles.hint, { marginBottom: 12 }]}>{t('accueilpro.infoSheet.hint')}</Text>

      <AccueilProLinkButton
        label={t('accueilpro.feuille.openEvent')}
        onPress={() => navigation.navigate('AccueilProFeuilleRouteEvent', { eventId })}
      />

      {venueName ?
        <AccueilProFormCard style={{ marginTop: 12 }}>
          <AccueilProInput
            label={t('accueilpro.infoSheet.venueMaterial', { venue: venueName })}
            value={info.venueEquipment ?? ''}
            onChangeText={setVenueEquipment}
            onBlur={flushSave}
            multiline
            placeholder={t('accueilpro.infoSheet.venuePlaceholder')}
          />
        </AccueilProFormCard>
      : null}

      {spaces.length === 0 ?
        <AccueilProEmpty message={t('accueilpro.infoSheet.noSpaces')} />
      : spaces.map(sp => (
          <AccueilProFormCard key={sp.id} style={{ marginTop: 12 }}>
            <AccueilProInput
              label={t('accueilpro.infoSheet.spaceMaterial', { space: sp.name })}
              value={info.spaces[sp.id] ?? ''}
              onChangeText={text => setSpaceEquipment(sp.id, text)}
              onBlur={flushSave}
              multiline
              placeholder={t('accueilpro.infoSheet.spacePlaceholder')}
            />
          </AccueilProFormCard>
        ))
      }
    </AccueilProScreenLayout>
  );
}

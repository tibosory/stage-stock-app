import React, { useCallback, useState } from 'react';
import { Alert, Text, TextInput } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { FeuilleRouteEventCard } from '../../components/accueilpro/FeuilleRouteEventCard';
import {
  AccueilProPrimaryButton,
  AccueilProLinkButton,
  AccueilProScreenLayout,
  AccueilProSectionCard,
  AccueilProColors,
  apStyles,
} from '../../components/accueilpro/AccueilProUI';
import { useLanguage } from '../../context/LanguageContext';
import { saveApEventFeuilleNote } from '../../db/accueilProDb';
import { apEventDateLocale } from '../../lib/accueilProFeuilleHelpers';
import {
  buildFeuilleRouteEventSnapshot,
  type FeuilleRouteEventSnapshot,
} from '../../lib/accueilProFeuilleRouteBuilder';
import { exportAccueilProFeuilleRouteEventPdf } from '../../lib/accueilProFeuilleRoutePdf';

export default function AccueilProFeuilleRouteEventScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { t, language } = useLanguage();
  const eventId = route.params?.eventId as string;
  const locale = apEventDateLocale(language);
  const [snapshot, setSnapshot] = useState<FeuilleRouteEventSnapshot | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    const data = await buildFeuilleRouteEventSnapshot(eventId, locale);
    if (!data) {
      setSnapshot(null);
      return;
    }
    setSnapshot(data);
    setNote(data.note);
  }, [eventId, locale]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load().finally(() => setLoading(false));
    }, [load])
  );

  const onExport = async () => {
    if (!snapshot) return;
    setExporting(true);
    try {
      await exportAccueilProFeuilleRouteEventPdf({ ...snapshot, note });
    } catch (e) {
      Alert.alert(t('accueilpro.feuille.exportError'), e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  };

  if (!loading && !snapshot) {
    return (
      <AccueilProScreenLayout
        backLabel={t('accueilpro.back')}
        onBack={() => navigation.goBack()}
        headerTitle={t('accueilpro.feuille.title')}
        loading={false}
      >
        <Text style={apStyles.empty}>{t('accueilpro.feuille.notFound')}</Text>
      </AccueilProScreenLayout>
    );
  }

  return (
    <AccueilProScreenLayout
      backLabel={t('accueilpro.back')}
      onBack={() => navigation.goBack()}
      headerIcon={<Text style={{ fontSize: 22 }}>🗒</Text>}
      headerTitle={snapshot?.title ?? t('accueilpro.feuille.title')}
      headerSubtitle={snapshot?.datesLabel}
      loading={loading}
      footer={
        snapshot ?
          <AccueilProPrimaryButton
            label={t('accueilpro.feuille.export')}
            onPress={() => void onExport()}
            loading={exporting}
          />
        : undefined
      }
    >
      {snapshot ?
        <>
          <FeuilleRouteEventCard block={snapshot.block} spaceNames={snapshot.spaceNames} t={t} />

          <AccueilProLinkButton
            label={t('accueilpro.infoSheet.edit')}
            onPress={() => navigation.navigate('AccueilProEventInfoSheet', { eventId })}
          />

          {snapshot.venue ?
            <AccueilProSectionCard title={t('accueilpro.feuille.venuesSecurity')}>
              <Text style={{ fontWeight: '700' }}>{snapshot.venue.name}</Text>
              <Text style={{ fontSize: 12, color: AccueilProColors.textMuted, marginTop: 4 }}>
                ERP {snapshot.venue.erp_type ?? '?'} · {snapshot.venue.fire_notes ?? '—'}
              </Text>
            </AccueilProSectionCard>
          : null}

          <AccueilProSectionCard title={t('accueilpro.feuille.notes')}>
            <TextInput
              value={note}
              onChangeText={setNote}
              onBlur={() => void saveApEventFeuilleNote(eventId, note)}
              multiline
              numberOfLines={5}
              placeholder={t('accueilpro.feuille.notesPlaceholder')}
              style={{
                backgroundColor: AccueilProColors.cream,
                borderRadius: 8,
                padding: 12,
                minHeight: 100,
                textAlignVertical: 'top',
              }}
            />
          </AccueilProSectionCard>
        </>
      : null}
    </AccueilProScreenLayout>
  );
}

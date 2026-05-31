import React from 'react';
import { Text } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AccueilProScreenLayout } from '../../components/accueilpro/AccueilProUI';
import { EventDocumentsSection } from '../../components/accueilpro/EventDocumentsSection';
import { useLanguage } from '../../context/LanguageContext';

export default function AccueilProPortalEventDocumentsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { t } = useLanguage();

  const eventId = route.params?.eventId as string;
  const organizationId = route.params?.organizationId as string;
  const eventName = (route.params?.eventName as string | undefined) ?? t('accueilpro.events.title');
  const organizationName = route.params?.organizationName as string | undefined;

  return (
    <AccueilProScreenLayout
      backLabel={t('accueilpro.back')}
      onBack={() => navigation.goBack()}
      headerIcon={<Text style={{ fontSize: 22 }}>📎</Text>}
      headerTitle={eventName}
      headerSubtitle={organizationName ?? t('accueilpro.portal.eventDocsSubtitle')}
      showFieldStrip
    >
      <EventDocumentsSection organizationId={organizationId} eventId={eventId} />
    </AccueilProScreenLayout>
  );
}

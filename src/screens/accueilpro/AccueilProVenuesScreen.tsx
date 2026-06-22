import React, { useCallback, useState } from 'react';
import { Text, Alert } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { VenueSpaceBubblePicker } from '../../components/accueilpro/VenueSpaceBubblePicker';
import {
  AccueilProEmpty,
  AccueilProPrimaryButton,
  AccueilProScreenLayout,
} from '../../components/accueilpro/AccueilProUI';
import { useLanguage } from '../../context/LanguageContext';
import { deleteApSpace, deleteApVenue, listApVenues, listApSpaces } from '../../db/accueilProDb';
import type { ApSpace, ApVenue } from '../../types/accueilPro';

export default function AccueilProVenuesScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { t } = useLanguage();
  const returnToEvent = route.params?.returnToEvent === true;
  const eventEditId = route.params?.eventEditId as string | undefined;
  const [venues, setVenues] = useState<ApVenue[]>([]);
  const [spaces, setSpaces] = useState<ApSpace[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(
    (route.params?.venueId as string | undefined) ?? null
  );
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(
    (route.params?.spaceId as string | undefined) ?? null
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [v, sp] = await Promise.all([listApVenues(), listApSpaces()]);
    setVenues(v);
    setSpaces(sp);

    const fromRouteVenue = route.params?.venueId as string | undefined;
    const fromRouteSpace = route.params?.spaceId as string | undefined;

    setSelectedVenueId(prev => {
      const nextVenue =
        (prev && v.some(x => x.id === prev) && prev) ||
        (fromRouteVenue && v.some(x => x.id === fromRouteVenue) ? fromRouteVenue : null) ||
        v[0]?.id ||
        null;

      const venueSpaces = nextVenue ? sp.filter(s => s.venue_id === nextVenue) : [];
      setSelectedSpaceId(prevSpace => {
        if (fromRouteSpace && venueSpaces.some(s => s.id === fromRouteSpace)) return fromRouteSpace;
        if (prevSpace && venueSpaces.some(s => s.id === prevSpace)) return prevSpace;
        return venueSpaces[0]?.id ?? null;
      });

      return nextVenue;
    });
  }, [route.params?.spaceId, route.params?.venueId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load().finally(() => setLoading(false));
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const labels = {
    venuesSection: t('accueilpro.venues.bubbleVenues'),
    spacesSection: t('accueilpro.venues.bubbleSpaces', { n: '{n}' }),
    addVenue: t('accueilpro.venues.new'),
    addSpace: t('accueilpro.venues.newSpace'),
    noVenues: t('accueilpro.venues.empty'),
    noSpaces: t('accueilpro.venues.noSpacesTapAdd'),
    selectVenueHint: t('accueilpro.venues.selectVenueHint'),
    spaceType: t('accueilpro.venues.fieldSpaceType'),
    spaceCapacity: t('accueilpro.venues.fieldCapacity'),
    spaceDescription: t('accueilpro.events.fieldDesc'),
    controlPoints: t('accueilpro.venues.controlPointsCount', { n: '{n}' }),
    editSpace: t('accueilpro.venues.editSpace'),
    editVenue: t('accueilpro.venues.edit'),
    deleteVenue: t('accueilpro.venues.deleteVenue'),
    deleteSpace: t('accueilpro.venues.deleteSpace'),
    venueDetail: t('accueilpro.venues.fullDetail'),
  };

  const confirmDeleteVenue = (id: string) => {
    Alert.alert(t('accueilpro.deleteConfirmTitle'), t('accueilpro.venues.deleteVenueBody'), [
      { text: t('accueilpro.cancel'), style: 'cancel' },
      {
        text: t('accueilpro.delete'),
        style: 'destructive',
        onPress: () =>
          void deleteApVenue(id).then(() => {
            if (selectedVenueId === id) {
              setSelectedVenueId(null);
              setSelectedSpaceId(null);
            }
            void load();
          }),
      },
    ]);
  };

  const confirmDeleteSpace = (venueId: string, spaceId: string) => {
    Alert.alert(t('accueilpro.deleteConfirmTitle'), t('accueilpro.venues.deleteSpaceBody'), [
      { text: t('accueilpro.cancel'), style: 'cancel' },
      {
        text: t('accueilpro.delete'),
        style: 'destructive',
        onPress: () =>
          void deleteApSpace(spaceId).then(() => {
            if (selectedSpaceId === spaceId) setSelectedSpaceId(null);
            void load();
          }),
      },
    ]);
  };

  return (
    <AccueilProScreenLayout
      backLabel={t('accueilpro.back')}
      onBack={() => navigation.goBack()}
      headerIcon={<Text style={{ fontSize: 22 }}>🏢</Text>}
      headerTitle={t('accueilpro.venues.title')}
      headerRightLabel={t('accueilpro.orgs.add')}
      onHeaderRight={() => navigation.navigate('AccueilProVenueEdit')}
      loading={loading}
      refreshing={refreshing}
      onRefresh={() => void onRefresh()}
      footer={
        returnToEvent ?
          <AccueilProPrimaryButton
            label={t('accueilpro.events.backToEvent')}
            onPress={() =>
              navigation.navigate('AccueilProEventEdit', {
                ...(eventEditId ? { id: eventEditId } : {}),
                selectVenueId: selectedVenueId ?? undefined,
              })
            }
          />
        : undefined
      }
    >
      {venues.length === 0 ?
        <AccueilProEmpty message={t('accueilpro.venues.empty')} emoji="🏛" />
      : (
        <VenueSpaceBubblePicker
          venues={venues}
          spaces={spaces}
          selectedVenueId={selectedVenueId}
          selectedSpaceId={selectedSpaceId}
          onSelectVenue={id => {
            setSelectedVenueId(id);
            const first = spaces.find(s => s.venue_id === id);
            setSelectedSpaceId(first?.id ?? null);
          }}
          onSelectSpace={setSelectedSpaceId}
          onAddVenue={() => navigation.navigate('AccueilProVenueEdit')}
          onAddSpace={venueId => navigation.navigate('AccueilProSpaceEdit', { venueId })}
          onEditVenue={id => navigation.navigate('AccueilProVenueEdit', { id })}
          onEditSpace={(venueId, spaceId) =>
            navigation.navigate('AccueilProSpaceEdit', { venueId, id: spaceId })
          }
          onDeleteVenue={confirmDeleteVenue}
          onDeleteSpace={confirmDeleteSpace}
          onOpenVenueDetail={id => navigation.navigate('AccueilProVenueDetail', { id })}
          labels={labels}
        />
      )}
    </AccueilProScreenLayout>
  );
}

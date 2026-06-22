import React, { useCallback, useMemo, useState } from 'react';
import { Text, View, Alert } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { VenueSpaceBubblePicker } from '../../components/accueilpro/VenueSpaceBubblePicker';
import { VenuePlanSection } from '../../components/accueilpro/VenuePlanSection';
import { AccueilProContactCard } from '../../components/accueilpro/AccueilProContactCard';
import {
  AccueilProChip,
  AccueilProEmpty,
  AccueilProListRow,
  AccueilProScreenLayout,
  AccueilProStatusBadge,
  AccueilProTypeBadge,
  AccueilProColors,
  apStyles,
} from '../../components/accueilpro/AccueilProUI';
import { useLanguage } from '../../context/LanguageContext';
import { ERP_CATS, ERP_TYPES } from '../../lib/inspectionChecklist';
import { contactFieldLabelsFromT, personnelContactLines } from '../../lib/accueilProContactDisplay';
import { accueilProEventColor } from '../../lib/accueilProEventColors';
import {
  isPersonnelPermanent,
  personnelDisplayName,
} from '../../lib/accueilProPersonnelHelpers';
import {
  getApVenue,
  listApConventionsByVenue,
  listApEvents,
  listApPersonnel,
  listApSpaces,
  deleteApSpace,
  deleteApVenue,
} from '../../db/accueilProDb';
import type { ApConvention, ApEvent, ApPersonnel, ApSpace, ApVenue } from '../../types/accueilPro';

type TabId = 'espaces' | 'equipe' | 'reglementation' | 'evenements';

export default function AccueilProVenueDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { t } = useLanguage();
  const venueId = route.params?.id as string;
  const [tab, setTab] = useState<TabId>('espaces');
  const [venue, setVenue] = useState<ApVenue | null>(null);
  const [spaces, setSpaces] = useState<ApSpace[]>([]);
  const [team, setTeam] = useState<ApPersonnel[]>([]);
  const [events, setEvents] = useState<ApEvent[]>([]);
  const [conventions, setConventions] = useState<ApConvention[]>([]);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const contactFieldLabels = useMemo(() => contactFieldLabelsFromT(t), [t]);

  const load = useCallback(async () => {
    const v = await getApVenue(venueId);
    if (!v) {
      setVenue(null);
      return;
    }
    setVenue(v);
    const [sp, tm, ev, conv] = await Promise.all([
      listApSpaces(venueId),
      listApPersonnel({ kind: 'lieu', venueId }),
      listApEvents(),
      listApConventionsByVenue(venueId),
    ]);
    setSpaces(sp);
    setTeam(tm);
    setEvents(ev.filter(e => e.venue_id === venueId));
    setConventions(conv);
    setSelectedSpaceId(prev => (prev && sp.some(s => s.id === prev) ? prev : sp[0]?.id ?? null));
  }, [venueId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load().finally(() => setLoading(false));
    }, [load])
  );

  const confirmDeleteVenue = (_id?: string) => {
    Alert.alert(t('accueilpro.deleteConfirmTitle'), t('accueilpro.venues.deleteVenueBody'), [
      { text: t('accueilpro.cancel'), style: 'cancel' },
      {
        text: t('accueilpro.delete'),
        style: 'destructive',
        onPress: () => void deleteApVenue(venueId).then(() => navigation.goBack()),
      },
    ]);
  };

  const confirmDeleteSpace = (_vId: string, spaceId: string) => {
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

  if (!loading && !venue) {
    return (
      <AccueilProScreenLayout
        backLabel={t('accueilpro.back')}
        onBack={() => navigation.goBack()}
        headerTitle={t('accueilpro.venues.title')}
      >
        <AccueilProEmpty message={t('accueilpro.venues.notFound')} />
      </AccueilProScreenLayout>
    );
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: 'espaces', label: t('accueilpro.venueTab.spaces') },
    { id: 'equipe', label: t('accueilpro.venueTab.team') },
    { id: 'reglementation', label: t('accueilpro.venueTab.safety') },
    { id: 'evenements', label: t('accueilpro.venueTab.events') },
  ];

  return (
    <AccueilProScreenLayout
      backLabel={t('accueilpro.back')}
      onBack={() => navigation.goBack()}
      headerTitle={venue?.name ?? '…'}
      headerSubtitle={venue ? `${venue.address ?? ''}, ${venue.cp ?? ''} ${venue.city ?? ''}`.trim() : undefined}
      headerRightLabel={t('accueilpro.edit')}
      onHeaderRight={() => navigation.navigate('AccueilProVenueEdit', { id: venueId })}
      loading={loading}
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 14 }}>
        {tabs.map(item => (
          <AccueilProChip key={item.id} label={item.label} selected={tab === item.id} onPress={() => setTab(item.id)} />
        ))}
      </View>

      {tab === 'espaces' && (
        <VenueSpaceBubblePicker
          venues={venue ? [venue] : []}
          spaces={spaces}
          selectedVenueId={venueId}
          selectedSpaceId={selectedSpaceId}
          onSelectVenue={() => {}}
          onSelectSpace={setSelectedSpaceId}
          onAddVenue={() => navigation.navigate('AccueilProVenueEdit', { id: venueId })}
          onAddSpace={() => navigation.navigate('AccueilProSpaceEdit', { venueId })}
          onEditVenue={() => navigation.navigate('AccueilProVenueEdit', { id: venueId })}
          onEditSpace={(vId, sId) => navigation.navigate('AccueilProSpaceEdit', { venueId: vId, id: sId })}
          onDeleteVenue={confirmDeleteVenue}
          onDeleteSpace={confirmDeleteSpace}
          singleVenueMode
          labels={{
            venuesSection: t('accueilpro.venueTab.spaces'),
            spacesSection: t('accueilpro.venues.bubbleSpaces', { n: '{n}' }),
            addVenue: t('accueilpro.venues.edit'),
            addSpace: t('accueilpro.venues.newSpace'),
            noVenues: t('accueilpro.venues.notFound'),
            noSpaces: t('accueilpro.venues.noSpacesTapAdd'),
            selectVenueHint: '',
            spaceType: t('accueilpro.venues.fieldSpaceType'),
            spaceCapacity: t('accueilpro.venues.fieldCapacity'),
            spaceDescription: t('accueilpro.events.fieldDesc'),
            controlPoints: t('accueilpro.venues.controlPointsCount', { n: '{n}' }),
            editSpace: t('accueilpro.venues.editSpace'),
            editVenue: t('accueilpro.venues.edit'),
            deleteVenue: t('accueilpro.venues.deleteVenue'),
            deleteSpace: t('accueilpro.venues.deleteSpace'),
            venueDetail: '',
          }}
        />
      )}

      {tab === 'equipe' && (
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
            <Text style={apStyles.sectionTitle}>{t('accueilpro.venueTab.teamCount', { n: String(team.length) })}</Text>
            <Text style={{ color: AccueilProColors.gold, fontWeight: '700' }} onPress={() => navigation.navigate('AccueilProPersonnelEdit', { kind: 'lieu', venueId })}>
              + {t('accueilpro.add')}
            </Text>
          </View>
          {team.length === 0 ?
            <AccueilProEmpty message={t('accueilpro.personnel.empty')} />
          : team.map(m => {
              const permanent = isPersonnelPermanent(m);
              return (
                <AccueilProContactCard
                  key={m.id}
                  displayName={personnelDisplayName(m)}
                  badge={permanent ? t('accueilpro.contacts.permanentBadge') : null}
                  lines={personnelContactLines(m, contactFieldLabels)}
                  phone={m.phone}
                  email={m.email}
                  photoUri={m.photo_uri}
                  variant={permanent ? 'permanentStaff' : 'default'}
                  onPress={() =>
                    navigation.navigate('AccueilProPersonnelEdit', {
                      id: m.id,
                      kind: 'lieu',
                      venueId: m.venue_id,
                    })
                  }
                />
              );
            })}
        </View>
      )}

      {tab === 'reglementation' && venue && (
        <View style={{ gap: 12 }}>
          <VenuePlanSection
            venueId={venueId}
            planLocalUri={venue.plan_local_uri ?? null}
            planFilename={venue.plan_filename ?? null}
            readOnly
          />
          <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: AccueilProColors.borderSubtle }}>
            <Text style={apStyles.sectionTitle}>{t('accueilpro.venueTab.erpType')}</Text>
            {venue.erp_type ?
              <>
                <Text style={{ fontWeight: '800', color: AccueilProColors.navy, marginTop: 6 }}>
                  {ERP_TYPES.find(x => x.value === venue.erp_type)?.label ?? venue.erp_type}
                </Text>
              </>
            : <Text style={{ color: AccueilProColors.textMuted }}>{t('accueilpro.venueTab.notSet')}</Text>}
          </View>
          <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: AccueilProColors.borderSubtle }}>
            <Text style={apStyles.sectionTitle}>{t('accueilpro.venueTab.erpCategory')}</Text>
            {venue.erp_category ?
              <>
                <Text style={{ fontWeight: '700', marginTop: 6 }}>
                  {ERP_CATS.find(x => x.value === venue.erp_category)?.label ?? venue.erp_category}
                </Text>
                <Text style={{ marginTop: 8 }}>{t('accueilpro.venueTab.capacity')}: <Text style={{ fontWeight: '700' }}>{venue.capacity ?? 0}</Text></Text>
              </>
            : <Text style={{ color: AccueilProColors.textMuted }}>{t('accueilpro.venueTab.notSet')}</Text>}
          </View>
          <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: AccueilProColors.borderSubtle }}>
            <Text style={apStyles.sectionTitle}>🔥 {t('accueilpro.venueTab.fireNotes')}</Text>
            <Text style={{ marginTop: 6, lineHeight: 20 }}>{venue.fire_notes?.trim() || t('accueilpro.venueTab.notSet')}</Text>
          </View>
          <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: AccueilProColors.borderSubtle }}>
            <Text style={apStyles.sectionTitle}>⚠️ {t('accueilpro.venueTab.safetyRules')}</Text>
            <Text style={{ marginTop: 6, lineHeight: 20 }}>{venue.safety_rules?.trim() || t('accueilpro.venueTab.notSet')}</Text>
          </View>
          <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: AccueilProColors.borderSubtle }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={apStyles.sectionTitle}>{t('accueilpro.venues.conventionSection')}</Text>
              <Text
                style={{ color: AccueilProColors.gold, fontWeight: '700' }}
                onPress={() => navigation.navigate('AccueilProConventionEdit', { venueId })}
              >
                + {t('accueilpro.add')}
              </Text>
            </View>
            {conventions.length === 0 ?
              <Text style={{ color: AccueilProColors.textMuted }}>{t('accueilpro.venues.conventionEmpty')}</Text>
            : conventions.map(c => (
                <AccueilProListRow
                  key={c.id}
                  title={c.titre}
                  meta={[c.status, c.document_filename ? 'PDF' : null].filter(Boolean).join(' · ')}
                  onPress={() => navigation.navigate('AccueilProConventionEdit', { id: c.id, venueId })}
                />
              ))
            }
          </View>
        </View>
      )}

      {tab === 'evenements' && (
        <View>
          {events.length === 0 ?
            <AccueilProEmpty message={t('accueilpro.venueTab.noEvents')} />
          : events.map(e => (
            <AccueilProListRow
              key={e.id}
              title={e.name}
              meta={e.date_debut ?? '—'}
              accentColor={accueilProEventColor(e.id).bg}
              onPress={() => navigation.navigate('AccueilProEventDetail', { id: e.id })}
              rightAccessory={
                <View style={{ gap: 6, alignItems: 'flex-end' }}>
                  <AccueilProTypeBadge type={e.type} />
                  <AccueilProStatusBadge status={e.status} />
                </View>
              }
            />
          ))}
        </View>
      )}
    </AccueilProScreenLayout>
  );
}

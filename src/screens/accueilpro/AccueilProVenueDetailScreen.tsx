import React, { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
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
import {
  getApVenue,
  listApEvents,
  listApPersonnel,
  listApSpaces,
} from '../../db/accueilProDb';
import type { ApEvent, ApPersonnel, ApSpace, ApVenue } from '../../types/accueilPro';

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
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const v = await getApVenue(venueId);
    if (!v) {
      setVenue(null);
      return;
    }
    setVenue(v);
    const [sp, tm, ev] = await Promise.all([
      listApSpaces(venueId),
      listApPersonnel({ kind: 'lieu', venueId }),
      listApEvents(),
    ]);
    setSpaces(sp);
    setTeam(tm);
    setEvents(ev.filter(e => e.venue_id === venueId));
  }, [venueId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load().finally(() => setLoading(false));
    }, [load])
  );

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
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
            <Text style={apStyles.sectionTitle}>{t('accueilpro.venueTab.spacesCount', { n: String(spaces.length) })}</Text>
            <Text style={{ color: AccueilProColors.gold, fontWeight: '700' }} onPress={() => navigation.navigate('AccueilProSpaceEdit', { venueId })}>
              + {t('accueilpro.add')}
            </Text>
          </View>
          {spaces.length === 0 ?
            <AccueilProEmpty message={t('accueilpro.venues.noSpaces')} />
          : spaces.map(s => (
            <AccueilProListRow
              key={s.id}
              title={s.name}
              meta={`${s.type ?? '—'} · ${s.capacity ?? 0} pers.`}
              subtitle={s.description ?? undefined}
              onPress={() => navigation.navigate('AccueilProSpaceEdit', { venueId, id: s.id })}
            />
          ))}
        </View>
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
          : team.map(m => (
            <AccueilProListRow key={m.id} title={m.name} meta={[m.role, m.phone].filter(Boolean).join(' · ')} subtitle={m.mission ?? undefined} />
          ))}
        </View>
      )}

      {tab === 'reglementation' && venue && (
        <View style={{ gap: 12 }}>
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

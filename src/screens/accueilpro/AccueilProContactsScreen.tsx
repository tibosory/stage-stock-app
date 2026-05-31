import React, { useCallback, useMemo, useState } from 'react';
import { Text, TextInput, View, SectionList } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { AccueilProContactCard } from '../../components/accueilpro/AccueilProContactCard';
import {
  AccueilProChip,
  AccueilProEmpty,
  AccueilProScreenLayout,
  AccueilProColors,
  apStyles,
} from '../../components/accueilpro/AccueilProUI';
import {
  contactFieldLabelsFromT,
  personnelContactLines,
} from '../../lib/accueilProContactDisplay';
import { Spacing } from '../../theme/spacing';
import { useLanguage } from '../../context/LanguageContext';
import { listApPersonnel, listApVenues } from '../../db/accueilProDb';
import {
  isPersonnelPermanent,
  partitionPersonnelForDirectory,
  personnelDisplayName,
} from '../../lib/accueilProPersonnelHelpers';
import type { ApPersonnel, ApPersonnelKind } from '../../types/accueilPro';

type ContactRow = ApPersonnel & { venueName: string };

type ContactSection = {
  key: string;
  title: string;
  permanent: boolean;
  data: ContactRow[];
};

const KIND_FILTERS: Array<'tous' | ApPersonnelKind> = ['tous', 'lieu', 'organisation', 'externe'];

export default function AccueilProContactsScreen() {
  const navigation = useNavigation<any>();
  const { t } = useLanguage();
  const [rows, setRows] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('tous');
  const [filterVenue, setFilterVenue] = useState('tous');
  const [filterKind, setFilterKind] = useState<'tous' | ApPersonnelKind>('tous');

  const load = useCallback(async () => {
    const [venues, team] = await Promise.all([listApVenues(), listApPersonnel()]);
    const venueMap = Object.fromEntries(venues.map(v => [v.id, v.name]));
    setRows(team.map(m => ({ ...m, venueName: venueMap[m.venue_id ?? ''] ?? '—' })));
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load().finally(() => setLoading(false));
    }, [load])
  );

  const kindLabel = (kind: ApPersonnelKind) => {
    if (kind === 'lieu') return t('accueilpro.personnel.kindVenue');
    if (kind === 'organisation') return t('accueilpro.personnel.kindOrg');
    return t('accueilpro.personnel.kindExternal');
  };

  const roles = useMemo(() => [...new Set(rows.map(r => r.role).filter(Boolean))].sort(), [rows]);

  const filtered = useMemo(() => {
    return rows.filter(m => {
      const q = search.trim().toLowerCase();
      const haystack = [
        m.name,
        m.first_name,
        m.last_name,
        m.role,
        m.phone,
        m.email,
        m.address,
        m.venueName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const matchSearch = !q || haystack.includes(q);
      const matchRole = filterRole === 'tous' || m.role === filterRole;
      const matchVenue = filterVenue === 'tous' || m.venueName === filterVenue;
      const matchKind = filterKind === 'tous' || m.kind === filterKind;
      return matchSearch && matchRole && matchVenue && matchKind;
    });
  }, [rows, search, filterRole, filterVenue, filterKind]);

  const sections = useMemo((): ContactSection[] => {
    const { permanent, others } = partitionPersonnelForDirectory(filtered);
    const out: ContactSection[] = [];
    if (permanent.length > 0) {
      out.push({
        key: 'permanent',
        title: t('accueilpro.contacts.sectionPermanent'),
        permanent: true,
        data: permanent,
      });
    }
    if (others.length > 0) {
      out.push({
        key: 'others',
        title: t('accueilpro.contacts.sectionOthers'),
        permanent: false,
        data: others,
      });
    }
    return out;
  }, [filtered, t]);

  const fieldLabels = useMemo(() => contactFieldLabelsFromT(t), [t]);

  const renderContact = (item: ContactRow) => {
    const permanent = isPersonnelPermanent(item);
    return (
      <AccueilProContactCard
        displayName={personnelDisplayName(item)}
        badge={permanent ? t('accueilpro.contacts.permanentBadge') : null}
        lines={personnelContactLines(item, fieldLabels, {
          kindLabel: item.kind === 'lieu' ? t('accueilpro.personnel.venueStaff') : kindLabel(item.kind),
          venueName: item.venueName !== '—' ? item.venueName : undefined,
        })}
        phone={item.phone}
        email={item.email}
        photoUri={item.photo_uri}
        variant={permanent ? 'permanentStaff' : 'default'}
        onPress={() => navigation.navigate('AccueilProPersonnelEdit', { id: item.id })}
      />
    );
  };

  return (
    <AccueilProScreenLayout
      backLabel={t('accueilpro.back')}
      onBack={() => navigation.goBack()}
      headerIcon={<Text style={{ fontSize: 22 }}>📇</Text>}
      headerTitle={t('accueilpro.contacts.title')}
      headerSubtitle={t('accueilpro.contacts.subtitle', { n: String(rows.length) })}
      headerRightLabel={`+ ${t('accueilpro.contacts.add')}`}
      onHeaderRight={() => navigation.navigate('AccueilProPersonnel', { kind: 'lieu' })}
      loading={loading}
      scroll={false}
    >
      <View style={{ paddingHorizontal: 16, paddingBottom: 8, backgroundColor: AccueilProColors.cream }}>
        <Text style={[apStyles.hint, { marginBottom: Spacing.sm }]}>{t('accueilpro.contacts.directoryHint')}</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={t('accueilpro.contacts.search')}
          placeholderTextColor={AccueilProColors.textMuted}
          style={{
            backgroundColor: '#fff',
            borderRadius: 8,
            borderWidth: 1,
            borderColor: AccueilProColors.borderSubtle,
            paddingHorizontal: 12,
            paddingVertical: 10,
            marginBottom: 8,
          }}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
          {KIND_FILTERS.map(k => (
            <AccueilProChip
              key={k}
              label={k === 'tous' ? t('accueilpro.contacts.allKinds') : kindLabel(k)}
              selected={filterKind === k}
              onPress={() => setFilterKind(k)}
            />
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          <AccueilProChip
            label={t('accueilpro.contacts.allRoles')}
            selected={filterRole === 'tous'}
            onPress={() => setFilterRole('tous')}
          />
          {roles.map(r => (
            <AccueilProChip key={r} label={r!} selected={filterRole === r} onPress={() => setFilterRole(r!)} />
          ))}
        </View>
      </View>
      <SectionList
        sections={sections}
        keyExtractor={i => i.id}
        contentContainerStyle={[apStyles.list, { paddingBottom: 48 }]}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={<AccueilProEmpty message={t('accueilpro.contacts.empty')} />}
        renderSectionHeader={({ section }) => (
          <Text
            style={[
              apStyles.sectionTitle,
              {
                marginTop: section.key === 'others' && sections.some(s => s.key === 'permanent') ? Spacing.md : Spacing.sm,
                color: section.permanent ? AccueilProColors.gold : AccueilProColors.navy,
              },
            ]}
          >
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => renderContact(item)}
      />
    </AccueilProScreenLayout>
  );
}

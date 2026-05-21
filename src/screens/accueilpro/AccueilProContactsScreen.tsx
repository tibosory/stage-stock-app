import React, { useCallback, useMemo, useState } from 'react';
import { Text, TextInput, View, FlatList } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ContactActionRow } from '../../components/accueilpro/ContactActionRow';
import {
  AccueilProChip,
  AccueilProEmpty,
  AccueilProListRow,
  AccueilProScreenLayout,
  AccueilProColors,
  apStyles,
} from '../../components/accueilpro/AccueilProUI';
import { useLanguage } from '../../context/LanguageContext';
import { listApPersonnel, listApVenues } from '../../db/accueilProDb';
import type { ApPersonnel } from '../../types/accueilPro';

type ContactRow = ApPersonnel & { venueName: string };

export default function AccueilProContactsScreen() {
  const navigation = useNavigation<any>();
  const { t } = useLanguage();
  const [rows, setRows] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('tous');
  const [filterVenue, setFilterVenue] = useState('tous');

  const load = useCallback(async () => {
    const [venues, team] = await Promise.all([listApVenues(), listApPersonnel({ kind: 'lieu' })]);
    const venueMap = Object.fromEntries(venues.map(v => [v.id, v.name]));
    setRows(team.map(m => ({ ...m, venueName: venueMap[m.venue_id ?? ''] ?? '—' })));
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load().finally(() => setLoading(false));
    }, [load])
  );

  const roles = useMemo(() => [...new Set(rows.map(r => r.role).filter(Boolean))].sort(), [rows]);
  const venues = useMemo(() => [...new Set(rows.map(r => r.venueName))].sort(), [rows]);

  const filtered = rows.filter(m => {
    const q = search.trim().toLowerCase();
    const matchSearch = !q || m.name.toLowerCase().includes(q) || (m.role ?? '').toLowerCase().includes(q);
    const matchRole = filterRole === 'tous' || m.role === filterRole;
    const matchVenue = filterVenue === 'tous' || m.venueName === filterVenue;
    return matchSearch && matchRole && matchVenue;
  });

  return (
    <AccueilProScreenLayout
      backLabel={t('accueilpro.back')}
      onBack={() => navigation.goBack()}
      headerIcon={<Text style={{ fontSize: 22 }}>📇</Text>}
      headerTitle={t('accueilpro.contacts.title')}
      headerSubtitle={t('accueilpro.contacts.subtitle', { n: String(rows.length) })}
      loading={loading}
      scroll={false}
    >
      <View style={{ paddingHorizontal: 16, paddingBottom: 8, backgroundColor: AccueilProColors.cream }}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={t('accueilpro.contacts.search')}
          placeholderTextColor={AccueilProColors.textMuted}
          style={{ backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: AccueilProColors.borderSubtle, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 }}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          <AccueilProChip label={t('accueilpro.contacts.allRoles')} selected={filterRole === 'tous'} onPress={() => setFilterRole('tous')} />
          {roles.map(r => <AccueilProChip key={r} label={r!} selected={filterRole === r} onPress={() => setFilterRole(r!)} />)}
        </View>
      </View>
      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        contentContainerStyle={[apStyles.list, { paddingBottom: 48 }]}
        ListEmptyComponent={<AccueilProEmpty message={t('accueilpro.contacts.empty')} />}
        renderItem={({ item }) => (
          <AccueilProListRow
            title={item.name}
            meta={[item.role, item.venueName].filter(Boolean).join(' · ')}
            subtitle={item.mission ?? undefined}
            rightAccessory={<ContactActionRow phone={item.phone} email={item.email} />}
          />
        )}
      />
    </AccueilProScreenLayout>
  );
}

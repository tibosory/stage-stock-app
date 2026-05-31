import React, { useCallback, useState } from 'react';
import { Text, FlatList, RefreshControl, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  AccueilProEmpty,
  AccueilProLinkButton,
  AccueilProListRow,
  AccueilProScreenLayout,
  AccueilProColors,
  apStyles,
} from '../../components/accueilpro/AccueilProUI';
import { Spacing } from '../../theme/spacing';
import { useLanguage } from '../../context/LanguageContext';
import { listApOrganizations } from '../../db/accueilProDb';
import type { ApOrganization } from '../../types/accueilPro';

export default function AccueilProOrganizationsScreen() {
  const navigation = useNavigation<any>();
  const { t } = useLanguage();
  const [rows, setRows] = useState<ApOrganization[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRows(await listApOrganizations());
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load().finally(() => setLoading(false));
    }, [load])
  );

  const openCreateEvent = (org: ApOrganization) => {
    navigation.navigate('AccueilProEventEdit', {
      selectOrganizationId: org.id,
      selectOrganizationName: org.name,
    });
  };

  return (
    <AccueilProScreenLayout
      backLabel={t('accueilpro.back')}
      onBack={() => navigation.goBack()}
      headerIcon={<Text style={{ fontSize: 22 }}>🏢</Text>}
      headerTitle={t('accueilpro.orgs.title')}
      headerSubtitle={t('accueilpro.orgs.subtitleCount', { n: String(rows.length) })}
      headerRightLabel={t('accueilpro.orgs.add')}
      onHeaderRight={() => navigation.navigate('AccueilProOrganizationEdit', {})}
      loading={loading}
      scroll={false}
    >
      <FlatList
        data={rows}
        keyExtractor={i => i.id}
        contentContainerStyle={[apStyles.list, { paddingBottom: 48 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load().finally(() => setRefreshing(false));
            }}
            tintColor={AccueilProColors.primary}
          />
        }
        ListEmptyComponent={<AccueilProEmpty message={t('accueilpro.orgs.empty')} />}
        renderItem={({ item }) => (
          <View style={{ marginBottom: Spacing.sm }}>
            <AccueilProListRow
              title={item.name}
              meta={[item.type, item.city, item.email, item.status].filter(Boolean).join(' · ')}
              onPress={() => navigation.navigate('AccueilProOrganizationEdit', { id: item.id })}
            />
            <AccueilProLinkButton
              label={t('accueilpro.orgs.createEvent')}
              onPress={() => openCreateEvent(item)}
              style={{ marginLeft: Spacing.md, marginTop: 4 }}
            />
          </View>
        )}
      />
    </AccueilProScreenLayout>
  );
}

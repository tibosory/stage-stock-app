import React, { useCallback, useState } from 'react';
import { Text, FlatList, RefreshControl, View } from 'react-native';
import { Spacing } from '../../theme/spacing';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { ContactActionRow } from '../../components/accueilpro/ContactActionRow';
import {
  AccueilProEmpty,
  AccueilProListRow,
  AccueilProScreenLayout,
  AccueilProColors,
  apStyles,
} from '../../components/accueilpro/AccueilProUI';
import { useLanguage } from '../../context/LanguageContext';
import { listApPersonnel } from '../../db/accueilProDb';
import {
  isPersonnelPermanent,
  partitionPersonnelForDirectory,
  personnelDisplayName,
} from '../../lib/accueilProPersonnelHelpers';
import type { ApPersonnel, ApPersonnelKind } from '../../types/accueilPro';

export default function AccueilProPersonnelScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { t } = useLanguage();
  const kindParam = (route.params?.kind as ApPersonnelKind | 'association' | undefined) ?? 'lieu';
  const filterKind: ApPersonnelKind =
    kindParam === 'association' ? 'organisation' : (kindParam as ApPersonnelKind);
  const venueId = route.params?.venueId as string | undefined;
  const organizationId = route.params?.organizationId as string | undefined;
  const [rows, setRows] = useState<ApPersonnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const list = await listApPersonnel({ kind: filterKind, venueId, organizationId });
    const { permanent, others } = partitionPersonnelForDirectory(list);
    setRows([...permanent, ...others]);
  }, [filterKind, venueId, organizationId]);

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

  const title =
    filterKind === 'lieu' ? t('accueilpro.personnel.venueTitle') : t('accueilpro.personnel.orgTitle');

  return (
    <AccueilProScreenLayout
      backLabel={t('accueilpro.back')}
      onBack={() => navigation.goBack()}
      headerIcon={<Text style={{ fontSize: 22 }}>👤</Text>}
      headerTitle={title}
      headerRightLabel={t('accueilpro.orgs.add')}
      onHeaderRight={() =>
        navigation.navigate('AccueilProPersonnelEdit', {
        kind:
          filterKind === 'organisation' ? 'association'
          : filterKind === 'externe' ? 'externe'
          : 'lieu',
          venueId,
          organizationId,
        })
      }
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
            onRefresh={() => void onRefresh()}
            tintColor={AccueilProColors.primary}
          />
        }
        ListEmptyComponent={<AccueilProEmpty message={t('accueilpro.personnel.empty')} />}
        ListHeaderComponent={
          rows.some(isPersonnelPermanent) ?
            <Text style={[apStyles.hint, { marginBottom: Spacing.sm }]}>{t('accueilpro.personnel.permanentHint')}</Text>
          : null
        }
        renderItem={({ item, index }) => {
          const permanent = isPersonnelPermanent(item);
          const showOthersHeader =
            index > 0 && permanent !== isPersonnelPermanent(rows[index - 1]!) && !permanent;
          return (
            <View>
              {showOthersHeader ?
                <Text style={[apStyles.sectionTitle, { marginTop: Spacing.md, marginBottom: Spacing.xs }]}>
                  {t('accueilpro.contacts.sectionOthers')}
                </Text>
              : index === 0 && permanent ?
                <Text style={[apStyles.sectionTitle, { marginBottom: Spacing.xs, color: AccueilProColors.gold }]}>
                  {t('accueilpro.contacts.sectionPermanent')}
                </Text>
              : null}
              <AccueilProListRow
                title={personnelDisplayName(item)}
                meta={
                  [
                    permanent ? t('accueilpro.contacts.permanentBadge') : null,
                    item.role,
                    item.mission,
                  ]
                    .filter(Boolean)
                    .join(' · ') || '—'
                }
                variant={permanent ? 'permanentStaff' : 'default'}
                onPress={() =>
                  navigation.navigate('AccueilProPersonnelEdit', {
                    id: item.id,
                    kind: item.kind === 'organisation' ? 'association' : item.kind,
                    venueId: item.venue_id,
                    organizationId: item.organization_id,
                  })
                }
                rightAccessory={<ContactActionRow phone={item.phone} email={item.email} />}
              />
            </View>
          );
        }}
      />
    </AccueilProScreenLayout>
  );
}

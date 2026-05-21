import React, { useCallback, useState } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  AccueilProScreenLayout,
  AccueilProSectionCard,
  AccueilProColors,
} from '../../components/accueilpro/AccueilProUI';
import { useLanguage } from '../../context/LanguageContext';
import {
  listAccueilProConflicts,
  resolveAccueilProConflict,
  type AccueilProSyncConflict,
} from '../../lib/accueilProMerge';

function entityLabel(entity: string, t: (k: string) => string): string {
  const map: Record<string, string> = {
    venues: t('accueilpro.nav.venues'),
    events: t('accueilpro.nav.events'),
    organizations: t('accueilpro.nav.organizations'),
    room_inspections: t('accueilpro.nav.inspections'),
    team_members: t('accueilpro.nav.team'),
    rental_requests: t('accueilpro.nav.requests'),
    conventions: t('accueilpro.nav.conventions'),
    day_plan_items: t('accueilpro.nav.dayPlan'),
    day_notes: t('accueilpro.feuille.notes'),
  };
  return map[entity] ?? entity;
}

export default function AccueilProConflictsScreen() {
  const navigation = useNavigation<any>();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AccueilProSyncConflict[]>([]);

  const load = useCallback(async () => {
    setRows(await listAccueilProConflicts());
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load().finally(() => setLoading(false));
    }, [load])
  );

  const resolve = (conflict: AccueilProSyncConflict, choice: 'local' | 'remote') => {
    Alert.alert(
      t('accueilpro.conflicts.resolveTitle'),
      choice === 'local' ? t('accueilpro.conflicts.keepLocalConfirm') : t('accueilpro.conflicts.keepRemoteConfirm'),
      [
        { text: t('accueilpro.cancel'), style: 'cancel' },
        {
          text: t('accueilpro.confirm'),
          onPress: () => {
            void resolveAccueilProConflict(conflict, choice)
              .then(() => load())
              .catch(e => Alert.alert(t('accueilpro.sync.errorTitle'), e instanceof Error ? e.message : String(e)));
          },
        },
      ]
    );
  };

  return (
    <AccueilProScreenLayout
      backLabel={t('accueilpro.back')}
      onBack={() => navigation.goBack()}
      headerIcon={<Text style={{ fontSize: 22 }}>⚠</Text>}
      headerTitle={t('accueilpro.conflicts.title')}
      headerSubtitle={t('accueilpro.conflicts.subtitle')}
      loading={loading}
    >
      {rows.length === 0 ?
        <AccueilProSectionCard title={t('accueilpro.conflicts.emptyTitle')}>
          <Text style={{ color: AccueilProColors.textMuted, lineHeight: 20 }}>{t('accueilpro.conflicts.emptyBody')}</Text>
        </AccueilProSectionCard>
      : rows.map(c => (
          <AccueilProSectionCard key={c.id} title={`${entityLabel(c.entity, t)} · ${c.label}`}>
            <Text style={{ color: AccueilProColors.textMuted, marginBottom: 12, fontSize: 13 }}>
              {t('accueilpro.conflicts.meta', {
                local: c.local_updated_at?.slice(0, 16) ?? '—',
                remote: c.remote_updated_at?.slice(0, 16) ?? '—',
              })}
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  minHeight: 48,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: AccueilProColors.gold,
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 10,
                }}
                onPress={() => resolve(c, 'local')}
              >
                <Text style={{ fontWeight: '700', color: AccueilProColors.navy }}>{t('accueilpro.conflicts.keepLocal')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  minHeight: 48,
                  borderRadius: 10,
                  backgroundColor: AccueilProColors.navy,
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 10,
                }}
                onPress={() => resolve(c, 'remote')}
              >
                <Text style={{ fontWeight: '700', color: '#fff' }}>{t('accueilpro.conflicts.keepRemote')}</Text>
              </TouchableOpacity>
            </View>
          </AccueilProSectionCard>
        ))
      }
    </AccueilProScreenLayout>
  );
}

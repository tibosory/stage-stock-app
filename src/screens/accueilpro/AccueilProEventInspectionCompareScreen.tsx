import React, { useCallback, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import {
  AccueilProFormCard,
  AccueilProLinkButton,
  AccueilProScreenLayout,
  AccueilProColors,
  apStyles,
} from '../../components/accueilpro/AccueilProUI';
import { useLanguage } from '../../context/LanguageContext';
import { findApRoomInspection, getApEvent, resolveSpacesForEvent } from '../../db/accueilProDb';
import {
  compareInspectionsForSpace,
  countCompareIssues,
  type SpaceInspectionCompare,
} from '../../lib/accueilProInspectionCompare';

function valLabel(v?: string): string {
  if (!v) return '—';
  return v;
}

function CompareTable({ block, t }: { block: SpaceInspectionCompare; t: (k: string) => string }) {
  const issues = countCompareIssues(block);
  return (
    <AccueilProFormCard style={{ marginBottom: 14 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text style={apStyles.rowTitle}>{block.space.name}</Text>
        {issues > 0 ?
          <Text style={{ color: AccueilProColors.statusAnnule, fontWeight: '700', fontSize: 12 }}>
            {t('accueilpro.edlCompare.issues', { count: String(issues) })}
          </Text>
        : null}
      </View>
      {!block.entry && !block.exit ?
        <Text style={apStyles.hint}>{t('accueilpro.edlCompare.noData')}</Text>
      : (
        <View>
          <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: AccueilProColors.borderSubtle, paddingBottom: 6 }}>
            <Text style={{ flex: 2, fontSize: 11, fontWeight: '700', color: AccueilProColors.textMuted }}>
              {t('accueilpro.edlCompare.colCheck')}
            </Text>
            <Text style={{ flex: 1, fontSize: 11, fontWeight: '700', color: AccueilProColors.textMuted }}>
              {t('accueilpro.inspection.entry')}
            </Text>
            <Text style={{ flex: 1, fontSize: 11, fontWeight: '700', color: AccueilProColors.textMuted }}>
              {t('accueilpro.inspection.exit')}
            </Text>
          </View>
          {block.rows.map(row => (
            <View
              key={row.checkId}
              style={{
                flexDirection: 'row',
                paddingVertical: 8,
                borderBottomWidth: 1,
                borderBottomColor: AccueilProColors.borderSubtle,
                backgroundColor: row.worsened ? 'rgba(181,74,69,0.08)' : row.changed ? 'rgba(200,151,58,0.08)' : 'transparent',
              }}
            >
              <Text style={{ flex: 2, fontSize: 13 }}>{row.label}</Text>
              <Text style={{ flex: 1, fontSize: 13, fontWeight: '600' }}>{valLabel(row.entry)}</Text>
              <Text style={{ flex: 1, fontSize: 13, fontWeight: '600' }}>{valLabel(row.exit)}</Text>
            </View>
          ))}
        </View>
      )}
    </AccueilProFormCard>
  );
}

export default function AccueilProEventInspectionCompareScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { t } = useLanguage();
  const eventId = route.params?.eventId as string;
  const [eventName, setEventName] = useState('');
  const [blocks, setBlocks] = useState<SpaceInspectionCompare[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const ev = await getApEvent(eventId);
    setEventName(ev?.name ?? '');
    if (!ev) {
      setBlocks([]);
      return;
    }
    const spaces = await resolveSpacesForEvent(ev);
    const compared: SpaceInspectionCompare[] = [];
    for (const sp of spaces) {
      const [entry, exit] = await Promise.all([
        findApRoomInspection(eventId, sp.id, 'entrée'),
        findApRoomInspection(eventId, sp.id, 'sortie'),
      ]);
      compared.push(compareInspectionsForSpace(sp, entry, exit));
    }
    setBlocks(compared);
  }, [eventId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load().finally(() => setLoading(false));
    }, [load])
  );

  return (
    <AccueilProScreenLayout
      backLabel={t('accueilpro.back')}
      onBack={() => navigation.goBack()}
      headerIcon={<Text style={{ fontSize: 22 }}>📋</Text>}
      headerTitle={t('accueilpro.edlCompare.title')}
      headerSubtitle={eventName}
      loading={loading}
      scroll={false}
    >
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <Text style={[apStyles.hint, { marginBottom: 12 }]}>{t('accueilpro.edlCompare.hint')}</Text>
        {blocks.map(block => (
          <View key={block.space.id}>
            <CompareTable block={block} t={t} />
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <AccueilProLinkButton
                label={t('accueilpro.edlCompare.openEntry')}
                onPress={() =>
                  navigation.navigate('AccueilProInspectionEdit', {
                    eventId,
                    spaceId: block.space.id,
                    type: 'entrée',
                    id: block.entry?.id,
                  })
                }
              />
              <AccueilProLinkButton
                label={t('accueilpro.edlCompare.openExit')}
                onPress={() =>
                  navigation.navigate('AccueilProInspectionEdit', {
                    eventId,
                    spaceId: block.space.id,
                    type: 'sortie',
                    id: block.exit?.id,
                  })
                }
              />
            </View>
          </View>
        ))}
        {blocks.length === 0 ?
          <Text style={apStyles.empty}>{t('accueilpro.edlCompare.noSpaces')}</Text>
        : null}
      </ScrollView>
    </AccueilProScreenLayout>
  );
}

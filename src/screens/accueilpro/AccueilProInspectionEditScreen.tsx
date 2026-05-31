import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, TouchableOpacity, Alert, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AccueilProFormCard, AccueilProInput } from '../../components/accueilpro/AccueilProUI';
import {
  AccueilProChip,
  AccueilProColors,
  AccueilProPrimaryButton,
  AccueilProScreenLayout,
  apStyles,
} from '../../components/accueilpro/AccueilProUI';
import { useLanguage } from '../../context/LanguageContext';
import { findApRoomInspection, getApRoomInspection, getApSpace } from '../../db/accueilProDb';
import { saveInspectionWithPhotoUpload } from '../../lib/accueilProPhotoUpload';
import type { ApInspectionStatus, ApInspectionType, ApSpace } from '../../types/accueilPro';
import {
  parsePhotosJson,
  parseVerificationsJson,
  resolveInspectionChecksForSpace,
  serializePhotos,
  serializeVerifications,
  type InspectionVerifications,
  type RoomInspectionCheckDefinition,
} from '../../modules/accueilpro/constants/inspectionChecklist';
import { InspectionPhotoPicker } from '../../components/accueilpro/InspectionPhotoPicker';

function ChecklistSection({
  title,
  items,
  checks,
  onSetCheck,
}: {
  title: string;
  items: RoomInspectionCheckDefinition[];
  checks: InspectionVerifications;
  onSetCheck: (id: string, v: 'ok' | 'ko' | 'na') => void;
}) {
  if (items.length === 0) return null;
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={[apStyles.sectionTitle, { marginTop: 8 }]}>{title}</Text>
      {items.map(item => (
        <View key={item.id} style={apStyles.checkRow}>
          <View style={{ flex: 1 }}>
            <Text style={apStyles.checkLabel}>{item.label}</Text>
            {item.description ? <Text style={apStyles.checkSub}>{item.description}</Text> : null}
          </View>
          <View style={apStyles.tri}>
            {(['ok', 'ko', 'na'] as const).map(v => {
              const active = checks[item.id] === v;
              const activeStyle =
                v === 'ok' ? { bg: AccueilProColors.statusConfirme, border: '#6BCF9A' }
                : v === 'ko' ? { bg: AccueilProColors.statusAnnule, border: '#E88A86' }
                : { bg: '#6B7280', border: '#A8A8AE' };
              return (
              <TouchableOpacity
                key={v}
                style={[
                  apStyles.triBtn,
                  active ?
                    {
                      borderColor: activeStyle.border,
                      backgroundColor: activeStyle.bg,
                      borderWidth: 2,
                    }
                  : null,
                ]}
                onPress={() => onSetCheck(item.id, v)}
              >
                <Text style={active ? apStyles.triTextOn : apStyles.triText}>{v.toUpperCase()}</Text>
              </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

export default function AccueilProInspectionEditScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { t } = useLanguage();
  const eventId = route.params?.eventId as string;
  const spaceId = route.params?.spaceId as string;
  const type = route.params?.type as ApInspectionType;
  const inspectionId = route.params?.id as string | undefined;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [space, setSpace] = useState<ApSpace | null>(null);
  const [status, setStatus] = useState<ApInspectionStatus>('en cours');
  const [repLieu, setRepLieu] = useState('');
  const [repOrga, setRepOrga] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [checks, setChecks] = useState<InspectionVerifications>({});
  const [photos, setPhotos] = useState<string[]>([]);
  const [loadedInspId, setLoadedInspId] = useState<string | undefined>();

  useEffect(() => {
    void (async () => {
      const sp = spaceId ? await getApSpace(spaceId) : null;
      setSpace(sp);
      const insp = inspectionId
        ? await getApRoomInspection(inspectionId)
        : eventId && spaceId && type
          ? await findApRoomInspection(eventId, spaceId, type)
          : null;
      if (insp) {
        setLoadedInspId(insp.id);
        setStatus(insp.status);
        setRepLieu(insp.representant_lieu ?? '');
        setRepOrga(insp.representant_orga ?? '');
        setCommentaire(insp.commentaire ?? '');
        setChecks(parseVerificationsJson(insp.verifications));
        setPhotos(parsePhotosJson(insp.photos));
      }
      setLoading(false);
    })();
  }, [eventId, spaceId, type, inspectionId]);

  const checklist = useMemo(() => resolveInspectionChecksForSpace(space), [space]);
  const controlItems = useMemo(() => checklist.filter(c => c.kind !== 'vigilance'), [checklist]);
  const vigilanceItems = useMemo(() => checklist.filter(c => c.kind === 'vigilance'), [checklist]);
  const legacyItems = useMemo(() => {
    const ids = new Set(checklist.map(c => c.id));
    return Object.keys(checks)
      .filter(id => !ids.has(id))
      .map(id => ({ id, label: id.replace(/_/g, ' '), description: '', kind: 'control' as const }));
  }, [checklist, checks]);

  const setCheck = (id: string, v: 'ok' | 'ko' | 'na') => {
    setChecks(prev => ({ ...prev, [id]: v }));
  };

  const onSave = useCallback(async () => {
    if (!eventId || !spaceId || !type) {
      Alert.alert(t('accueilpro.orgs.errTitle'), t('accueilpro.inspection.errContext'));
      return;
    }
    setSaving(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const result = await saveInspectionWithPhotoUpload(
        {
          id: inspectionId ?? loadedInspId,
          event_id: eventId,
          space_id: spaceId,
          type,
          status,
          inspection_date: today,
          representant_lieu: repLieu.trim() || null,
          representant_orga: repOrga.trim() || null,
          verifications: serializeVerifications(checks),
          commentaire: commentaire.trim() || null,
          photos: photos.length > 0 ? serializePhotos(photos) : null,
        },
        photos
      );
      if (result.uploadError) {
        Alert.alert(t('accueilpro.inspection.uploadWarnTitle'), t('accueilpro.inspection.uploadWarnBody'));
      }
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  }, [
    inspectionId,
    loadedInspId,
    eventId,
    spaceId,
    type,
    status,
    repLieu,
    repOrga,
    checks,
    commentaire,
    photos,
    navigation,
    t,
  ]);

  const typeLabel = type === 'entrée' ? t('accueilpro.inspection.entry') : t('accueilpro.inspection.exit');
  const spaceName = space?.name ?? '—';
  const usesCustom = (space?.control_points?.length ?? 0) > 0;

  return (
    <AccueilProScreenLayout
      backLabel={t('accueilpro.back')}
      onBack={() => navigation.goBack()}
      headerIcon={<Text style={{ fontSize: 22 }}>✅</Text>}
      headerTitle={`${typeLabel} · ${spaceName}`}
      headerSubtitle={usesCustom ? t('accueilpro.inspection.customChecklist') : t('accueilpro.inspection.standardChecklist')}
      loading={loading}
      footer={
        <AccueilProPrimaryButton
          label={t('accueilpro.save')}
          onPress={() => void onSave()}
          loading={saving}
        />
      }
    >
      <AccueilProFormCard>
        <AccueilProInput label={t('accueilpro.inspection.repVenue')} value={repLieu} onChangeText={setRepLieu} />
        <AccueilProInput label={t('accueilpro.inspection.repOrg')} value={repOrga} onChangeText={setRepOrga} />
        <Text style={apStyles.sectionTitle}>{t('accueilpro.inspection.checks')}</Text>
        <ChecklistSection
          title={t('accueilpro.spaceChecks.sectionControl')}
          items={controlItems}
          checks={checks}
          onSetCheck={setCheck}
        />
        <ChecklistSection
          title={t('accueilpro.spaceChecks.sectionVigilance')}
          items={vigilanceItems}
          checks={checks}
          onSetCheck={setCheck}
        />
        {legacyItems.length > 0 ?
          <ChecklistSection
            title={t('accueilpro.inspection.legacyChecks')}
            items={legacyItems}
            checks={checks}
            onSetCheck={setCheck}
          />
        : null}
        <InspectionPhotoPicker photos={photos} onChange={setPhotos} />
        <AccueilProInput label={t('accueilpro.inspection.comment')} value={commentaire} onChangeText={setCommentaire} multiline />
        <Text style={apStyles.label}>{t('accueilpro.orgs.status')}</Text>
        {(['en cours', 'terminé'] as ApInspectionStatus[]).map(st => (
          <AccueilProChip key={st} label={st} selected={status === st} onPress={() => setStatus(st)} />
        ))}
      </AccueilProFormCard>
    </AccueilProScreenLayout>
  );
}

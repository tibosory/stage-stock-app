import React, { useCallback, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { AccueilProPdfPreviewModal } from './AccueilProPdfPreviewModal';
import {
  AccueilProFormCard,
  AccueilProLinkButton,
  AccueilProPrimaryButton,
  AccueilProColors,
  apStyles,
} from './AccueilProUI';
import { Spacing } from '../../theme/spacing';
import { useLanguage } from '../../context/LanguageContext';
import { openVenuePlan } from '../../lib/accueilProVenuePlanOpen';
import {
  persistVenuePlanCopy,
  removeVenuePlanLocal,
  venuePlanKindFromFilename,
} from '../../lib/accueilProVenuePlanStorage';

type Props = {
  venueId: string;
  planLocalUri: string | null;
  planFilename: string | null;
  onChange?: (next: { localUri: string | null; filename: string | null }) => void;
  readOnly?: boolean;
  onEditPress?: () => void;
};

function pickPlanAsset(pick: DocumentPicker.DocumentPickerResult): { uri: string; name: string } | null {
  if (pick.canceled) return null;
  const asset = pick.assets?.[0];
  if (!asset?.uri) return null;
  const name = asset.name?.trim() || 'plan.pdf';
  return { uri: asset.uri, name };
}

export function VenuePlanSection(props: Props) {
  const { t } = useLanguage();
  const [previewOpen, setPreviewOpen] = useState(false);
  const readOnly = props.readOnly ?? false;

  const onPick = async () => {
    if (!props.onChange) return;
    try {
      const pick = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/acad', 'application/x-acad', 'application/octet-stream'],
        copyToCacheDirectory: true,
      });
      const parsed = pickPlanAsset(pick);
      if (!parsed) return;
      if (!venuePlanKindFromFilename(parsed.name)) {
        Alert.alert(t('accueilpro.orgs.errTitle'), t('accueilpro.venues.planPickHint'));
        return;
      }
      const saved = await persistVenuePlanCopy(props.venueId, parsed.uri, parsed.name);
      if (props.planLocalUri && props.planLocalUri !== saved.localUri) {
        await removeVenuePlanLocal(props.planLocalUri);
      }
      props.onChange({ localUri: saved.localUri, filename: saved.filename });
    } catch (e: unknown) {
      Alert.alert(t('accueilpro.orgs.errTitle'), e instanceof Error ? e.message : String(e));
    }
  };

  const onRemove = async () => {
    if (!props.onChange) return;
    Alert.alert(t('accueilpro.deleteConfirmTitle'), t('accueilpro.venues.planRemoveBody'), [
      { text: t('accueilpro.cancel'), style: 'cancel' },
      {
        text: t('accueilpro.delete'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await removeVenuePlanLocal(props.planLocalUri);
            props.onChange!({ localUri: null, filename: null });
          })();
        },
      },
    ]);
  };

  const onView = useCallback(() => {
    if (!props.planLocalUri || !props.planFilename) {
      Alert.alert(t('accueilpro.venues.planTitle'), t('accueilpro.venues.planPickFirst'));
      return;
    }
    void openVenuePlan({
      localUri: props.planLocalUri,
      filename: props.planFilename,
      onOpenPdfPreview: () => setPreviewOpen(true),
      t,
    });
  }, [props.planFilename, props.planLocalUri, t]);

  const kind = venuePlanKindFromFilename(props.planFilename);
  const kindLabel =
    kind === 'pdf' ? 'PDF'
    : kind === 'dwg' ? 'DWG'
    : null;

  return (
    <>
      <AccueilProFormCard style={{ marginBottom: 14 }}>
        <Text style={apStyles.sectionTitle}>{t('accueilpro.venues.planTitle')}</Text>
        <Text style={[apStyles.hint, { marginBottom: Spacing.sm }]}>{t('accueilpro.venues.planHint')}</Text>

        {props.planFilename ?
          <View style={{ gap: 8 }}>
            <Text style={{ fontWeight: '700', color: AccueilProColors.navy }}>{props.planFilename}</Text>
            {kindLabel ?
              <Text style={{ fontSize: 12, color: AccueilProColors.textMuted, fontWeight: '600' }}>{kindLabel}</Text>
            : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <AccueilProLinkButton label={t('accueilpro.venues.planView')} onPress={onView} />
              {!readOnly && props.onChange ?
                <>
                  <AccueilProLinkButton label={t('accueilpro.venues.planReplace')} onPress={() => void onPick()} />
                  <AccueilProLinkButton label={t('accueilpro.venues.planRemove')} onPress={() => void onRemove()} />
                </>
              : null}
              {readOnly && props.onEditPress ?
                <AccueilProLinkButton label={t('accueilpro.edit')} onPress={props.onEditPress} />
              : null}
            </View>
            {kind === 'dwg' ?
              <Text style={[apStyles.hint, { marginTop: 4 }]}>{t('accueilpro.venues.planDwgHint')}</Text>
            : null}
          </View>
        : readOnly ?
          <Text style={apStyles.empty}>{t('accueilpro.venues.planEmpty')}</Text>
        : props.onChange ?
          <AccueilProPrimaryButton label={t('accueilpro.venues.planPick')} onPress={() => void onPick()} />
        : null}
      </AccueilProFormCard>

      <AccueilProPdfPreviewModal
        visible={previewOpen}
        title={props.planFilename ?? t('accueilpro.venues.planTitle')}
        uri={props.planLocalUri}
        onClose={() => setPreviewOpen(false)}
      />
    </>
  );
}

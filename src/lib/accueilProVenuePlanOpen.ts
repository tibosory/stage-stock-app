import { Alert, Linking } from 'react-native';
import * as Sharing from 'expo-sharing';
import {
  venuePlanFileExists,
  venuePlanKindFromFilename,
  venuePlanMimeType,
} from './accueilProVenuePlanStorage';

type OpenVenuePlanOpts = {
  localUri: string;
  filename: string;
  onOpenPdfPreview: () => void;
  t: (key: string) => string;
};

/** PDF → aperçu in-app ; DWG → ouverture via une app externe (AutoCAD, etc.). */
export async function openVenuePlan(opts: OpenVenuePlanOpts): Promise<void> {
  const { localUri, filename, onOpenPdfPreview, t } = opts;
  if (!(await venuePlanFileExists(localUri))) {
    Alert.alert(t('accueilpro.venues.planTitle'), t('accueilpro.venues.planMissing'));
    return;
  }

  const kind = venuePlanKindFromFilename(filename);
  if (kind === 'pdf') {
    onOpenPdfPreview();
    return;
  }

  if (kind === 'dwg') {
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(localUri, {
          mimeType: venuePlanMimeType('dwg'),
          dialogTitle: filename,
          UTI: 'com.autodesk.dwg',
        });
        return;
      }
      const ok = await Linking.canOpenURL(localUri);
      if (!ok) throw new Error(t('accueilpro.venues.planOpenFail'));
      await Linking.openURL(localUri);
    } catch (e: unknown) {
      Alert.alert(t('accueilpro.venues.planOpenFail'), e instanceof Error ? e.message : String(e));
    }
    return;
  }

  Alert.alert(t('accueilpro.venues.planTitle'), t('accueilpro.venues.planUnsupported'));
}

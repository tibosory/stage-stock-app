import * as FileSystem from 'expo-file-system/legacy';
import { buildLocalPdfPreviewHtml } from './localPdfPreviewHtml';

export { buildLocalPdfPreviewHtml } from './localPdfPreviewHtml';

export async function loadLocalPdfPreviewHtml(uri: string): Promise<string> {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) {
    throw new Error('PDF_NOT_FOUND');
  }
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  if (!base64.trim()) {
    throw new Error('PDF_EMPTY');
  }
  return buildLocalPdfPreviewHtml(base64);
}

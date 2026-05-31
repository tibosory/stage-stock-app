import * as FileSystem from 'expo-file-system/legacy';

/** HTML inline pour afficher un PDF local dans une WebView (Android bloque file://). */
export function buildLocalPdfPreviewHtml(base64: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=4.0, user-scalable=yes" />
  <style>
    html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; background: #525659; }
    embed { width: 100%; height: 100%; border: 0; }
  </style>
</head>
<body>
  <embed src="data:application/pdf;base64,${base64}" type="application/pdf" />
</body>
</html>`;
}

export async function loadLocalPdfPreviewHtml(uri: string): Promise<string> {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) {
    throw new Error('PDF_NOT_FOUND');
  }
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return buildLocalPdfPreviewHtml(base64);
}

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Materiel } from '../types';
import { qrCodeImgTagForHtml } from './qrHtml';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function exportEtiquetteMaterielPdf(mat: Materiel): Promise<void> {
  const code = mat.qr_code?.trim() || mat.id;
  const qrTag = qrCodeImgTagForHtml(code);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: 85mm 54mm; margin: 4mm; }
    body { font-family: Helvetica, Arial, sans-serif; margin: 0; padding: 8px; color: #111; }
    .wrap { border: 2px solid #111; border-radius: 6px; padding: 10px; text-align: center; }
    h1 { font-size: 14px; margin: 0 0 6px 0; }
    .meta { font-size: 10px; color: #333; margin-bottom: 6px; }
    .code { font-size: 9px; word-break: break-all; margin-top: 6px; }
    img { max-width: 42mm; height: auto; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>${esc(mat.nom)}</h1>
    <div class="meta">${esc([mat.marque, mat.type].filter(Boolean).join(' · '))}</div>
    ${qrTag}
    <div class="code">${esc(code)}</div>
  </div>
</body>
</html>`;

  const { uri } = await Print.printToFileAsync({ html, base64: false });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Étiquette matériel' });
}

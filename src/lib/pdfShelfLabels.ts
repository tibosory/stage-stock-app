import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { getBulkTileSpec, type EtiquetteFormatId } from './pdfEtiquette';
import { buildPdfOrgHeaderHtml, getPdfBranding } from './theatreBranding';

export type ShelfLabelRow = {
  text: string;
  subtitle?: string;
  format: EtiquetteFormatId;
};

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function labelHtml(row: ShelfLabelRow): string {
  const spec = getBulkTileSpec(row.format);
  const padMm = Math.min(3, Math.max(1, spec.margin));
  const subtitle = row.subtitle?.trim()
    ? `<div class="label-sub" style="font-size: ${spec.snPt}px;">${esc(row.subtitle.trim())}</div>`
    : '';
  return `
  <div class="label" style="width: ${spec.boxWmm}mm; min-height: ${spec.boxHmm}mm; padding: ${padMm}mm;">
    <div class="label-main" style="font-size: ${spec.namePt}px;">${esc(row.text)}</div>
    ${subtitle}
  </div>`;
}

function buildHtml(rows: ShelfLabelRow[], orgHeader: string): string {
  const blocks = rows.map(labelHtml).join('\n');
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: A4 portrait; margin: 6mm; }
    * { box-sizing: border-box; }
    body {
      font-family: "Inter", "Segoe UI", Arial, sans-serif;
      color: #111827;
      margin: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .sheet-title {
      margin: 0 0 8px 0;
      font-size: 14px;
      font-weight: 700;
      color: #111827;
      letter-spacing: .2px;
    }
    .labels {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      align-content: flex-start;
      gap: 4mm;
    }
    .label {
      border: 1.4px solid #374151;
      border-radius: 2mm;
      background: #fff;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .label-main {
      font-weight: 800;
      letter-spacing: .3px;
      color: #111827;
      word-break: break-word;
      line-height: 1.15;
    }
    .label-sub {
      margin-top: 1.5mm;
      color: #374151;
      font-weight: 600;
      line-height: 1.2;
      word-break: break-word;
    }
    @media print {
      .label { box-shadow: none; }
    }
  </style>
</head>
<body>
  ${orgHeader}
  <h1 class="sheet-title">Étiquettes de rayonnage / bacs</h1>
  <div class="labels">
    ${blocks}
  </div>
</body>
</html>`;
}

export async function exportShelfLabelsPdf(rows: ShelfLabelRow[]): Promise<void> {
  if (!rows.length) return;
  const branding = await getPdfBranding();
  const orgHeader = buildPdfOrgHeaderHtml(branding);
  const html = buildHtml(rows, orgHeader);
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Étiquettes rayonnage (${rows.length})`,
    });
  }
}

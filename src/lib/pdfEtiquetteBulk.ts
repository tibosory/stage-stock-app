import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Materiel } from '../types';
import { qrCodeImgTagForHtml } from './qrHtml';
import { getPdfBranding, type PdfBranding } from './theatreBranding';
import { getBulkTileSpec, type EtiquetteFormatId } from './pdfEtiquette';

export type BulkPaperSize = 'A4' | 'A3';

/** `flex` : flux avec sauts naturels. `grid_strict` : grille fixe, une page = N emplacements, pas d’étiquette à cheval. */
export type BulkLayoutMode = 'flex' | 'grid_strict';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}


/** Zone imprimable utile (mm), marges @page 10 mm de chaque côté. */
function printableInnerMm(paper: BulkPaperSize): { w: number; h: number } {
  return paper === 'A3' ? { w: 277, h: 400 } : { w: 190, h: 277 };
}

function buildOrgHeaderHtml(brand: PdfBranding): { html: string; reserveMm: number } {
  const orgLine = [brand.theatreName?.trim(), brand.theatreAddress?.trim()]
    .filter(Boolean)
    .join(' — ');
  if (!orgLine) return { html: '', reserveMm: 0 };
  return {
    html: `<div class="doc-head">${esc(orgLine)}</div>`,
    reserveMm: 12,
  };
}

function buildTileHtml(m: Materiel, format: EtiquetteFormatId): string {
  const spec = getBulkTileSpec(format);
  const code = m.qr_code?.trim() || m.id;
  const qrTag = qrCodeImgTagForHtml(code, spec.cell, spec.margin);
  const sn = m.numero_serie?.trim() ? m.numero_serie : '—';
  return `
  <div class="tile" style="width:${spec.boxWmm}mm;min-height:${spec.boxHmm}mm;">
    <div class="tile-inner">
      <div class="qrbox" style="max-width:${spec.imgMaxMm}mm;">
        ${qrTag}
      </div>
      <div class="name" style="font-size:${spec.namePt}pt;">${esc(m.nom)}</div>
      <div class="sn" style="font-size:${spec.snPt}pt;">S/N ${esc(sn)}</div>
    </div>
  </div>`;
}

const TILE_STYLES = `
    .tile {
      break-inside: avoid;
      page-break-inside: avoid;
      -webkit-column-break-inside: avoid;
      display: block;
      border: 0.3mm solid #374151;
      border-radius: 1.5mm;
      padding: 2mm;
      background: #fff;
    }
    .tile-inner {
      text-align: center;
      width: 100%;
    }
    .qrbox {
      margin: 0 auto 1.5mm auto;
    }
    .qrbox img {
      display: block;
      margin: 0 auto;
      max-width: 100% !important;
      width: auto !important;
      height: auto !important;
    }
    .name {
      font-weight: 700;
      line-height: 1.15;
      word-break: break-word;
      hyphens: auto;
      margin-top: 0.5mm;
      letter-spacing: .1px;
    }
    .sn {
      color: #374151;
      line-height: 1.1;
      margin-top: 0.8mm;
      word-break: break-all;
    }
`;

function buildBulkQrHtmlFlex(
  items: { materiel: Materiel; format: EtiquetteFormatId }[],
  paper: BulkPaperSize,
  brand: PdfBranding
): string {
  const pageDecl = paper === 'A3' ? 'A3 portrait' : 'A4 portrait';
  const { html: headerBlock } = buildOrgHeaderHtml(brand);
  const bodyTiles = items.map(({ materiel, format }) => buildTileHtml(materiel, format)).join('\n');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: ${pageDecl}; margin: 10mm; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      font-family: "Inter", "Segoe UI", Arial, sans-serif;
      color: #111;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .doc-head {
      font-size: 9pt;
      color: #374151;
      margin-bottom: 4mm;
      padding-bottom: 2mm;
      border-bottom: 0.2mm solid #6b7280;
      width: 100%;
      break-after: avoid;
      page-break-after: avoid;
    }
    .tiles {
      display: flex;
      flex-wrap: wrap;
      gap: 3mm;
      align-content: flex-start;
      align-items: flex-start;
    }
    ${TILE_STYLES}
    @media print {
      .tile { break-inside: avoid; page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  ${headerBlock}
  <div class="tiles">
    ${bodyTiles}
  </div>
</body>
</html>`;
}

function computeGridPages(
  items: { materiel: Materiel; format: EtiquetteFormatId }[],
  paper: BulkPaperSize,
  headReserveMm: number
): {
  pages: { materiel: Materiel; format: EtiquetteFormatId }[][];
  cols: number;
  maxW: number;
  maxH: number;
  gap: number;
} {
  const gap = 3;
  const { w: contentW, h: contentH } = printableInnerMm(paper);
  const maxW = Math.max(...items.map(i => getBulkTileSpec(i.format).boxWmm));
  const maxH = Math.max(...items.map(i => getBulkTileSpec(i.format).boxHmm));
  const cols = Math.max(1, Math.floor((contentW + gap) / (maxW + gap)));
  const hFirst = Math.max(0, contentH - headReserveMm);
  const rowsFirst = Math.max(1, Math.floor((hFirst + gap) / (maxH + gap)));
  const rowsRest = Math.max(1, Math.floor((contentH + gap) / (maxH + gap)));
  const perFirst = cols * rowsFirst;
  const perRest = cols * rowsRest;

  const pages: { materiel: Materiel; format: EtiquetteFormatId }[][] = [];
  let i = 0;
  let first = true;
  while (i < items.length) {
    const take = first ? perFirst : perRest;
    pages.push(items.slice(i, i + take));
    i += take;
    first = false;
  }

  return { pages, cols, maxW, maxH, gap };
}

function buildBulkQrHtmlGridStrict(
  items: { materiel: Materiel; format: EtiquetteFormatId }[],
  paper: BulkPaperSize,
  brand: PdfBranding
): string {
  const pageDecl = paper === 'A3' ? 'A3 portrait' : 'A4 portrait';
  const { html: headerBlock, reserveMm: headReserveMm } = buildOrgHeaderHtml(brand);
  const { pages, cols, maxW, maxH, gap } = computeGridPages(items, paper, headReserveMm);

  const sheetsHtml = pages
    .map((pageItems, pageIndex) => {
      const head = pageIndex === 0 ? headerBlock : '';
      const cells = pageItems
        .map(
          ({ materiel, format }) =>
            `<div class="cell">${buildTileHtml(materiel, format)}</div>`
        )
        .join('\n');
      return `
<section class="sheet">
  ${head}
  <div class="strict-grid" style="grid-template-columns: repeat(${cols}, ${maxW}mm); grid-auto-rows: ${maxH}mm; gap: ${gap}mm;">
    ${cells}
  </div>
</section>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: ${pageDecl}; margin: 10mm; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      font-family: "Inter", "Segoe UI", Arial, sans-serif;
      color: #111;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .doc-head {
      font-size: 9pt;
      color: #374151;
      margin-bottom: 4mm;
      padding-bottom: 2mm;
      border-bottom: 0.2mm solid #6b7280;
      width: 100%;
    }
    .sheet {
      page-break-after: always;
      break-after: page;
    }
    .sheet:last-child {
      page-break-after: auto;
      break-after: auto;
    }
    .strict-grid {
      display: grid;
      justify-content: start;
      align-content: start;
    }
    .cell {
      width: ${maxW}mm;
      height: ${maxH}mm;
      display: flex;
      align-items: center;
      justify-content: center;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .cell .tile {
      max-width: 100%;
    }
    ${TILE_STYLES}
  </style>
</head>
<body>
  ${sheetsHtml}
</body>
</html>`;
}

function buildBulkQrHtml(
  items: { materiel: Materiel; format: EtiquetteFormatId }[],
  paper: BulkPaperSize,
  brand: PdfBranding,
  layout: BulkLayoutMode
): string {
  if (layout === 'grid_strict') {
    return buildBulkQrHtmlGridStrict(items, paper, brand);
  }
  return buildBulkQrHtmlFlex(items, paper, brand);
}

export async function exportBulkQrLabelsPdf(
  items: { materiel: Materiel; format: EtiquetteFormatId }[],
  paper: BulkPaperSize,
  layout: BulkLayoutMode = 'flex'
): Promise<void> {
  if (!items.length) return;
  const brand = await getPdfBranding();
  const html = buildBulkQrHtml(items, paper, brand, layout);
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  const canShare = await Sharing.isAvailableAsync();
  const layoutLabel = layout === 'grid_strict' ? 'grille' : 'flux';
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `QR — ${items.length} étiquette(s) — ${paper} — ${layoutLabel}`,
    });
  }
}

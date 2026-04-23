import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Materiel } from '../types';
import { qrCodeImgTagForHtml } from './qrHtml';
import {
  buildPdfOrgHeaderHtml,
  buildPdfOrgMicroForLabel,
  getPdfBranding,
  type PdfBranding,
} from './theatreBranding';
import type { UserLabelFormat } from './labelUserFormatsStorage';
import type { BulkLayoutMode, BulkPaperSize } from './pdfEtiquetteBulk';

export { type UserLabelFormat } from './labelUserFormatsStorage';

export const LABEL_FONT_CHOICES: { id: string; label: string; css: string }[] = [
  { id: 'inter', label: 'Inter / System', css: '"Inter", "Segoe UI", system-ui, sans-serif' },
  { id: 'arial', label: 'Arial', css: 'Arial, Helvetica, sans-serif' },
  { id: 'georgia', label: 'Georgia', css: 'Georgia, "Times New Roman", serif' },
  { id: 'times', label: 'Times New Roman', css: '"Times New Roman", Times, serif' },
  { id: 'courier', label: 'Courier New', css: '"Courier New", Courier, monospace' },
];

export const LABEL_TEXT_COLOR_CHOICES: { id: string; label: string; hex: string }[] = [
  { id: 'noir', label: 'Noir', hex: '#111111' },
  { id: 'gris', label: 'Gris fonce', hex: '#374151' },
  { id: 'bleu', label: 'Bleu', hex: '#1D4ED8' },
  { id: 'vert', label: 'Vert', hex: '#166534' },
  { id: 'rouge', label: 'Rouge', hex: '#B91C1C' },
  { id: 'orange', label: 'Orange', hex: '#C2410C' },
  { id: 'violet', label: 'Violet', hex: '#6D28D9' },
  { id: 'marron', label: 'Marron', hex: '#78350F' },
];

export function fontCssFor(f: UserLabelFormat): string {
  const hit = LABEL_FONT_CHOICES.find(x => x.id === f.fontId);
  return hit?.css ?? LABEL_FONT_CHOICES[0].css;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function mm(n: number): string {
  const s = Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '');
  return `${s}mm`;
}

/**
 * Marge intérieure : 0 % → marge minimale fixe ; 100 % → au plus 10 % de la largeur d’étiquette.
 */
export function marginMmFromLabelPercent(
  labelWidthMm: number,
  marginPercent: number
): number {
  const w = Math.max(1, labelWidthMm);
  const p = Math.min(100, Math.max(0, marginPercent)) / 100;
  const minMargin = 0.35;
  const maxMargin = w * 0.1;
  return minMargin + (maxMargin - minMargin) * p;
}

function hexToRgba(hex: string, alpha: number): string {
  const m = hex.trim().match(/^#?([0-9a-fA-F]{6})$/);
  if (!m) return `rgba(17,17,17,${alpha})`;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function microKindForLabel(
  w: number,
  h: number
): 'petite' | 'carte_visite' | 'large' {
  const s = Math.min(w, h);
  if (s < 34) return 'petite';
  if (w >= 130 || h >= 95) return 'large';
  return 'carte_visite';
}

export type CustomBulkTileSpec = {
  cell: number;
  margin: number;
  imgMaxMm: number;
  boxWmm: number;
  boxHmm: number;
  padMm: number;
  namePt: number;
  snPt: number;
};

const MM_PER_PT = 25.4 / 72;

function ptToMm(pt: number): number {
  return pt * MM_PER_PT;
}

function estimateLineCount(text: string, fontPt: number, widthMm: number): number {
  const clean = text.trim();
  if (!clean) return 1;
  const charMm = Math.max(0.12, ptToMm(fontPt) * 0.52);
  const charsPerLine = Math.max(1, Math.floor(widthMm / charMm));
  return Math.max(1, Math.ceil(clean.length / charsPerLine));
}

function maximizeFontPt(
  minPt: number,
  maxPt: number,
  fits: (pt: number) => boolean
): number {
  let lo = minPt;
  let hi = maxPt;
  for (let i = 0; i < 16; i += 1) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  return Math.round(lo * 10) / 10;
}

function scaleFontByTextLength(
  basePt: number,
  len: number,
  innerWmm: number
): number {
  let t = basePt;
  if (len > 22) t *= 0.92;
  if (len > 40) t *= 0.9;
  if (len > 65) t *= 0.88;
  if (len > 95) t *= 0.86;
  const cap = Math.max(5, innerWmm * 0.22);
  return Math.round(Math.min(cap, Math.max(5, t)) * 10) / 10;
}

export function getCustomBulkTileSpec(
  f: UserLabelFormat,
  titleSample: string
): CustomBulkTileSpec {
  const pad = marginMmFromLabelPercent(f.widthMm, f.marginPercent);
  const innerW = Math.max(4, f.widthMm - 2 * pad);
  const innerH = Math.max(4, f.heightMm - 2 * pad);
  const minSide = Math.min(innerW, innerH);
  const qrCap = Math.min(innerW * 0.48, minSide * 0.44, 48);
  const imgMaxMm = Math.max(10, qrCap);
  const cell = Math.max(2, Math.min(8, Math.round(minSide / 8)));
  const margin = Math.max(1, Math.min(3, Math.round(cell / 2)));
  const baseName = Math.max(5, Math.min(14, innerW * 0.065));
  const namePt = scaleFontByTextLength(
    baseName,
    titleSample.length || 12,
    innerW
  );
  const snPt = Math.round(Math.max(4, namePt * 0.78) * 10) / 10;
  return {
    cell,
    margin,
    imgMaxMm,
    boxWmm: f.widthMm,
    boxHmm: f.heightMm,
    padMm: pad,
    namePt,
    snPt,
  };
}

export function buildCustomBulkTileHtml(
  m: Materiel,
  f: UserLabelFormat
): string {
  const spec = getCustomBulkTileSpec(f, m.nom ?? '');
  const code = m.qr_code?.trim() || m.id;
  const qrTag = qrCodeImgTagForHtml(code, spec.cell, spec.margin);
  const sn = m.numero_serie?.trim() ? m.numero_serie : '—';
  const font = fontCssFor(f);
  const color = esc(f.textColor);
  const fw = f.bold ? 800 : 600;
  const innerW = Math.max(4, spec.boxWmm - 2 * spec.padMm);
  const innerH = Math.max(4, spec.boxHmm - 2 * spec.padMm);
  const name = m.nom?.trim() || 'Sans nom';
  const snText = `S/N ${sn}`;
  const namePt = maximizeFontPt(5, 22, pt => {
    const nameLines = estimateLineCount(name, pt, innerW);
    const snPt = Math.max(4, pt * 0.72);
    const snLines = estimateLineCount(snText, snPt, innerW);
    const textHmm = ptToMm(pt) * 1.14 * nameLines + ptToMm(snPt) * 1.1 * snLines + 1.4;
    return spec.imgMaxMm + 2 + textHmm <= innerH;
  });
  const snPt = Math.max(4, Math.round(namePt * 0.72 * 10) / 10);
  return `
  <div class="tile" style="width:${spec.boxWmm}mm;height:${spec.boxHmm}mm;padding:${spec.padMm}mm;">
    <div class="tile-inner" style="font-family:${font};color:${color};">
      <div class="qrbox" style="max-width:${spec.imgMaxMm}mm;">
        ${qrTag}
      </div>
      <div class="name" style="font-size:${namePt}pt;font-weight:${fw};">${esc(
        m.nom
      )}</div>
      <div class="sn" style="font-size:${snPt}pt;color:${hexToRgba(
        f.textColor,
        0.88
      )};font-weight:${f.bold ? 650 : 500};">S/N ${esc(sn)}</div>
    </div>
  </div>`;
}

const CUSTOM_TILE_STYLES = `
    .tile {
      break-inside: avoid;
      page-break-inside: avoid;
      -webkit-column-break-inside: avoid;
      display: block;
      border: 0.3mm solid #374151;
      border-radius: 1.5mm;
      background: #fff;
      overflow: hidden;
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
      line-height: 1.15;
      word-break: break-word;
      hyphens: auto;
      margin-top: 0.5mm;
      letter-spacing: .12px;
    }
    .sn {
      line-height: 1.1;
      margin-top: 0.8mm;
      word-break: break-all;
    }
`;

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

function printableInnerMm(paper: BulkPaperSize): { w: number; h: number } {
  return paper === 'A3' ? { w: 277, h: 400 } : { w: 190, h: 277 };
}

function computeCustomGridPages(
  items: { materiel: Materiel; format: UserLabelFormat }[],
  paper: BulkPaperSize,
  headReserveMm: number
): {
  pages: { materiel: Materiel; format: UserLabelFormat }[][];
  cols: number;
  maxW: number;
  maxH: number;
  gap: number;
} {
  const gap = 3;
  const { w: contentW, h: contentH } = printableInnerMm(paper);
  const maxW = Math.max(...items.map(i => i.format.widthMm));
  const maxH = Math.max(...items.map(i => i.format.heightMm));
  const cols = Math.max(1, Math.floor((contentW + gap) / (maxW + gap)));
  const hFirst = Math.max(0, contentH - headReserveMm);
  const rowsFirst = Math.max(1, Math.floor((hFirst + gap) / (maxH + gap)));
  const rowsRest = Math.max(1, Math.floor((contentH + gap) / (maxH + gap)));
  const perFirst = cols * rowsFirst;
  const perRest = cols * rowsRest;

  const pages: { materiel: Materiel; format: UserLabelFormat }[][] = [];
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

function buildCustomBulkQrHtmlFlex(
  items: { materiel: Materiel; format: UserLabelFormat }[],
  paper: BulkPaperSize,
  brand: PdfBranding
): string {
  const pageDecl = paper === 'A3' ? 'A3 portrait' : 'A4 portrait';
  const { html: headerBlock } = buildOrgHeaderHtml(brand);
  const bodyTiles = items
    .map(({ materiel, format }) => buildCustomBulkTileHtml(materiel, format))
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
    ${CUSTOM_TILE_STYLES}
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

function buildCustomBulkQrHtmlGridStrict(
  items: { materiel: Materiel; format: UserLabelFormat }[],
  paper: BulkPaperSize,
  brand: PdfBranding
): string {
  const pageDecl = paper === 'A3' ? 'A3 portrait' : 'A4 portrait';
  const { html: headerBlock, reserveMm: headReserveMm } = buildOrgHeaderHtml(brand);
  const { pages, cols, maxW, maxH, gap } = computeCustomGridPages(
    items,
    paper,
    headReserveMm
  );

  const sheetsHtml = pages
    .map((pageItems, pageIndex) => {
      const head = pageIndex === 0 ? headerBlock : '';
      const cells = pageItems
        .map(
          ({ materiel, format }) =>
            `<div class="cell">${buildCustomBulkTileHtml(materiel, format)}</div>`
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
    ${CUSTOM_TILE_STYLES}
  </style>
</head>
<body>
  ${sheetsHtml}
</body>
</html>`;
}

export function buildCustomBulkQrHtml(
  items: { materiel: Materiel; format: UserLabelFormat }[],
  paper: BulkPaperSize,
  brand: PdfBranding,
  layout: BulkLayoutMode
): string {
  if (layout === 'grid_strict') {
    return buildCustomBulkQrHtmlGridStrict(items, paper, brand);
  }
  return buildCustomBulkQrHtmlFlex(items, paper, brand);
}

export function buildCustomMaterielLabelHtml(
  mat: Materiel,
  f: UserLabelFormat,
  brand: PdfBranding
): string {
  const m = marginMmFromLabelPercent(f.widthMm, f.marginPercent);
  const innerW = Math.max(2, f.widthMm - 2 * m);
  const innerH = Math.max(2, f.heightMm - 2 * m);
  const code = mat.qr_code?.trim() || mat.id;
  const microK = microKindForLabel(f.widthMm, f.heightMm);
  const micro = buildPdfOrgMicroForLabel(brand, microK);
  const minSide = Math.min(innerW, innerH);
  const imgMax = Math.min(innerW * 0.5, minSide * 0.45, 52);
  const cell = Math.max(2, Math.min(8, Math.round(minSide / 7)));
  const qMargin = Math.max(1, Math.min(3, Math.round(cell / 2)));
  const qrTag = qrCodeImgTagForHtml(code, cell, qMargin);
  const metaText = [mat.marque, mat.type].filter(Boolean).join(' · ');
  const h1Pt = maximizeFontPt(5, 26, pt => {
    const nameLines = estimateLineCount(mat.nom, pt, innerW);
    const metaPt = Math.max(4, pt * 0.72);
    const codePt = Math.max(4, pt * 0.65);
    const metaLines = estimateLineCount(metaText || ' ', metaPt, innerW);
    const codeLines = estimateLineCount(code, codePt, innerW);
    const topTextHmm =
      ptToMm(pt) * 1.12 * nameLines +
      ptToMm(metaPt) * 1.1 * metaLines +
      ptToMm(codePt) * 1.1 * codeLines +
      3;
    return topTextHmm + imgMax + 2 <= innerH;
  });
  const metaPt = Math.max(4, h1Pt * 0.72);
  const codePt = Math.max(4, h1Pt * 0.65);
  const font = fontCssFor(f);
  const color = esc(f.textColor);
  const metaColor = hexToRgba(f.textColor, 0.9);
  const codeColor = hexToRgba(f.textColor, 0.88);
  const fw = f.bold ? 800 : 600;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: ${mm(f.widthMm)} ${mm(f.heightMm)}; margin: 0; }
    body {
      font-family: ${font};
      margin: 0;
      padding: ${m}mm;
      color: ${color};
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      box-sizing: border-box;
      min-height: 100%;
    }
    .wrap {
      border: 1.1px solid #374151;
      border-radius: 1.2mm;
      padding: 1.2mm;
      text-align: center;
      background: #fff;
      box-sizing: border-box;
      min-height: ${Math.max(1, f.heightMm - 2 * m - 0.1)}mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
    }
    h1 {
      font-size: ${h1Pt}pt;
      margin: 0 0 2px 0;
      font-weight: ${fw};
      letter-spacing: .1px;
      line-height: 1.12;
      max-width: 100%;
    }
    .meta { font-size: ${metaPt}pt; color: ${metaColor}; margin-bottom: 3px; line-height: 1.1; max-width: 100%; word-break: break-word; }
    .code { font-size: ${codePt}pt; color: ${codeColor}; word-break: break-all; margin-top: 3px; max-width: 100%; }
    img { max-width: ${imgMax}mm; height: auto; }
  </style>
</head>
<body>
  ${micro}
  <div class="wrap">
    <h1>${esc(mat.nom)}</h1>
    <div class="meta">${esc([mat.marque, mat.type].filter(Boolean).join(' · '))}</div>
    ${qrTag}
    <div class="code" style="font-weight:${f.bold ? 600 : 500};">${esc(code)}</div>
  </div>
</body>
</html>`;
}

export type CustomShelfLabelRow = {
  text: string;
  subtitle?: string;
  format: UserLabelFormat;
};

function shelfBlock(row: CustomShelfLabelRow): string {
  const f = row.format;
  const pad = marginMmFromLabelPercent(f.widthMm, f.marginPercent);
  const innerW = Math.max(2, f.widthMm - 2 * pad);
  const innerH = Math.max(2, f.heightMm - 2 * pad);
  const mainLen = (row.text || '').length;
  const sub = row.subtitle?.trim();
  const subtitleAreaMm = sub ? Math.max(4, innerH * 0.24) : 0;
  const subPt = sub
    ? maximizeFontPt(4.5, 20, pt => {
        const lines = estimateLineCount(sub, pt, innerW);
        return ptToMm(pt) * 1.18 * lines <= subtitleAreaMm;
      })
    : 0;
  const mainAreaMm = Math.max(4, innerH - subtitleAreaMm - (sub ? 1.2 : 0));
  const mainPt = maximizeFontPt(6, 42, pt => {
    const lines = estimateLineCount(row.text, pt, innerW);
    const h = ptToMm(pt) * 1.15 * lines;
    return h <= mainAreaMm;
  });
  const font = fontCssFor(f);
  const color = esc(f.textColor);
  const fw = f.bold ? 800 : 600;
  const subHtml = sub
    ? `<div class="label-sub" style="font-size: ${subPt}pt; color: ${hexToRgba(
        f.textColor,
        0.88
      )}; font-weight: ${f.bold ? 600 : 500}; line-height: 1.2;">${esc(
        sub
      )}</div>`
    : '';
  return `
  <div class="label" style="width: ${f.widthMm}mm; height: ${
    f.heightMm
  }mm; padding: ${pad}mm; font-family: ${font};">
    <div class="label-main" style="font-size: ${mainPt}pt; color: ${color}; font-weight: ${fw};">${esc(
      row.text
    )}</div>
    ${subHtml}
  </div>`;
}

export function buildCustomShelfLabelsHtml(
  rows: CustomShelfLabelRow[],
  orgHeader: string
): string {
  const blocks = rows.map(shelfBlock).join('\n');
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
      border: 1.3px solid #374151;
      border-radius: 2mm;
      background: #fff;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      break-inside: avoid;
      page-break-inside: avoid;
      overflow: hidden;
    }
    .label-main {
      letter-spacing: .2px;
      word-break: break-word;
      line-height: 1.15;
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

export function buildPreviewWrapperHtml(
  innerDoc: string,
  opts?: { title?: string }
): string {
  const title = opts?.title
    ? `<div style="padding:6px 8px;font:12px system-ui;background:#1e293b;color:#e2e8f0;">${esc(
        opts.title
      )}</div>`
    : '';
  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=4" />
  <style>html,body{margin:0;background:#0f172a;} #wrap{box-sizing:border-box;min-height:100vh;padding:8px;}</style>
  </head><body>${title}<div id="wrap">${innerDoc}</div></body></html>`;
}

/** Document PDF complet : injecte le viewport ; fragment : enrobe pour WebView. */
export function prepareHtmlForPreview(
  fullOrFragment: string,
  opts?: { bannerTitle?: string }
): string {
  const t = fullOrFragment.trim();
  if (/^<!DOCTYPE/i.test(t) || /<html[\s>]/i.test(t)) {
    if (/name="viewport"/i.test(t) || /name='viewport'/i.test(t)) {
      return t;
    }
    if (/<head[^>]*>/i.test(t)) {
      return t.replace(
        /<head[^>]*>/i,
        m =>
          `${m}<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=4" />`
      );
    }
    return t;
  }
  return buildPreviewWrapperHtml(t, { title: opts?.bannerTitle });
}

export async function exportEtiquetteMaterielPdfCustom(
  mat: Materiel,
  f: UserLabelFormat
): Promise<void> {
  const brand = await getPdfBranding();
  const html = buildCustomMaterielLabelHtml(mat, f, brand);
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Étiquette — ${f.name.trim() || 'personnalisé'}`,
    });
  }
}

export async function exportBulkQrLabelsPdfCustom(
  items: { materiel: Materiel; format: UserLabelFormat }[],
  paper: BulkPaperSize,
  layout: BulkLayoutMode
): Promise<void> {
  if (!items.length) return;
  const brand = await getPdfBranding();
  const html = buildCustomBulkQrHtml(items, paper, brand, layout);
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

export async function exportShelfLabelsPdfCustom(
  rows: CustomShelfLabelRow[]
): Promise<void> {
  if (!rows.length) return;
  const branding = await getPdfBranding();
  const orgHeader = buildPdfOrgHeaderHtml(branding);
  const html = buildCustomShelfLabelsHtml(rows, orgHeader);
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Étiquettes rayonnage (${rows.length})`,
    });
  }
}

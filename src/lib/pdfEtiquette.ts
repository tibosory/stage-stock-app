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

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Formats d’impression d’étiquettes (PDF) */
export type EtiquetteFormatId =
  | 'third_a4'
  | 'quarter_a4'
  | 'half_a4'
  | 'a5_label'
  | 'bito_70x36'
  | 'bito_96x42'
  | 'sysfix_60x28'
  | 'viso_100x60'
  | 'avery_l7651'
  | 'avery_l7173'
  | 'herma_4268'
  | 'carte_visite'
  | 'petite'
  | 'large'
  | 'a4_6';

/** Libellés courts (listes déroulantes, une ligne) */
export const ETIQUETTE_FORMAT_LABELS: Record<EtiquetteFormatId, string> = {
  third_a4: '99×57 mm — 1/3 A4',
  quarter_a4: '105×74 mm — 1/4 A4',
  half_a4: '210×74 mm — 1/2 A4',
  a5_label: '148×210 mm — A5',
  bito_70x36: '70×36 mm — Bito / Allit / Raaco',
  bito_96x42: '96×42 mm — Bito / Allit / Raaco',
  sysfix_60x28: '60×28 mm — Sysfix / Systembox',
  viso_100x60: '100×60 mm — Viso / Vigour',
  avery_l7651: '38,1×21,2 mm — Avery L7651',
  avery_l7173: '99,1×57 mm — Avery L7173',
  herma_4268: '96×50,8 mm — Herma 4268',
  carte_visite: '85×54 mm — carte de visite',
  petite: '50×28 mm — petite',
  large: '105×48 mm — grand (ancien)',
  a4_6: 'A4 — 6 étiquettes identiques',
};

/** Regroupement pour menus (famille → liste de formats) */
export type EtiquetteFormatFamilyId = 'courants' | 'marques' | 'avery' | 'classiques';

export const ETIQUETTE_FORMAT_FAMILIES: { id: EtiquetteFormatFamilyId; label: string }[] = [
  { id: 'courants', label: 'Formats courants (bacs)' },
  { id: 'marques', label: 'Marques (Bito, Sysfix…)' },
  { id: 'avery', label: 'Avery / Herma' },
  { id: 'classiques', label: 'Classiques Stage Stock' },
];

export const ETIQUETTE_FORMATS_BY_FAMILY: Record<EtiquetteFormatFamilyId, EtiquetteFormatId[]> = {
  courants: ['third_a4', 'quarter_a4', 'half_a4', 'a5_label'],
  marques: ['bito_70x36', 'bito_96x42', 'sysfix_60x28', 'viso_100x60'],
  avery: ['avery_l7651', 'avery_l7173', 'herma_4268'],
  classiques: ['carte_visite', 'petite', 'large', 'a4_6'],
};

/** Sous-titre optionnel (bac, feuille) — affichage fiche matériel */
export const ETIQUETTE_FORMAT_HINTS: Partial<Record<EtiquetteFormatId, string>> = {
  third_a4: 'Petits bacs (taille 1–2)',
  quarter_a4: 'Bacs moyens (taille 2–3)',
  half_a4: 'Grands bacs (taille 3–4)',
  a5_label: 'Très grands bacs',
  avery_l7651: '65 étiquettes / feuille',
  avery_l7173: '10 / feuille',
  herma_4268: '10 / feuille',
};

export const ETIQUETTE_FORMAT_ORDER: EtiquetteFormatId[] = [
  ...ETIQUETTE_FORMATS_BY_FAMILY.courants,
  ...ETIQUETTE_FORMATS_BY_FAMILY.marques,
  ...ETIQUETTE_FORMATS_BY_FAMILY.avery,
  ...ETIQUETTE_FORMATS_BY_FAMILY.classiques,
];

type MicroKind = 'petite' | 'carte_visite' | 'large';

type RectLabelSpec = {
  wMm: number;
  hMm: number;
  pageMarginMm: number;
  micro: MicroKind;
  qrCell: number;
  qrMargin: number;
  imgMaxMm: number;
  h1Pt: number;
  metaPt: number;
  codePt: number;
  wrapPadMm: number;
  borderMm: number;
  borderRadiusMm: number;
  bulkNamePt: number;
  bulkSnPt: number;
};

/** Spécification grille pour lots (pdfEtiquetteBulk) */
export type BulkTileSpec = {
  cell: number;
  margin: number;
  imgMaxMm: number;
  boxWmm: number;
  boxHmm: number;
  namePt: number;
  snPt: number;
};

const RECT_LABEL_SPECS: Record<Exclude<EtiquetteFormatId, 'a4_6'>, RectLabelSpec> = {
  third_a4: {
    wMm: 99,
    hMm: 57,
    pageMarginMm: 3,
    micro: 'carte_visite',
    qrCell: 4,
    qrMargin: 2,
    imgMaxMm: 38,
    h1Pt: 11,
    metaPt: 8,
    codePt: 7,
    wrapPadMm: 8,
    borderMm: 1.2,
    borderRadiusMm: 5,
    bulkNamePt: 6.5,
    bulkSnPt: 5.5,
  },
  quarter_a4: {
    wMm: 105,
    hMm: 74,
    pageMarginMm: 4,
    micro: 'carte_visite',
    qrCell: 5,
    qrMargin: 2,
    imgMaxMm: 42,
    h1Pt: 12,
    metaPt: 9,
    codePt: 8,
    wrapPadMm: 10,
    borderMm: 1.2,
    borderRadiusMm: 6,
    bulkNamePt: 7,
    bulkSnPt: 6,
  },
  half_a4: {
    wMm: 210,
    hMm: 74,
    pageMarginMm: 4,
    micro: 'large',
    qrCell: 5,
    qrMargin: 2,
    imgMaxMm: 52,
    h1Pt: 14,
    metaPt: 10,
    codePt: 9,
    wrapPadMm: 10,
    borderMm: 1.3,
    borderRadiusMm: 8,
    bulkNamePt: 7.5,
    bulkSnPt: 6.5,
  },
  a5_label: {
    wMm: 148,
    hMm: 210,
    pageMarginMm: 8,
    micro: 'large',
    qrCell: 6,
    qrMargin: 3,
    imgMaxMm: 78,
    h1Pt: 17,
    metaPt: 12,
    codePt: 10,
    wrapPadMm: 14,
    borderMm: 1.4,
    borderRadiusMm: 10,
    bulkNamePt: 8,
    bulkSnPt: 7,
  },
  bito_70x36: {
    wMm: 70,
    hMm: 36,
    pageMarginMm: 2,
    micro: 'petite',
    qrCell: 3,
    qrMargin: 1,
    imgMaxMm: 24,
    h1Pt: 7,
    metaPt: 5.5,
    codePt: 5,
    wrapPadMm: 3,
    borderMm: 1,
    borderRadiusMm: 3,
    bulkNamePt: 5.5,
    bulkSnPt: 5,
  },
  bito_96x42: {
    wMm: 96,
    hMm: 42,
    pageMarginMm: 2.5,
    micro: 'carte_visite',
    qrCell: 4,
    qrMargin: 1,
    imgMaxMm: 32,
    h1Pt: 9,
    metaPt: 6.5,
    codePt: 5.5,
    wrapPadMm: 5,
    borderMm: 1.1,
    borderRadiusMm: 4,
    bulkNamePt: 6.5,
    bulkSnPt: 5.5,
  },
  sysfix_60x28: {
    wMm: 60,
    hMm: 28,
    pageMarginMm: 1.5,
    micro: 'petite',
    qrCell: 2,
    qrMargin: 1,
    imgMaxMm: 18,
    h1Pt: 6,
    metaPt: 5,
    codePt: 4.5,
    wrapPadMm: 2,
    borderMm: 1,
    borderRadiusMm: 2,
    bulkNamePt: 5.5,
    bulkSnPt: 5,
  },
  viso_100x60: {
    wMm: 100,
    hMm: 60,
    pageMarginMm: 3,
    micro: 'carte_visite',
    qrCell: 5,
    qrMargin: 2,
    imgMaxMm: 40,
    h1Pt: 12,
    metaPt: 9,
    codePt: 8,
    wrapPadMm: 9,
    borderMm: 1.2,
    borderRadiusMm: 6,
    bulkNamePt: 7,
    bulkSnPt: 6,
  },
  avery_l7651: {
    wMm: 38.1,
    hMm: 21.2,
    pageMarginMm: 1,
    micro: 'petite',
    qrCell: 2,
    qrMargin: 1,
    imgMaxMm: 14,
    h1Pt: 5,
    metaPt: 4,
    codePt: 3.5,
    wrapPadMm: 2,
    borderMm: 0.8,
    borderRadiusMm: 2,
    bulkNamePt: 5,
    bulkSnPt: 4.5,
  },
  avery_l7173: {
    wMm: 99.1,
    hMm: 57,
    pageMarginMm: 3,
    micro: 'carte_visite',
    qrCell: 4,
    qrMargin: 2,
    imgMaxMm: 38,
    h1Pt: 11,
    metaPt: 8,
    codePt: 7,
    wrapPadMm: 8,
    borderMm: 1.2,
    borderRadiusMm: 5,
    bulkNamePt: 6.5,
    bulkSnPt: 5.5,
  },
  herma_4268: {
    wMm: 96,
    hMm: 50.8,
    pageMarginMm: 3,
    micro: 'carte_visite',
    qrCell: 4,
    qrMargin: 1,
    imgMaxMm: 36,
    h1Pt: 10,
    metaPt: 7.5,
    codePt: 6.5,
    wrapPadMm: 7,
    borderMm: 1.2,
    borderRadiusMm: 5,
    bulkNamePt: 6.5,
    bulkSnPt: 6,
  },
  carte_visite: {
    wMm: 85,
    hMm: 54,
    pageMarginMm: 4,
    micro: 'carte_visite',
    qrCell: 5,
    qrMargin: 2,
    imgMaxMm: 42,
    h1Pt: 13,
    metaPt: 9,
    codePt: 8,
    wrapPadMm: 10,
    borderMm: 1.2,
    borderRadiusMm: 6,
    bulkNamePt: 6.5,
    bulkSnPt: 5.5,
  },
  petite: {
    wMm: 50,
    hMm: 28,
    pageMarginMm: 2,
    micro: 'petite',
    qrCell: 3,
    qrMargin: 1,
    imgMaxMm: 22,
    h1Pt: 7,
    metaPt: 5.5,
    codePt: 4.8,
    wrapPadMm: 3,
    borderMm: 1,
    borderRadiusMm: 3,
    bulkNamePt: 5.5,
    bulkSnPt: 5,
  },
  large: {
    wMm: 105,
    hMm: 48,
    pageMarginMm: 5,
    micro: 'large',
    qrCell: 5,
    qrMargin: 2,
    imgMaxMm: 42,
    h1Pt: 15,
    metaPt: 10,
    codePt: 9,
    wrapPadMm: 12,
    borderMm: 1.3,
    borderRadiusMm: 8,
    bulkNamePt: 7,
    bulkSnPt: 6,
  },
};

const A4_6_BULK: BulkTileSpec = {
  cell: 4,
  margin: 3,
  imgMaxMm: 32,
  boxWmm: 54,
  boxHmm: 66,
  namePt: 6.5,
  snPt: 5.5,
};

export function getBulkTileSpec(format: EtiquetteFormatId): BulkTileSpec {
  if (format === 'a4_6') return A4_6_BULK;
  const r = RECT_LABEL_SPECS[format];
  return {
    cell: r.qrCell,
    margin: r.qrMargin,
    imgMaxMm: r.imgMaxMm,
    boxWmm: r.wMm,
    boxHmm: r.hMm,
    namePt: r.bulkNamePt,
    snPt: r.bulkSnPt,
  };
}

function mm(n: number): string {
  const s = Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '');
  return `${s}mm`;
}

function labelInner(
  mat: Materiel,
  code: string,
  opts: { h1: string; meta: string; code: string; qrImg: string }
): string {
  return `
  <div class="wrap">
    <h1 style="${opts.h1}">${esc(mat.nom)}</h1>
    <div class="meta" style="${opts.meta}">${esc([mat.marque, mat.type].filter(Boolean).join(' · '))}</div>
    ${opts.qrImg}
    <div class="code" style="${opts.code}">${esc(code)}</div>
  </div>`;
}

function buildRectLabelHtml(mat: Materiel, spec: RectLabelSpec, brand: PdfBranding): string {
  const code = mat.qr_code?.trim() || mat.id;
  const micro = buildPdfOrgMicroForLabel(brand, spec.micro);
  const qrTag = qrCodeImgTagForHtml(code, spec.qrCell, spec.qrMargin);
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: ${mm(spec.wMm)} ${mm(spec.hMm)}; margin: ${mm(spec.pageMarginMm)}; }
    body { font-family: "Inter", "Segoe UI", Arial, sans-serif; margin: 0; padding: 2px; color: #111; }
    .wrap {
      border: ${spec.borderMm}px solid #374151;
      border-radius: ${spec.borderRadiusMm}px;
      padding: ${spec.wrapPadMm}mm;
      text-align: center;
      background: #fff;
      box-sizing: border-box;
    }
    h1 { font-size: ${spec.h1Pt}px; margin: 0 0 4px 0; font-weight: 700; letter-spacing: .12px; line-height: 1.15; }
    .meta { font-size: ${spec.metaPt}px; color: #1f2937; margin-bottom: 4px; }
    .code { font-size: ${spec.codePt}px; color: #374151; word-break: break-all; margin-top: 4px; }
    img { max-width: ${spec.imgMaxMm}mm; height: auto; }
  </style>
</head>
<body>
  ${micro}
  ${labelInner(mat, code, { h1: '', meta: '', code: '', qrImg: qrTag })}
</body>
</html>`;
}

function buildHtml(mat: Materiel, format: EtiquetteFormatId, brand: PdfBranding): string {
  if (format === 'a4_6') {
    const orgHeader = buildPdfOrgHeaderHtml(brand);
    const code = mat.qr_code?.trim() || mat.id;
    const qrTag = qrCodeImgTagForHtml(code, 4, 5);
    const cell = `
  <td style="width:33.33%; padding: 4mm; vertical-align: middle; border: 1px solid #9ca3af;">
    <div style="border: 1.2px solid #374151; border-radius: 6px; padding: 8px; text-align: center;">
      <h1 style="font-size: 11px; margin: 0 0 4px 0; font-weight:700; letter-spacing:.15px;">${esc(mat.nom)}</h1>
      <div style="font-size: 8.5px; color: #1f2937; margin-bottom: 4px;">${esc([mat.marque, mat.type].filter(Boolean).join(' · '))}</div>
      ${qrTag}
      <div style="font-size: 7.5px; color:#374151; word-break: break-all; margin-top: 4px;">${esc(code)}</div>
    </div>
  </td>`;
    const row = `<tr>${cell}${cell}${cell}</tr>`;
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    body { font-family: "Inter", "Segoe UI", Arial, sans-serif; margin: 0; color: #111; }
    table { width: 100%; border-collapse: collapse; }
    img { max-width: 32mm; height: auto; }
  </style>
</head>
<body>
  ${orgHeader}
  <table style="width:100%; table-layout:fixed;">
    ${row}
    ${row}
  </table>
</body>
</html>`;
  }

  const spec = RECT_LABEL_SPECS[format];
  return buildRectLabelHtml(mat, spec, brand);
}

export async function exportEtiquetteMaterielPdf(
  mat: Materiel,
  format: EtiquetteFormatId = 'carte_visite'
): Promise<void> {
  const brand = await getPdfBranding();
  const html = buildHtml(mat, format, brand);
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Étiquette — ${ETIQUETTE_FORMAT_LABELS[format]}`,
    });
  }
}

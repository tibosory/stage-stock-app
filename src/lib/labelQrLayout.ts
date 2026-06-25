import type { Consommable, Materiel } from '../types';

/** Entrée unifiée pour l’impression QR groupée (stock + consommable). */
export type BulkQrPrintItem = {
  id: string;
  nom: string;
  qrCode: string;
  /** Ligne référence sous le nom (Réf. …). */
  metaLine: string;
  kind: 'materiel' | 'consommable';
};

/** Référence affichée sur l’étiquette (matériel : QR / id). */
export function materielReferenceDisplay(m: Pick<Materiel, 'id' | 'qr_code'>): string {
  return m.qr_code?.trim() || m.id;
}

/** Référence affichée sur l’étiquette (consommable : champ référence, sinon QR / id). */
export function consommableReferenceDisplay(
  c: Pick<Consommable, 'id' | 'reference' | 'qr_code'>
): string {
  return c.reference?.trim() || c.qr_code?.trim() || c.id;
}

export function formatReferenceLine(ref: string): string {
  const t = ref.trim();
  return t ? `Réf. ${t}` : 'Réf. —';
}

export function bulkQrItemFromMateriel(m: Materiel): BulkQrPrintItem {
  const ref = materielReferenceDisplay(m);
  return {
    id: m.id,
    nom: m.nom?.trim() || 'Sans nom',
    qrCode: m.qr_code?.trim() || m.id,
    metaLine: formatReferenceLine(ref),
    kind: 'materiel',
  };
}

export function bulkQrItemFromConsommable(c: Consommable): BulkQrPrintItem {
  const ref = consommableReferenceDisplay(c);
  return {
    id: c.id,
    nom: c.nom?.trim() || 'Sans nom',
    qrCode: c.qr_code?.trim() || c.id,
    metaLine: formatReferenceLine(ref),
    kind: 'consommable',
  };
}

const MM_PER_PT = 25.4 / 72;

function ptToMm(pt: number): number {
  return pt * MM_PER_PT;
}

function estimateLineCount(text: string, fontPt: number, widthMm: number): number {
  const clean = text.trim();
  if (!clean) return 1;
  const charMm = Math.max(0.14, ptToMm(fontPt) * 0.58);
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

export type QrLabelLayout = {
  qrMm: number;
  namePt: number;
  refPt: number;
  cell: number;
  margin: number;
};

/** Calcule QR + tailles de police pour que nom et référence tiennent entièrement. */
export function fitQrLabelLayout(args: {
  innerWmm: number;
  innerHmm: number;
  nom: string;
  refLine: string;
  minQrMm?: number;
  maxQrMm?: number;
}): QrLabelLayout {
  const innerW = Math.max(4, args.innerWmm);
  const innerH = Math.max(4, args.innerHmm);
  const minSide = Math.min(innerW, innerH);
  const gapMm = 1.1;
  const minQr = args.minQrMm ?? 8;
  const maxQr = args.maxQrMm ?? Math.min(innerW * 0.52, innerH * 0.5, 48);
  const cellBase = Math.max(2, Math.min(8, Math.round(minSide / 8)));
  const marginBase = Math.max(1, Math.min(3, Math.round(cellBase / 2)));

  for (let qrMm = maxQr; qrMm >= minQr; qrMm -= 0.5) {
    const textAreaHmm = innerH - qrMm - gapMm * 2;
    if (textAreaHmm < 2.5) continue;

    const namePt = maximizeFontPt(3.5, 22, pt => {
      const refPt = Math.max(3.2, Math.round(pt * 0.76 * 10) / 10);
      const nameLines = estimateLineCount(args.nom, pt, innerW);
      const refLines = estimateLineCount(args.refLine, refPt, innerW);
      const textHmm =
        ptToMm(pt) * 1.18 * nameLines +
        ptToMm(refPt) * 1.14 * refLines +
        gapMm;
      return textHmm <= textAreaHmm;
    });

    if (namePt >= 3.5) {
      return {
        qrMm,
        namePt,
        refPt: Math.max(3.2, Math.round(namePt * 0.76 * 10) / 10),
        cell: cellBase,
        margin: marginBase,
      };
    }
  }

  return {
    qrMm: minQr,
    namePt: 3.5,
    refPt: 3.2,
    cell: cellBase,
    margin: marginBase,
  };
}

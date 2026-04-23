/**
 * Fiches matériel A4 (PDF) : en-tête structure, photo, QR, champs fiche.
 */
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { format, parseISO, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Materiel } from '../types';
import { qrCodeImgTagForHtml } from './qrHtml';
import { getPdfBranding, buildPdfOrgHeaderHtml, type PdfBranding } from './theatreBranding';

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function val(v: unknown): string {
  if (v == null) return '—';
  const t = String(v).trim();
  return t === '' ? '—' : esc(t);
}

function fmtDateFr(raw?: string | null): string {
  if (!raw) return '—';
  const d = raw.includes('T') ? parseISO(raw) : parseISO(`${raw}T12:00:00`);
  return isValid(d) ? format(d, 'd MMM yyyy', { locale: fr }) : esc(raw);
}

function fmtNum(n: number | null | undefined, unit: string): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const t = n % 1 === 0 ? String(n) : n.toFixed(2).replace('.', ',');
  return esc(t) + (unit ? ` ${esc(unit)}` : '');
}

async function photoBlockForMateriel(mat: Materiel): Promise<string> {
  const photoUri = mat.photo_local?.trim() || mat.photo_url?.trim();
  if (!photoUri) {
    return '<div class="ph-none">Aucune photo</div>';
  }
  if (photoUri.startsWith('http://') || photoUri.startsWith('https://')) {
    return `<div class="ph-wrap"><img class="ph" src="${esc(photoUri)}" alt="" crossorigin="anonymous" /></div>`;
  }
  try {
    const info = await FileSystem.getInfoAsync(photoUri);
    if (!info.exists) {
      return '<div class="ph-none">Photo locale introuvable</div>';
    }
    const b64 = await FileSystem.readAsStringAsync(photoUri, { encoding: FileSystem.EncodingType.Base64 });
    const mime = photoUri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
    return `<div class="ph-wrap"><img class="ph" src="data:${mime};base64,${b64}" alt="" /></div>`;
  } catch {
    return '<div class="ph-none">Lecture photo impossible</div>';
  }
}

function ficheVgpRows(mat: Materiel): string {
  const actif = mat.vgp_actif === true || mat.vgp_actif === 1;
  if (!actif) return '';
  return (
    '<tr class="sub"><td colspan="2" style="font-weight:700;padding-top:8px">Contrôle / VGP</td></tr>' +
    `<tr><td class="k">Libellé</td><td class="v">${val(mat.vgp_libelle)}</td></tr>` +
    `<tr><td class="k">Périodicité (jours)</td><td class="v">${
      mat.vgp_periodicite_jours != null ? esc(String(mat.vgp_periodicite_jours)) : '—'
    }</td></tr>` +
    `<tr><td class="k">Dernière visite</td><td class="v">${
      mat.vgp_derniere_visite ? fmtDateFr(mat.vgp_derniere_visite) : '—'
    }</td></tr>` +
    `<tr><td class="k">Zone EPI</td><td class="v">${
      mat.vgp_epi === true || mat.vgp_epi === 1 ? 'Oui' : '—'
    }</td></tr>`
  );
}

function gelRow(mat: Materiel): string {
  if (!mat.gel_code?.trim() && !mat.gel_brand) return '';
  const label = [mat.gel_brand === 'lee' ? 'Lee' : mat.gel_brand === 'rosco' ? 'Rosco' : '', mat.gel_code?.trim()]
    .filter(Boolean)
    .join(' ');
  return (
    '<tr class="sub"><td colspan="2" style="font-weight:700;padding-top:8px">Éclairage (gel)</td></tr>' +
    `<tr><td class="k">Marque / code</td><td class="v">${val(label)}</td></tr>`
  );
}

export async function buildMaterielFichePageHtml(
  mat: Materiel,
  brand: PdfBranding
): Promise<string> {
  const org = buildPdfOrgHeaderHtml(brand);
  const photo = await photoBlockForMateriel(mat);
  const code = mat.qr_code?.trim() || mat.id;
  const qr = qrCodeImgTagForHtml(code, 4, 2);

  const rows: [string, string][] = [
    ['Type / catégorie', val([mat.type, (mat as any).categorie_nom].filter(Boolean).join(' — ') || undefined)],
    ['Emplacement / zone', val((mat as any).localisation_nom)],
    ['Marque / modèle', val([mat.marque, mat.type].filter(Boolean).join(' · '))],
    ['N° de série', val(mat.numero_serie)],
    ['État', val(mat.etat)],
    ['Statut', val(mat.statut)],
    ['Poids', fmtNum(mat.poids_kg, 'kg')],
    ['Prix unitaire (ref.)', mat.prix_unitaire != null && Number.isFinite(mat.prix_unitaire) ? fmtNum(mat.prix_unitaire, '€') : '—'],
    ['Date d’achat', fmtDateFr(mat.date_achat)],
    ['Date de validité', fmtDateFr(mat.date_validite)],
    ['Prochain contrôle', fmtDateFr(mat.prochain_controle)],
    [
      'Intervalle contrôle (j.)',
      mat.intervalle_controle_jours != null ? val(String(mat.intervalle_controle_jours)) : '—',
    ],
    ['Technicien (suivi)', val(mat.technicien)],
    ['Code QR (texte)', val(mat.qr_code || mat.id)],
    ['NFC / tag', val(mat.nfc_tag_id)],
  ];

  const tableBody =
    rows
      .map(
        ([k, v]) =>
          `<tr><td class="k">${esc(k)}</td><td class="v">${v}</td></tr>`
      )
      .join('') + ficheVgpRows(mat) + gelRow(mat);

  return `
<div class="fiche">
  ${org}
  <h1 class="fiche-title">${esc(mat.nom)}</h1>
  <div class="top-grid">
    <div class="col-photo">${photo}</div>
    <div class="col-qr">
      <div class="qr-box">${qr}</div>
      <p class="qr-hint">Scanner pour retrouver la fiche</p>
    </div>
  </div>
  <table class="tbl">${tableBody}</table>
  <p class="foot">Identifiant fiche : <code>${esc(mat.id)}</code> — MAJ : ${val(mat.updated_at)}</p>
</div>`;
}

function wrapHtmlDocument(body: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="color-scheme" content="light" />
  <style>
    @page { size: A4; margin: 10mm; }
    html { color-scheme: only light; }
    * { box-sizing: border-box; }
    body {
      font-family: "Inter", "Segoe UI", Arial, sans-serif;
      color: #0f172a;
      font-size: 11.5px;
      line-height: 1.35;
      margin: 0;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .fiche { break-inside: avoid; page-break-after: always; padding-bottom: 4mm; }
    .fiche:last-child { page-break-after: auto; }
    h1.fiche-title {
      font-size: 20px;
      font-weight: 800;
      margin: 8px 0 12px 0;
      color: #111827;
    }
    .top-grid {
      display: table;
      width: 100%;
      margin-bottom: 12px;
    }
    .col-photo, .col-qr {
      display: table-cell;
      vertical-align: top;
      width: 50%;
    }
    .ph-wrap { border: 1px solid #d1d5db; border-radius: 8px; overflow: hidden; min-height: 100px; }
    .ph { width: 100%; max-width: 88mm; height: auto; max-height: 60mm; object-fit: contain; display: block; background: #f9fafb; }
    .ph-none { color: #6b7280; font-size: 12px; padding: 16px; border: 1px dashed #d1d5db; border-radius: 8px; text-align: center; }
    .col-qr { text-align: center; padding-left: 8px; }
    .qr-box { display: inline-block; }
    .qr-hint { font-size: 9px; color: #4b5563; margin: 4px 0 0 0; }
    table.tbl { width: 100%; border-collapse: collapse; margin-top: 6px; }
    .tbl td { border: 1px solid #e5e7eb; padding: 5px 8px; vertical-align: top; }
    .tbl td.k { width: 34%; color: #374151; font-size: 10.5px; background: #f9fafb; }
    .tbl td.v { color: #111827; }
    .tbl tr.sub td { background: #fff; }
    p.foot { font-size: 9px; color: #6b7280; margin-top: 10px; }
    p.foot code { font-size: 9px; word-break: break-all; }
  </style>
</head>
<body>
${body}
</body>
</html>`;
}

/**
 * Génère un PDF multi-pages (une fiche A4 par matériel) avec partage système.
 */
export async function exportMaterielFichesPdf(materiels: Materiel[]): Promise<void> {
  if (materiels.length === 0) return;
  const brand = await getPdfBranding();
  const pages: string[] = [];
  for (const m of materiels) {
    pages.push(await buildMaterielFichePageHtml(m, brand));
  }
  const html = wrapHtmlDocument(pages.join('\n'));
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle:
        materiels.length === 1
          ? `Fiche matériel — ${materiels[0].nom}`
          : `Fiches matériel — ${materiels.length} fiches`,
    });
  }
}

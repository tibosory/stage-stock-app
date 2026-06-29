import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { qrCodeImgTagForHtml } from './qrHtml';
import { type StockFlightcaseKey } from './stockFlightcase';
import { materielReferenceDisplay } from './labelQrLayout';
import { exportShelfLabelsPdfCustom } from './labelCustomPdf';
import {
  getFormatsByKind,
  loadUserLabelFormats,
  normalizeUserLabelFormat,
  type UserLabelFormat,
} from './labelUserFormatsStorage';
import { ensureStockFlightcaseQr } from '../db/stockFlightcasesDb';

const DEFAULT_SHELF_FORMAT: UserLabelFormat = {
  id: 'fc_shelf_default',
  name: 'Rayonnage flightcase',
  widthMm: 70,
  heightMm: 35,
  marginPercent: 8,
  fontId: 'arial',
  textColor: '#111111',
  bold: true,
  kind: 'shelf',
};

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function mm(n: number): string {
  const s = Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '');
  return `${s}mm`;
}

function itemQrCode(m: { id?: string; qr_code?: string | null }): string {
  return m.qr_code?.trim() || m.id?.trim() || '';
}

/** Étiquette unique : QR flightcase + liste des articles (chacun avec son propre mini-QR). */
export async function printStockFlightcaseContentLabel(input: {
  key: StockFlightcaseKey;
  localisationName: string;
  items: Array<{
    id?: string;
    nom: string;
    marque?: string | null;
    numero_serie?: string | null;
    qr_code?: string | null;
  }>;
}): Promise<void> {
  const fcQr = await ensureStockFlightcaseQr(input.key);
  const fcName = input.key.flightcase.trim();
  const locLine = input.localisationName.trim() || '—';
  const widthMm = 80;
  const lineHm = 7.5;
  const headerHm = 48;
  const footerHm = 5;
  const count = Math.max(1, input.items.length);
  const heightMm = Math.min(320, Math.max(60, headerHm + count * lineHm + footerHm));

  const rows = input.items
    .map((m, i) => {
      const ownQr = itemQrCode(m);
      const ref = materielReferenceDisplay({
        id: m.id ?? m.nom,
        qr_code: m.qr_code ?? undefined,
      });
      const sub = [m.marque, m.numero_serie, ref !== m.nom ? ref : null].filter(Boolean).join(' · ');
      const miniQr = ownQr
        ? `<div class="itemQr">${qrCodeImgTagForHtml(ownQr, 2, 0)}</div>`
        : '<div class="itemQr"></div>';
      return `<div class="row">
        <span class="idx">${i + 1}.</span>
        ${miniQr}
        <span class="name">${esc(m.nom)}${sub ? `<span class="sub"> — ${esc(sub)}</span>` : ''}</span>
      </div>`;
    })
    .join('');

  const emptyRow =
    input.items.length === 0
      ? '<div class="empty">Aucun article enregistré dans cette caisse.</div>'
      : '';

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<style>
@page { size: ${mm(widthMm)} ${mm(heightMm)}; margin: 2.5mm; }
* { box-sizing: border-box; }
body { font-family: Arial, Helvetica, sans-serif; color: #111827; margin: 0; padding: 0; }
.head { display: flex; gap: 3mm; align-items: flex-start; margin-bottom: 2.5mm; padding-bottom: 2mm; border-bottom: 0.4mm solid #9ca3af; }
.qr { flex-shrink: 0; width: 28mm; text-align: center; }
.qr img { max-width: 26mm !important; height: auto !important; }
.meta { flex: 1; min-width: 0; }
.kicker { font-size: 6.5pt; font-weight: 700; letter-spacing: 0.08em; color: #6b7280; margin: 0 0 0.5mm 0; text-transform: uppercase; }
.fc { font-size: 14pt; font-weight: 900; line-height: 1.1; margin: 0 0 1.2mm 0; word-break: break-word; }
.loc { font-size: 8pt; color: #4b5563; margin: 0 0 1mm 0; }
.count { font-size: 7.5pt; color: #6b7280; margin: 0; }
.list { font-size: 7.5pt; line-height: 1.25; }
.row { display: flex; gap: 1.5mm; align-items: flex-start; margin-bottom: 1.5mm; break-inside: avoid; }
.idx { flex-shrink: 0; color: #6b7280; width: 4mm; padding-top: 1mm; }
.itemQr { flex-shrink: 0; width: 11mm; text-align: center; }
.itemQr img { max-width: 10mm !important; height: auto !important; }
.name { flex: 1; min-width: 0; word-break: break-word; padding-top: 0.5mm; }
.sub { color: #4b5563; font-size: 6.8pt; }
.empty { font-size: 8pt; color: #6b7280; font-style: italic; padding: 2mm 0; }
.foot { font-size: 6pt; color: #9ca3af; margin-top: 2mm; text-align: right; }
</style></head>
<body>
<div class="head">
  <div class="qr">${qrCodeImgTagForHtml(fcQr, 4, 1)}</div>
  <div class="meta">
    <p class="kicker">QR flightcase (caisse)</p>
    <p class="fc">${esc(fcName)}</p>
    <p class="loc">${esc(locLine)}</p>
    <p class="count">${input.items.length} article(s) — QR individuels ci-dessous</p>
  </div>
</div>
<div class="list">${rows}${emptyRow}</div>
<p class="foot">${esc(fcName)} · CATRACK Pro</p>
</body></html>`;

  const { uri } = await Print.printToFileAsync({
    html,
    width: widthMm * 2.83465,
    height: heightMm * 2.83465,
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Flightcase ${fcName}`,
    });
  }
}

/** Petite étiquette QR flightcase seule — code SS-FC:fc_… distinct des QR matériel. */
export async function printStockFlightcaseQrOnly(input: {
  key: StockFlightcaseKey;
  localisationName: string;
}): Promise<void> {
  const qr = await ensureStockFlightcaseQr(input.key);
  const fcName = input.key.flightcase.trim();
  const locLine = input.localisationName.trim() || '—';
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<style>
@page { size: 62mm 72mm; margin: 2mm; }
body { font-family: Arial, Helvetica, sans-serif; text-align: center; color: #111827; margin: 0; }
.kicker { font-size: 6.5pt; font-weight: 700; letter-spacing: 0.1em; color: #6b7280; margin: 0 0 0.5mm 0; text-transform: uppercase; }
.title { font-size: 15pt; font-weight: 900; line-height: 1.08; margin: 0 0 1mm 0; word-break: break-word; }
.loc { font-size: 7.5pt; color: #4b5563; margin: 0 0 1.5mm 0; }
.qr img { max-width: 34mm !important; height: auto !important; }
.idLine { font-size: 12pt; font-weight: 800; margin: 1.5mm 0 0 0; word-break: break-word; line-height: 1.1; }
.hint { font-size: 6pt; color: #9ca3af; margin-top: 1mm; }
</style></head>
<body>
<p class="kicker">QR flightcase</p>
<p class="title">${esc(fcName)}</p>
<p class="loc">${esc(locLine)}</p>
<div class="qr">${qrCodeImgTagForHtml(qr, 5, 2)}</div>
<p class="idLine">${esc(fcName)}</p>
<p class="hint">Distinct des QR de chaque article</p>
</body></html>`;
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `QR flightcase — ${fcName}`,
    });
  }
}

/** Feuille A4 : QR flightcase + une étiquette QR par article (codes matériel inchangés). */
export async function printStockFlightcaseGroupedQrsPdf(input: {
  key: StockFlightcaseKey;
  localisationName: string;
  items: Array<{
    id?: string;
    nom: string;
    qr_code?: string | null;
  }>;
}): Promise<void> {
  const fcQr = await ensureStockFlightcaseQr(input.key);
  const fcName = input.key.flightcase.trim();
  const locLine = input.localisationName.trim() || '—';

  const fcBlock = `<div class="tile fcTile">
    <div class="kicker">QR flightcase</div>
    <div class="title">${esc(fcName)}</div>
    <div class="loc">${esc(locLine)}</div>
    <div class="qr">${qrCodeImgTagForHtml(fcQr, 5, 2)}</div>
    <div class="idLine">${esc(fcName)}</div>
  </div>`;

  const itemBlocks = input.items
    .map(m => {
      const ownQr = itemQrCode(m);
      if (!ownQr) return '';
      return `<div class="tile itemTile">
        <div class="kicker">Article</div>
        <div class="title">${esc(m.nom)}</div>
        <div class="qr">${qrCodeImgTagForHtml(ownQr, 4, 1)}</div>
        <div class="code">${esc(ownQr)}</div>
      </div>`;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<style>
@page { size: A4; margin: 8mm; }
body { font-family: Arial, Helvetica, sans-serif; color: #111827; margin: 0; }
h1 { font-size: 16px; margin: 0 0 8px 0; }
.sub { font-size: 11px; color: #4b5563; margin: 0 0 10px 0; }
.grid { display: flex; flex-wrap: wrap; gap: 4mm; align-content: flex-start; }
.tile { width: 62mm; min-height: 68mm; border: 1px solid #374151; border-radius: 2mm; padding: 2mm; text-align: center; break-inside: avoid; }
.fcTile { border-width: 2px; border-color: #059669; }
.kicker { font-size: 7px; font-weight: 700; letter-spacing: 0.08em; color: #6b7280; text-transform: uppercase; margin-bottom: 1mm; }
.title { font-size: 12px; font-weight: 800; margin-bottom: 1mm; word-break: break-word; line-height: 1.15; }
.loc { font-size: 9px; color: #4b5563; margin-bottom: 2mm; }
.qr img { max-width: 38mm !important; height: auto !important; }
.idLine { font-size: 11px; font-weight: 700; margin-top: 1mm; word-break: break-word; }
.code { font-size: 7px; color: #6b7280; word-break: break-all; margin-top: 1mm; }
</style></head>
<body>
<h1>Flightcase ${esc(fcName)} — QR caisse + articles</h1>
<p class="sub">${esc(locLine)} · ${input.items.length} article(s). Chaque matériel conserve son QR propre.</p>
<div class="grid">${fcBlock}${itemBlocks}</div>
</body></html>`;

  const { uri } = await Print.printToFileAsync({ html, base64: false });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `QR groupés — ${fcName}`,
    });
  }
}

/** Étiquette rayonnage / bac : libellé flightcase en gros (+ localisation en sous-titre). */
export async function printStockFlightcaseShelfLabel(input: {
  key: StockFlightcaseKey;
  localisationName: string;
}): Promise<void> {
  const fcName = input.key.flightcase.trim();
  const all = await loadUserLabelFormats();
  const shelfFormats = getFormatsByKind(all, 'shelf');
  const format = normalizeUserLabelFormat(shelfFormats[0] ?? DEFAULT_SHELF_FORMAT);
  await exportShelfLabelsPdfCustom([
    {
      text: fcName,
      subtitle: input.localisationName.trim() || undefined,
      format,
    },
  ]);
}

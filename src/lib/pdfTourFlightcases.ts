import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { qrCodeImgTagForHtml } from './qrHtml';

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function exportFlightcaseContentPdf(input: {
  tourName: string;
  flightcaseLabel: string;
  items: Array<{
    materialName: string;
    quantity: number;
    locationName?: string | null;
    statusLabel?: string | null;
    lineWeightKg?: number | null;
  }>;
}): Promise<void> {
  const totalWeightKg = input.items.reduce((sum, i) => {
    const w = Number(i.lineWeightKg ?? 0);
    return Number.isFinite(w) && w > 0 ? sum + w : sum;
  }, 0);
  const totalWeightText = `${(Math.round(totalWeightKg * 100) / 100).toFixed(2)} kg`;
  const rows = input.items
    .map(
      i => `<tr>
      <td>${esc(i.materialName)}</td>
      <td style="text-align:center;">${esc(String(i.quantity))}</td>
      <td style="text-align:right;">${
        i.lineWeightKg != null && Number.isFinite(Number(i.lineWeightKg)) && Number(i.lineWeightKg) > 0
          ? esc(`${(Math.round(Number(i.lineWeightKg) * 100) / 100).toFixed(2)} kg`)
          : '—'
      }</td>
      <td>${esc(i.locationName || '—')}</td>
      <td>${esc(i.statusLabel || '—')}</td>
    </tr>`
    )
    .join('');
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<style>
@page { size: A4; margin: 10mm; }
body { font-family: "Times New Roman", Times, Arial, sans-serif; color:#111827; }
h1 { margin: 0 0 6px 0; font-size: 20px; }
h2 { margin: 0 0 12px 0; font-size: 14px; color:#374151; }
table { width:100%; border-collapse: collapse; }
th, td { border: 1px solid #d1d5db; padding: 7px; font-size: 11px; vertical-align: top; }
th { background: #f3f4f6; text-align:left; }
.muted { color:#6b7280; font-size:10px; margin-top:10px; }
</style></head>
<body>
<h1>Contenu Flightcase ${esc(input.flightcaseLabel)}</h1>
<h2>Tournée : ${esc(input.tourName)}</h2>
<table>
  <thead><tr><th>Matériel</th><th>Qté</th><th>Poids ligne</th><th>Lieu</th><th>Statut</th></tr></thead>
  <tbody>${rows || '<tr><td colspan="5">Aucun matériel dans ce flightcase.</td></tr>'}</tbody>
</table>
<p><strong>Poids total du flightcase :</strong> ${esc(totalWeightText)}</p>
<p class="muted">Document généré depuis CATRACK Pro.</p>
</body></html>`;
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Flightcase ${input.flightcaseLabel} — contenu`,
    });
  }
}

export async function exportFlightcaseQrLabelsPdf(input: {
  tourName: string;
  flightcases: Array<{ label: string; qrCode: string }>;
}): Promise<void> {
  const blocks = input.flightcases
    .map(
      fc => `<div class="tile">
      <div class="title">Flightcase ${esc(fc.label)}</div>
      <div class="qr">${qrCodeImgTagForHtml(fc.qrCode, 5, 2)}</div>
      <div class="code">${esc(fc.qrCode)}</div>
    </div>`
    )
    .join('');
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<style>
@page { size: A4; margin: 8mm; }
body { font-family: "Times New Roman", Times, Arial, sans-serif; color:#111827; }
h1 { font-size: 18px; margin: 0 0 10px 0; }
.grid { display:flex; flex-wrap: wrap; gap: 4mm; align-content:flex-start; }
.tile { width: 62mm; height: 68mm; border: 1px solid #374151; border-radius: 2mm; padding: 2mm; text-align:center; break-inside: avoid; }
.title { font-size: 13px; font-weight: 700; margin-bottom: 2mm; }
.qr img { max-width: 38mm !important; height: auto !important; }
.code { font-size: 8px; color:#6b7280; word-break: break-all; margin-top: 1mm; }
</style></head>
<body>
<h1>Étiquettes QR Flightcases — ${esc(input.tourName)}</h1>
<div class="grid">${blocks}</div>
</body></html>`;
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Étiquettes QR flightcases (${input.flightcases.length})`,
    });
  }
}

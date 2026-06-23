import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { COULEURS_TOP, LABELS_DEPARTEMENT, LABELS_LOCALISATION_TOP, LABELS_TYPE_TOP } from '../types';
import type { Conduite, Top } from '../types';

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Export PDF d’une conduite (impression avant le spectacle, complément du mode live). */
export async function exportConduitePdf(conduite: Conduite, tops: Top[]): Promise<void> {
  const rows = tops
    .map(t => {
      const c = COULEURS_TOP[t.departement];
      return `<tr style="background:${c.bg};">
      <td style="text-align:center;font-weight:700;">${esc(String(t.numero))}</td>
      <td style="text-align:center;">${esc(t.minutage || '—')}</td>
      <td style="color:${c.text};font-weight:600;">${esc(LABELS_TYPE_TOP[t.departement])}</td>
      <td>${esc(t.localisation ? LABELS_LOCALISATION_TOP[t.localisation] : '—')}</td>
      <td>${esc(t.repere || '—')}</td>
      <td>${esc(t.action || '—')}</td>
      <td>${esc(t.description)}</td>
      <td style="color:#374151;">${esc(t.detail || '—')}</td>
    </tr>`;
    })
    .join('');

  const generatedAt = format(new Date(), 'd MMMM yyyy', { locale: fr });
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<style>
@page { size: A4; margin: 10mm; }
body { font-family: "Times New Roman", Times, Arial, sans-serif; color:#111827; }
h1 { margin: 0 0 4px 0; font-size: 20px; }
h2 { margin: 0 0 12px 0; font-size: 13px; color:#374151; font-weight: normal; }
table { width:100%; border-collapse: collapse; }
th, td { border: 1px solid #d1d5db; padding: 7px; font-size: 11px; vertical-align: top; }
th { background: #111827; color:#fff; text-align:left; }
.muted { color:#6b7280; font-size:10px; margin-top:12px; }
</style></head>
<body>
<h1>Conduite — ${esc(conduite.titre)}</h1>
<h2>${esc(conduite.nomSpectacle)} · ${esc(LABELS_DEPARTEMENT[conduite.departement])} · Généré le ${esc(generatedAt)}</h2>
<table>
  <thead><tr><th style="width:6%;">Top</th><th style="width:8%;">Min.</th><th style="width:10%;">Dép.</th><th style="width:10%;">Loc.</th><th style="width:18%;">Repère</th><th style="width:18%;">Action</th><th style="width:16%;">Description</th><th style="width:14%;">Détail</th></tr></thead>
  <tbody>${rows || '<tr><td colspan="8">Aucun top dans cette conduite.</td></tr>'}</tbody>
</table>
${conduite.notes ? `<p class="muted"><strong>Notes :</strong> ${esc(conduite.notes)}</p>` : ''}
<p class="muted">Document généré depuis CATRACK Pro — module Régie.</p>
</body></html>`;

  const { uri } = await Print.printToFileAsync({ html, base64: false });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Conduite — ${conduite.titre}`,
    });
  }
}

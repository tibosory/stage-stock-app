import * as Linking from 'expo-linking';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { InspectionReportPayload } from './accueilProInspectionReport';
import { inspectionReportEmailBody } from './accueilProInspectionReport';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function typeLabel(type: string): string {
  return type === 'entrée' ? 'Entrée' : 'Sortie';
}

export async function exportAccueilProInspectionReportPdf(payload: InspectionReportPayload): Promise<string | null> {
  const { event, venueName, organizationName, problems, comments, photoCounts, missingEntry, missingExit } =
    payload;

  const problemRows = problems
    .map(
      p => `<tr>
      <td>${esc(p.spaceName)}</td>
      <td>${esc(typeLabel(p.inspectionType))}</td>
      <td>${esc(p.checkLabel)}</td>
      <td><strong style="color:#B42318">KO</strong></td>
    </tr>`
    )
    .join('');

  const commentRows = comments
    .map(
      c => `<tr>
      <td>${esc(c.spaceName)}</td>
      <td>${esc(typeLabel(c.inspectionType))}</td>
      <td colspan="2">${esc(c.text)}</td>
    </tr>`
    )
    .join('');

  const photoLine =
    photoCounts.length > 0
      ? photoCounts.map(p => `${esc(p.spaceName)} (${typeLabel(p.inspectionType)}) : ${p.count} photo(s)`).join(' · ')
      : 'Aucune photo jointe';

  const missingBlock = [
    missingEntry.length ? `<p><strong>EDL entrée non réalisés :</strong> ${esc(missingEntry.join(', '))}</p>` : '',
    missingExit.length ? `<p><strong>EDL sortie non réalisés :</strong> ${esc(missingExit.join(', '))}</p>` : '',
  ].join('');

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"/>
<style>
body{font-family:system-ui,sans-serif;color:#1A2744;padding:32px;font-size:13px;line-height:1.45}
h1{font-size:22px;margin:0 0 6px} .sub{color:#888;font-size:12px;margin-bottom:18px}
.stats{display:flex;gap:10px;margin:16px 0;flex-wrap:wrap}
.stat{border:1px solid #E5E0D4;border-radius:8px;padding:10px 14px;min-width:100px}
.stat b{font-size:22px;color:#C8973A;display:block}
table{width:100%;border-collapse:collapse;margin-top:10px}
td,th{border-bottom:1px solid #F0EDE5;padding:8px 6px;text-align:left;font-size:12px;vertical-align:top}
th{color:#666;font-weight:600}
.warn{background:#FEF3F2;border-radius:8px;padding:12px;margin:12px 0;color:#912018}
.ok{background:#ECFDF3;border-radius:8px;padding:12px;margin:12px 0;color:#067647}
</style></head><body>
<h1>Rapport EDL — anomalies</h1>
<p class="sub">${esc(event.name)} · ${esc(event.date_debut)}${event.heure_debut ? ` · ${esc(event.heure_debut)}` : ''}<br/>
Lieu : ${esc(venueName)} · Organisation : ${esc(organizationName)}<br/>
Généré ${esc(new Date().toLocaleString('fr-FR'))}</p>
<div class="stats">
  <div class="stat"><b>${problems.length}</b>Anomalie(s) KO</div>
  <div class="stat"><b>${comments.length}</b>Commentaire(s)</div>
  <div class="stat"><b>${payload.spaces.length}</b>Espace(s)</div>
</div>
${problems.length === 0 && comments.length === 0 ? '<div class="ok">Aucune anomalie KO ni commentaire sur les EDL enregistrés.</div>' : ''}
${missingBlock ? `<div class="warn">${missingBlock}</div>` : ''}
<h2>Points non conformes</h2>
<table><thead><tr><th>Espace</th><th>EDL</th><th>Point</th><th>Statut</th></tr></thead>
<tbody>${problemRows || '<tr><td colspan="4">Aucun point KO.</td></tr>'}</tbody></table>
<h2>Commentaires</h2>
<table><thead><tr><th>Espace</th><th>EDL</th><th colspan="2">Texte</th></tr></thead>
<tbody>${commentRows || '<tr><td colspan="4">Aucun commentaire.</td></tr>'}</tbody></table>
<h2>Photos</h2>
<p>${photoLine}</p>
<p style="margin-top:32px;font-size:11px;color:#999">Accueil Pro — rapport interne</p>
</body></html>`;

  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Rapport EDL — ${event.name}`,
    });
  }
  return uri;
}

export async function shareInspectionReportByEmail(
  payload: InspectionReportPayload,
  recipientEmail?: string | null
): Promise<void> {
  const subject = encodeURIComponent(`EDL — ${payload.event.name} — rapport anomalies`);
  const body = encodeURIComponent(inspectionReportEmailBody(payload));
  const to = recipientEmail?.trim() ? encodeURIComponent(recipientEmail.trim()) : '';
  const mailto = to ? `mailto:${to}?subject=${subject}&body=${body}` : `mailto:?subject=${subject}&body=${body}`;
  if (await Linking.canOpenURL(mailto)) {
    await Linking.openURL(mailto);
  }
}

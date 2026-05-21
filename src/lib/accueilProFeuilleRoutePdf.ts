import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { ApDayPlanItem, ApEvent, ApEventPersonnel, ApRoomInspection, ApVenue } from '../types/accueilPro';
import { formatDayPlanTimeRange } from './accueilProDayPlanHelpers';

type FeuillePayload = {
  date: string;
  dateLabel: string;
  events: ApEvent[];
  venues: ApVenue[];
  edl: ApRoomInspection[];
  conventions: { id: string; titre: string; status: string }[];
  personnelByEvent: Record<string, ApEventPersonnel[]>;
  note: string;
  teamCount: number;
  dayPlan?: ApDayPlanItem[];
  spaceNames?: Record<string, string>;
};

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function exportAccueilProFeuilleRoutePdf(payload: FeuillePayload): Promise<void> {
  const { dateLabel, events, venues, edl, conventions, personnelByEvent, note, teamCount, dayPlan, spaceNames } = payload;
  const planRows = (dayPlan ?? [])
    .map(item => {
      const where = (item.space_id && spaceNames?.[item.space_id]) || '—';
      return `<tr>
        <td><strong>${esc(formatDayPlanTimeRange(item))}</strong></td>
        <td>${esc(item.title)}</td>
        <td>${esc(item.assignee_name ?? '—')}</td>
        <td>${esc(where)}</td>
      </tr>`;
    })
    .join('');

  const chrono = [...events]
    .sort((a, b) => (a.heure_debut ?? '').localeCompare(b.heure_debut ?? ''))
    .map(ev => {
      const team = (personnelByEvent[ev.id] ?? [])
        .map(p => `${esc(p.name)}${p.day_role ? ` (${esc(p.day_role)})` : ''}`)
        .join(', ');
      return `<tr>
        <td><strong>${esc(ev.heure_debut ?? '—')} → ${esc(ev.heure_fin ?? '—')}</strong></td>
        <td>${esc(ev.name)}<br/><span style="color:#888;font-size:11px">${esc(ev.type ?? '')} · ${esc(ev.status)}</span></td>
        <td>${esc(ev.organisateur ?? '—')}</td>
        <td>${team || '—'}</td>
      </tr>`;
    })
    .join('');

  const edlRows = edl
    .map(i => `<tr><td>${esc(i.type)}</td><td>${esc(i.status)}</td><td>${esc(i.inspection_date ?? i.updated_at?.slice(0, 10) ?? '—')}</td></tr>`)
    .join('');

  const convRows = conventions
    .map(c => `<tr><td>${esc(c.titre)}</td><td>${esc(c.status)}</td></tr>`)
    .join('');

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"/>
<style>
body{font-family:system-ui,sans-serif;color:#1A2744;padding:32px;font-size:13px}
h1{font-size:24px;margin:0 0 4px} .sub{color:#888;font-size:12px}
.stats{display:flex;gap:12px;margin:20px 0} .stat{flex:1;border:1px solid #E5E0D4;border-radius:8px;padding:12px;text-align:center}
.stat b{font-size:28px;color:#C8973A;display:block}
table{width:100%;border-collapse:collapse;margin-top:8px} td,th{border-bottom:1px solid #F0EDE5;padding:8px 4px;text-align:left;font-size:12px}
.notes{background:#F7F4EE;border-radius:8px;padding:14px;min-height:60px;white-space:pre-wrap}
</style></head><body>
<h1>Feuille de route</h1>
<p class="sub">Journée du ${esc(dateLabel)} · généré ${esc(new Date().toLocaleString('fr-FR'))}</p>
<div class="stats">
  <div class="stat"><b>${events.length}</b>Événement(s)</div>
  <div class="stat"><b>${venues.length}</b>Lieu(x)</div>
  <div class="stat"><b>${teamCount}</b>Équipe lieu</div>
  <div class="stat"><b>${edl.length}</b>EDL</div>
  <div class="stat"><b>${conventions.length}</b>Convention(s)</div>
</div>
<h2>Planning détaillé (quoi · qui · où · quand)</h2>
<table><thead><tr><th>Quand</th><th>Quoi</th><th>Qui</th><th>Où</th></tr></thead><tbody>${planRows || '<tr><td colspan="4">Aucune ligne — complétez le planning du jour dans l’app.</td></tr>'}</tbody></table>
<h2>Événements du jour</h2>
<table><thead><tr><th>Horaires</th><th>Événement</th><th>Organisateur</th><th>Équipe jour J</th></tr></thead><tbody>${chrono || '<tr><td colspan="4">Aucun</td></tr>'}</tbody></table>
<h2>États des lieux</h2>
<table><thead><tr><th>Type</th><th>Statut</th><th>Date</th></tr></thead><tbody>${edlRows || '<tr><td colspan="3">Aucun</td></tr>'}</tbody></table>
<h2>Conventions</h2>
<table><thead><tr><th>Titre</th><th>Statut</th></tr></thead><tbody>${convRows || '<tr><td colspan="2">Aucune</td></tr>'}</tbody></table>
<h2>Lieux & sécurité</h2>
${venues.map(v => `<p><strong>${esc(v.name)}</strong> — ERP ${esc(v.erp_type ?? '?')} · ${esc(v.fire_notes ?? '')}</p>`).join('') || '<p>Aucun lieu</p>'}
<h2>Notes régisseur</h2>
<div class="notes">${esc(note.trim() || 'Aucune note.')}</div>
<p style="margin-top:32px;font-size:11px;color:#999">Accueil Pro — document interne</p>
</body></html>`;

  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Feuille de route — ${dateLabel}` });
  }
}

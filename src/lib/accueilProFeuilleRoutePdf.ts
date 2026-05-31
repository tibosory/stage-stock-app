import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { FeuilleRouteEventSnapshot, FeuilleRouteSnapshot } from './accueilProFeuilleRouteBuilder';
import { formatDayPlanTimeRange } from './accueilProDayPlanHelpers';

type FeuillePdfPayload = FeuilleRouteSnapshot & { note?: string };

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function eventMetaLine(label: string, value: string): string {
  if (!value.trim() || value === '—') return '';
  return `<tr><td class="lbl">${esc(label)}</td><td>${esc(value)}</td></tr>`;
}

function renderEventBlock(block: FeuilleRouteSnapshot['eventBlocks'][number]): string {
  const ev = block.event;
  const hours = `${ev.heure_debut ?? '—'} → ${ev.heure_fin ?? '—'}`;
  const dates =
    ev.date_fin && ev.date_fin !== ev.date_debut ?
      `${ev.date_debut} → ${ev.date_fin}`
    : ev.date_debut;

  const metaRows = [
    eventMetaLine('Organisation', block.organizationName),
    eventMetaLine('Lieu', block.venueName),
    eventMetaLine('Espaces', block.spacesLabel),
    eventMetaLine('Dates', dates),
    eventMetaLine('Horaires', hours),
    eventMetaLine('Participants', ev.participants != null ? String(ev.participants) : ''),
    eventMetaLine('Type / statut', `${ev.type ?? '—'} · ${ev.status}`),
  ].join('');

  const description =
    ev.description?.trim() ?
      `<p class="desc"><strong>Description</strong><br/>${esc(ev.description.trim())}</p>`
    : '';

  const teamRows = block.personnel
    .map(p => {
      const contact = [p.phone, p.email].filter(Boolean).join(' · ');
      return `<tr>
        <td>${esc(p.name)}</td>
        <td>${esc(p.role ?? '—')}</td>
        <td>${esc(contact || '—')}</td>
      </tr>`;
    })
    .join('');

  const agendaRows = block.agenda
    .map(item => {
      const where =
        (item.space_id && block.spaces.find(s => s.id === item.space_id)?.name) || '—';
      return `<tr>
        <td><strong>${esc(formatDayPlanTimeRange(item))}</strong></td>
        <td>${esc(item.title)}</td>
        <td>${esc(item.assignee_name ?? '—')}</td>
        <td>${esc(where)}</td>
      </tr>`;
    })
    .join('');

  const convRows = block.conventions
    .map(c => `<tr><td>${esc(c.titre)}</td><td>${esc(c.status)}</td></tr>`)
    .join('');

  const edlRows = block.inspections
    .map(i =>
      `<tr><td>${esc(i.spaceName)}</td><td>${esc(i.type)}</td><td>${esc(i.status)}</td><td>${esc(i.date)}</td></tr>`
    )
    .join('');

  const readinessLabels: Record<string, string> = {
    convention_signed: 'Convention signée',
    org_docs: 'Documents portail',
    edl_entry: 'EDL entrée',
    edl_exit: 'EDL sortie',
    team: 'Équipe jour J',
    briefing_done: 'Briefing équipe',
    access_ok: 'Accès / clés / alarme',
  };
  const readinessList = block.readinessSummary
    .map(line => {
      const [id, state] = line.split(':');
      const label = readinessLabels[id] ?? id;
      const mark = state === 'ok' ? '✓' : state === 'partial' ? '◐' : '○';
      return `<li>${mark} ${esc(label)}</li>`;
    })
    .join('');

  const materialHtml =
    block.venueEquipment.trim() || block.materialRows.length > 0 ?
      `<h3>Matériel & consignes</h3>
    ${
      block.venueEquipment.trim() ?
        `<p class="desc"><strong>Lieu</strong><br/>${esc(block.venueEquipment.trim())}</p>`
      : ''
    }
    ${
      block.materialRows.length > 0 ?
        `<table><thead><tr><th>Espace</th><th>Matériel / consignes</th></tr></thead><tbody>${block.materialRows
          .map(
            row =>
              `<tr><td><strong>${esc(row.spaceName)}</strong></td><td style="white-space:pre-wrap">${esc(row.equipment)}</td></tr>`
          )
          .join('')}</tbody></table>`
      : ''
    }`
    : '';

  return `<div class="event-block">
    <h2>${esc(ev.name)}</h2>
    <table class="meta">${metaRows}</table>
    ${description}
    ${materialHtml}
    <h3>Prêt à accueillir (${block.readinessScore}%)</h3>
    <ul>${readinessList || '<li>Aucune donnée</li>'}</ul>
    <h3>Équipe jour J</h3>
    <table><thead><tr><th>Nom</th><th>Rôle / mission</th><th>Coordonnées</th></tr></thead>
    <tbody>${teamRows || '<tr><td colspan="3">Aucun membre renseigné</td></tr>'}</tbody></table>
    <h3>Agenda de l’événement</h3>
    <table><thead><tr><th>Quand</th><th>Quoi</th><th>Qui</th><th>Où</th></tr></thead>
    <tbody>${agendaRows || '<tr><td colspan="4">Aucun créneau</td></tr>'}</tbody></table>
    ${
      block.conventions.length > 0 ?
        `<h3>Conventions</h3>
    <table><thead><tr><th>Titre</th><th>Statut</th></tr></thead><tbody>${convRows}</tbody></table>`
      : ''
    }
    ${
      block.inspections.length > 0 ?
        `<h3>États des lieux</h3>
    <table><thead><tr><th>Espace</th><th>Type</th><th>Statut</th><th>Date</th></tr></thead><tbody>${edlRows}</tbody></table>`
      : ''
    }
  </div>`;
}

export async function exportAccueilProFeuilleRoutePdf(payload: FeuillePdfPayload): Promise<void> {
  const { dateLabel, eventBlocks, venues, note, venueTeamCount, dayPlan, spaceNames } = payload;
  const noteText = (payload.note ?? note ?? '').trim();
  const edlCount = eventBlocks.reduce((n, b) => n + b.inspections.length, 0);
  const convCount = eventBlocks.reduce((n, b) => n + b.conventions.length, 0);

  const planRows = dayPlan
    .map(item => {
      const where = (item.space_id && spaceNames[item.space_id]) || '—';
      return `<tr>
        <td><strong>${esc(formatDayPlanTimeRange(item))}</strong></td>
        <td>${esc(item.title)}</td>
        <td>${esc(item.assignee_name ?? '—')}</td>
        <td>${esc(where)}</td>
      </tr>`;
    })
    .join('');

  const eventSections = eventBlocks.map(renderEventBlock).join('');

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"/>
<style>
body{font-family:system-ui,sans-serif;color:#1A2744;padding:32px;font-size:13px;line-height:1.45}
h1{font-size:24px;margin:0 0 4px} .sub{color:#888;font-size:12px}
.stats{display:flex;gap:12px;margin:20px 0;flex-wrap:wrap} .stat{flex:1;min-width:90px;border:1px solid #E5E0D4;border-radius:8px;padding:12px;text-align:center}
.stat b{font-size:28px;color:#C8973A;display:block}
h2{font-size:17px;margin:24px 0 8px;color:#1A2744;border-bottom:2px solid #C8973A;padding-bottom:4px}
h3{font-size:13px;margin:14px 0 6px;color:#555;text-transform:uppercase;letter-spacing:.04em}
table{width:100%;border-collapse:collapse;margin-top:4px} td,th{border-bottom:1px solid #F0EDE5;padding:7px 4px;text-align:left;font-size:12px;vertical-align:top}
.meta td.lbl{color:#888;width:120px;font-size:11px;text-transform:uppercase}
.event-block{margin-bottom:28px;padding-bottom:20px;border-bottom:1px dashed #E5E0D4;page-break-inside:avoid}
.desc{background:#F7F4EE;border-radius:8px;padding:10px;margin:10px 0;font-size:12px}
.notes{background:#F7F4EE;border-radius:8px;padding:14px;min-height:60px;white-space:pre-wrap}
</style></head><body>
<h1>Feuille de route</h1>
<p class="sub">Journée du ${esc(dateLabel)} · généré ${esc(new Date().toLocaleString('fr-FR'))}</p>
<div class="stats">
  <div class="stat"><b>${eventBlocks.length}</b>Événement(s)</div>
  <div class="stat"><b>${venues.length}</b>Lieu(x)</div>
  <div class="stat"><b>${venueTeamCount}</b>Équipe lieu</div>
  <div class="stat"><b>${edlCount}</b>EDL</div>
  <div class="stat"><b>${convCount}</b>Convention(s)</div>
</div>
<h2>Planning global du jour</h2>
<table><thead><tr><th>Quand</th><th>Quoi</th><th>Qui</th><th>Où</th></tr></thead>
<tbody>${planRows || '<tr><td colspan="4">Aucune ligne — complétez le planning du jour dans l’app.</td></tr>'}</tbody></table>
<h2>Synthèse par événement</h2>
${eventSections || '<p>Aucun événement ce jour-là.</p>'}
<h2>Lieux & sécurité</h2>
${venues.map(v => `<p><strong>${esc(v.name)}</strong> — ERP ${esc(v.erp_type ?? '?')} · ${esc(v.fire_notes ?? '')}</p>`).join('') || '<p>Aucun lieu</p>'}
<h2>Notes régisseur</h2>
<div class="notes">${esc(noteText || 'Aucune note.')}</div>
<p style="margin-top:32px;font-size:11px;color:#999">Accueil Pro — document interne</p>
</body></html>`;

  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Feuille de route — ${dateLabel}` });
  }
}

type FeuilleEventPdfPayload = FeuilleRouteEventSnapshot & { note?: string };

export async function exportAccueilProFeuilleRouteEventPdf(payload: FeuilleEventPdfPayload): Promise<void> {
  const noteText = (payload.note ?? payload.block.event.feuille_note ?? '').trim();
  const eventSection = renderEventBlock(payload.block);
  const venueBlock =
    payload.venue ?
      `<h2>Lieu & sécurité</h2>
<p><strong>${esc(payload.venue.name)}</strong> — ERP ${esc(payload.venue.erp_type ?? '?')} · ${esc(payload.venue.fire_notes ?? '')}</p>`
    : '';

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"/>
<style>
body{font-family:system-ui,sans-serif;color:#1A2744;padding:32px;font-size:13px;line-height:1.45}
h1{font-size:22px;margin:0 0 4px} .sub{color:#888;font-size:12px}
h2{font-size:17px;margin:24px 0 8px;color:#1A2744;border-bottom:2px solid #C8973A;padding-bottom:4px}
.notes{background:#F7F4EE;border-radius:8px;padding:14px;min-height:60px;white-space:pre-wrap}
</style></head><body>
<h1>${esc(payload.title)}</h1>
<p class="sub">Feuille de route · ${esc(payload.datesLabel)} · généré ${esc(new Date().toLocaleString('fr-FR'))}</p>
${eventSection}
${venueBlock}
<h2>Notes régisseur</h2>
<div class="notes">${esc(noteText || 'Aucune note.')}</div>
<p style="margin-top:32px;font-size:11px;color:#999">Accueil Pro — document interne</p>
</body></html>`;

  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: payload.title,
    });
  }
}

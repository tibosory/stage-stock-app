import {
  findApRoomInspection,
  getApEvent,
  getApOrganization,
  getApVenue,
  resolveSpacesForEvent,
} from '../db/accueilProDb';
import type { ApEvent, ApInspectionKind, ApRoomInspection, ApSpace } from '../types/accueilPro';
import {
  parsePhotosJson,
  parseVerificationsJson,
  resolveInspectionChecksForSpace,
} from '../modules/accueilpro/constants/inspectionChecklist';

export type InspectionProblemRow = {
  spaceId: string;
  spaceName: string;
  inspectionType: ApInspectionKind;
  checkId: string;
  checkLabel: string;
  status: 'ko' | 'na';
};

export type InspectionReportPayload = {
  event: ApEvent;
  venueName: string;
  organizationName: string;
  spaces: ApSpace[];
  inspections: ApRoomInspection[];
  problems: InspectionProblemRow[];
  comments: { spaceName: string; inspectionType: ApInspectionKind; text: string }[];
  photoCounts: { spaceName: string; inspectionType: ApInspectionKind; count: number }[];
  missingEntry: string[];
  missingExit: string[];
};

function labelForCheck(space: ApSpace, checkId: string): string {
  const defs = resolveInspectionChecksForSpace(space);
  return defs.find(d => d.id === checkId)?.label ?? checkId.replace(/_/g, ' ');
}

async function loadInspection(
  eventId: string,
  spaceId: string,
  type: ApInspectionKind
): Promise<ApRoomInspection | null> {
  return findApRoomInspection(eventId, spaceId, type);
}

export async function buildInspectionProblemReport(eventId: string): Promise<InspectionReportPayload | null> {
  const event = await getApEvent(eventId);
  if (!event) return null;

  const [spaces, venue, org] = await Promise.all([
    resolveSpacesForEvent(event),
    event.venue_id ? getApVenue(event.venue_id) : Promise.resolve(null),
    event.organization_id ? getApOrganization(event.organization_id) : Promise.resolve(null),
  ]);

  const problems: InspectionProblemRow[] = [];
  const comments: InspectionReportPayload['comments'] = [];
  const photoCounts: InspectionReportPayload['photoCounts'] = [];
  const missingEntry: string[] = [];
  const missingExit: string[] = [];
  const inspections: ApRoomInspection[] = [];

  for (const space of spaces) {
    for (const type of ['entrée', 'sortie'] as const) {
      const insp = await loadInspection(eventId, space.id, type);
      if (!insp) {
        if (type === 'entrée') missingEntry.push(space.name);
        else missingExit.push(space.name);
        continue;
      }
      inspections.push(insp);
      const checks = parseVerificationsJson(insp.verifications);
      for (const [checkId, status] of Object.entries(checks)) {
        if (status !== 'ko') continue;
        problems.push({
          spaceId: space.id,
          spaceName: space.name,
          inspectionType: type,
          checkId,
          checkLabel: labelForCheck(space, checkId),
          status: 'ko',
        });
      }
      if (insp.commentaire?.trim()) {
        comments.push({
          spaceName: space.name,
          inspectionType: type,
          text: insp.commentaire.trim(),
        });
      }
      const nPhotos = parsePhotosJson(insp.photos).length;
      if (nPhotos > 0) {
        photoCounts.push({ spaceName: space.name, inspectionType: type, count: nPhotos });
      }
    }
  }

  return {
    event,
    venueName: venue?.name ?? '—',
    organizationName: org?.name ?? event.organisateur ?? '—',
    spaces,
    inspections,
    problems,
    comments,
    photoCounts,
    missingEntry,
    missingExit,
  };
}

export function inspectionReportEmailBody(payload: InspectionReportPayload): string {
  const lines: string[] = [
    `État des lieux — ${payload.event.name}`,
    `Date : ${payload.event.date_debut}${payload.event.heure_debut ? ` · ${payload.event.heure_debut}` : ''}`,
    `Lieu : ${payload.venueName}`,
    `Organisation : ${payload.organizationName}`,
    '',
  ];

  if (payload.problems.length === 0 && payload.comments.length === 0) {
    lines.push('Aucune anomalie signalée (points KO) sur les EDL enregistrés.');
  } else {
    lines.push('Anomalies (points KO) :');
    for (const p of payload.problems) {
      lines.push(
        `• ${p.spaceName} — EDL ${p.inspectionType} — ${p.checkLabel}`
      );
    }
  }

  if (payload.comments.length > 0) {
    lines.push('', 'Commentaires :');
    for (const c of payload.comments) {
      lines.push(`• ${c.spaceName} (${c.inspectionType}) : ${c.text}`);
    }
  }

  if (payload.missingEntry.length > 0) {
    lines.push('', `EDL entrée manquant : ${payload.missingEntry.join(', ')}`);
  }
  if (payload.missingExit.length > 0) {
    lines.push(`EDL sortie manquant : ${payload.missingExit.join(', ')}`);
  }

  lines.push('', '— Rapport généré depuis Accueil Pro / StageStock');
  return lines.join('\n');
}

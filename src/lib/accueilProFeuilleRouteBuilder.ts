import {
  findApRoomInspection,
  getApDayNote,
  getApEvent,
  getApOrganization,
  getApVenue,
  listApConventionsByEvent,
  listApDayPlanItems,
  listApEventPersonnel,
  listApEvents,
  listApInspections,
  listApPersonnel,
  listApVenues,
  listSpaces,
  resolveSpacesForEvent,
} from '../db/accueilProDb';
import { sortDayPlanItems } from './accueilProDayPlanHelpers';
import { feuilleRouteEventTitle, formatApEventDates, eventsOnDate } from './accueilProFeuilleHelpers';
import { buildEventReadinessSnapshot } from './accueilProEventReadiness';
import type {
  ApDayPlanItem,
  ApEvent,
  ApEventPersonnel,
  ApRoomInspection,
  ApSpace,
  ApVenue,
} from '../types/accueilPro';

export type FeuillePersonRow = {
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
};

export type FeuilleInspectionRow = {
  spaceName: string;
  type: string;
  status: string;
  date: string;
};

export type FeuilleEventSynthesis = {
  event: ApEvent;
  organizationName: string;
  venueName: string;
  spaces: ApSpace[];
  spacesLabel: string;
  personnel: FeuillePersonRow[];
  agenda: ApDayPlanItem[];
  conventions: { titre: string; status: string }[];
  inspections: FeuilleInspectionRow[];
  readinessScore: number;
  readinessSummary: string[];
};

export type FeuilleRouteSnapshot = {
  date: string;
  dateLabel: string;
  eventBlocks: FeuilleEventSynthesis[];
  dayPlan: ApDayPlanItem[];
  venues: ApVenue[];
  venueTeamCount: number;
  allInspections: ApRoomInspection[];
  allConventions: { id: string; titre: string; status: string; eventId: string | null }[];
  spaceNames: Record<string, string>;
  note: string;
};

export type FeuilleRouteEventSnapshot = {
  eventId: string;
  title: string;
  datesLabel: string;
  block: FeuilleEventSynthesis;
  venue: ApVenue | null;
  spaceNames: Record<string, string>;
  note: string;
};

function spacesLabelForEvent(event: ApEvent, spaces: ApSpace[]): string {
  if (event.spaces_mode === 'all') return `Tous les espaces (${spaces.length})`;
  const n = spaces.length;
  return n === 1 ? spaces[0]?.name ?? '1 espace' : `${n} espaces sélectionnés`;
}

function mapPersonnel(p: ApEventPersonnel): FeuillePersonRow {
  return {
    name: p.name,
    role: p.day_role ?? p.day_mission ?? null,
    phone: p.phone ?? null,
    email: p.email ?? null,
  };
}

export function feuilleDateLabel(date: string, locale = 'fr-FR'): string {
  try {
    return new Date(date + 'T12:00:00').toLocaleDateString(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return date;
  }
}

async function buildEventSynthesis(
  ev: ApEvent,
  planRows: ApDayPlanItem[]
): Promise<FeuilleEventSynthesis> {
  const [org, venue, spaces, personnel, conventions] = await Promise.all([
    ev.organization_id ? getApOrganization(ev.organization_id) : Promise.resolve(null),
    ev.venue_id ? getApVenue(ev.venue_id) : Promise.resolve(null),
    resolveSpacesForEvent(ev),
    listApEventPersonnel(ev.id),
    listApConventionsByEvent(ev.id),
  ]);
  const agenda = sortDayPlanItems(planRows.filter(item => item.event_id === ev.id));

  const inspections: FeuilleInspectionRow[] = [];
  for (const sp of spaces) {
    for (const type of ['entrée', 'sortie'] as const) {
      const insp = await findApRoomInspection(ev.id, sp.id, type);
      if (!insp) continue;
      inspections.push({
        spaceName: sp.name,
        type,
        status: insp.status,
        date: insp.inspection_date ?? insp.updated_at?.slice(0, 10) ?? '—',
      });
    }
  }

  const readiness = await buildEventReadinessSnapshot(ev.id);
  const readinessSummary = (readiness?.checks ?? [])
    .map(c => `${c.id}:${c.state}`)
    .filter(Boolean);

  return {
    event: ev,
    organizationName: org?.name ?? ev.organisateur ?? '—',
    venueName: venue?.name ?? '—',
    spaces,
    spacesLabel: spacesLabelForEvent(ev, spaces),
    personnel: personnel.map(mapPersonnel),
    agenda,
    conventions: conventions.map(c => ({ titre: c.titre, status: c.status })),
    inspections,
    readinessScore: readiness?.score ?? 0,
    readinessSummary,
  };
}

export async function buildFeuilleRouteEventSnapshot(
  eventId: string,
  locale = 'fr-FR'
): Promise<FeuilleRouteEventSnapshot | null> {
  const ev = await getApEvent(eventId);
  if (!ev || ev.status === 'annulé') return null;

  const planDate = (ev.date_debut ?? '').slice(0, 10);
  const [planRows, venue] = await Promise.all([
    listApDayPlanItems(planDate),
    ev.venue_id ? getApVenue(ev.venue_id) : Promise.resolve(null),
  ]);
  const block = await buildEventSynthesis(ev, planRows);
  const spaceNames = Object.fromEntries(block.spaces.map(s => [s.id, s.name]));

  return {
    eventId: ev.id,
    title: feuilleRouteEventTitle(ev, locale),
    datesLabel: formatApEventDates(ev, locale),
    block,
    venue,
    spaceNames,
    note: ev.feuille_note ?? '',
  };
}

export async function buildFeuilleRouteSnapshot(date: string): Promise<FeuilleRouteSnapshot> {
  const [allEvents, allEdl, planRows, dayNote, venueList] = await Promise.all([
    listApEvents(),
    listApInspections(),
    listApDayPlanItems(date),
    getApDayNote(date),
    listApVenues(),
  ]);

  const dayEvents = eventsOnDate(allEvents, date).sort((a, b) =>
    (a.heure_debut ?? '').localeCompare(b.heure_debut ?? '')
  );

  const spacesByVenue = await Promise.all(venueList.map(v => listSpaces(v.id)));
  const spaceNames = Object.fromEntries(spacesByVenue.flat().map(s => [s.id, s.name]));

  const venueIds = [...new Set(dayEvents.map(e => e.venue_id).filter(Boolean))] as string[];
  const venueRows = (
    await Promise.all(venueIds.map(id => getApVenue(id)))
  ).filter(Boolean) as ApVenue[];

  const venueTeam = await listApPersonnel({ kind: 'lieu' });
  const venueTeamCount = venueTeam.filter(m => venueIds.includes(m.venue_id)).length;

  const eventBlocks: FeuilleEventSynthesis[] = [];
  for (const ev of dayEvents) {
    eventBlocks.push(await buildEventSynthesis(ev, planRows));
  }

  const dayEventIds = new Set(dayEvents.map(e => e.id));
  const allInspections = allEdl.filter(e => e.event_id && dayEventIds.has(e.event_id));
  const allConventions = eventBlocks.flatMap(block =>
    block.conventions.map(c => ({
      id: `${block.event.id}-${c.titre}`,
      titre: c.titre,
      status: c.status,
      eventId: block.event.id,
    }))
  );

  return {
    date,
    dateLabel: feuilleDateLabel(date),
    eventBlocks,
    dayPlan: sortDayPlanItems(planRows),
    venues: venueRows,
    venueTeamCount,
    allInspections,
    allConventions,
    spaceNames,
    note: dayNote?.note ?? '',
  };
}

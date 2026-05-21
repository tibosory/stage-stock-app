/**
 * Détection de chevauchements date/heure/espaces entre événements et demandes de location.
 */
import {
  getApEvent,
  getApRentalRequest,
  listApEvents,
  listApRentalRequests,
  listApSpaces,
} from '../db/accueilProDb';
import type { ApEvent, ApRentalRequest, ApSpacesMode } from '../types/accueilPro';

export type BookingConflictKind = 'event' | 'rental';

export type BookingConflict = {
  kind: BookingConflictKind;
  id: string;
  name: string;
  venueId?: string | null;
  spaceId?: string | null;
  spaceName?: string | null;
  dateDebut: string;
  dateFin?: string | null;
  heureDebut?: string | null;
  heureFin?: string | null;
};

export type BookingDraft = {
  venueId?: string | null;
  spacesMode?: ApSpacesMode | null;
  selectedSpaceIds?: string[] | null;
  dateDebut: string;
  dateFin?: string | null;
  heureDebut?: string | null;
  heureFin?: string | null;
  excludeEventId?: string | null;
  excludeRentalId?: string | null;
};

type TimeRangeMs = { start: number; end: number };

function parseDateYmd(raw: string): Date {
  const d = raw.trim().slice(0, 10);
  return new Date(`${d}T12:00:00`);
}

function parseMinutes(hhmm?: string | null): number | null {
  if (!hhmm?.trim()) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Intervalle calendaire + horaire (fin inclusive sur la journée si heures absentes). */
export function bookingTimeRangeMs(draft: {
  dateDebut: string;
  dateFin?: string | null;
  heureDebut?: string | null;
  heureFin?: string | null;
}): TimeRangeMs | null {
  if (!draft.dateDebut?.trim()) return null;
  const startDay = parseDateYmd(draft.dateDebut);
  const endDay = parseDateYmd(draft.dateFin?.trim() || draft.dateDebut);
  if (Number.isNaN(startDay.getTime()) || Number.isNaN(endDay.getTime())) return null;

  const startMin = parseMinutes(draft.heureDebut) ?? 0;
  const endMin = parseMinutes(draft.heureFin) ?? 23 * 60 + 59;

  const start = new Date(startDay);
  start.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0);

  const end = new Date(endDay);
  end.setHours(Math.floor(endMin / 60), endMin % 60, 59, 999);

  if (end.getTime() < start.getTime()) return null;
  return { start: start.getTime(), end: end.getTime() };
}

export function bookingRangesOverlap(a: TimeRangeMs, b: TimeRangeMs): boolean {
  return a.start < b.end && b.start < a.end;
}

async function resolveSpaceIdsForBooking(
  venueId: string | null | undefined,
  spacesMode: ApSpacesMode | null | undefined,
  selectedSpaceIds: string[] | null | undefined
): Promise<string[]> {
  if (!venueId) return [];
  const mode = spacesMode ?? 'all';
  if (mode === 'all') {
    const all = await listApSpaces(venueId);
    return all.map(s => s.id);
  }
  return [...(selectedSpaceIds ?? [])];
}

function spacesOverlap(
  venueA: string | null | undefined,
  idsA: string[],
  modeA: ApSpacesMode | null | undefined,
  venueB: string | null | undefined,
  idsB: string[],
  modeB: ApSpacesMode | null | undefined
): boolean {
  if (!venueA || !venueB || venueA !== venueB) return false;
  const allA = modeA === 'all' || idsA.length === 0;
  const allB = modeB === 'all' || idsB.length === 0;
  if (allA || allB) return true;
  const setB = new Set(idsB);
  return idsA.some(id => setB.has(id));
}

function eventIsBlocking(ev: ApEvent): boolean {
  return ev.status !== 'annulé' && ev.status !== 'terminé';
}

function rentalIsBlocking(r: ApRentalRequest): boolean {
  return r.status === 'soumise' || r.status === 'validée';
}

function toConflictFromEvent(ev: ApEvent, spaceId?: string | null, spaceName?: string | null): BookingConflict {
  return {
    kind: 'event',
    id: ev.id,
    name: ev.name,
    venueId: ev.venue_id,
    spaceId: spaceId ?? null,
    spaceName: spaceName ?? null,
    dateDebut: ev.date_debut,
    dateFin: ev.date_fin,
    heureDebut: ev.heure_debut,
    heureFin: ev.heure_fin,
  };
}

function toConflictFromRental(r: ApRentalRequest, spaceId?: string | null, spaceName?: string | null): BookingConflict {
  return {
    kind: 'rental',
    id: r.id,
    name: r.event_name?.trim() || 'Demande de location',
    venueId: r.venue_id,
    spaceId: spaceId ?? null,
    spaceName: spaceName ?? null,
    dateDebut: r.date_debut,
    dateFin: r.date_fin,
    heureDebut: r.heure_debut,
    heureFin: r.heure_fin,
  };
}

/** Cherche les chevauchements pour un brouillon (événement ou demande). */
export async function findBookingConflictsForDraft(draft: BookingDraft): Promise<BookingConflict[]> {
  const range = bookingTimeRangeMs(draft);
  if (!range || !draft.venueId) return [];

  const draftSpaceIds = await resolveSpaceIdsForBooking(
    draft.venueId,
    draft.spacesMode,
    draft.selectedSpaceIds
  );
  const draftMode = draft.spacesMode ?? (draftSpaceIds.length ? 'specific' : 'all');

  const spaceNames = Object.fromEntries((await listApSpaces(draft.venueId)).map(s => [s.id, s.name]));
  const conflicts: BookingConflict[] = [];
  const seen = new Set<string>();

  const pushConflict = (c: BookingConflict, overlapSpaceId?: string | null) => {
    const key = `${c.kind}:${c.id}:${overlapSpaceId ?? 'all'}`;
    if (seen.has(key)) return;
    seen.add(key);
    conflicts.push({
      ...c,
      spaceId: overlapSpaceId ?? c.spaceId ?? null,
      spaceName: overlapSpaceId ? (spaceNames[overlapSpaceId] ?? overlapSpaceId) : c.spaceName,
    });
  };

  const [events, rentals] = await Promise.all([listApEvents(), listApRentalRequests()]);

  for (const ev of events) {
    if (draft.excludeEventId && ev.id === draft.excludeEventId) continue;
    if (!eventIsBlocking(ev)) continue;
    if (!ev.venue_id || ev.venue_id !== draft.venueId) continue;
    const otherRange = bookingTimeRangeMs({
      dateDebut: ev.date_debut,
      dateFin: ev.date_fin,
      heureDebut: ev.heure_debut,
      heureFin: ev.heure_fin,
    });
    if (!otherRange || !bookingRangesOverlap(range, otherRange)) continue;

    const otherIds = await resolveSpaceIdsForBooking(ev.venue_id, ev.spaces_mode, ev.selected_space_ids);
    const otherMode = ev.spaces_mode ?? (otherIds.length ? 'specific' : 'all');
    if (!spacesOverlap(draft.venueId, draftSpaceIds, draftMode, ev.venue_id, otherIds, otherMode)) continue;

    const overlapIds =
      draftMode === 'all' || otherMode === 'all'
        ? [...new Set([...draftSpaceIds, ...otherIds])].slice(0, 1)
        : draftSpaceIds.filter(id => otherIds.includes(id));
    const base = toConflictFromEvent(ev);
    if (overlapIds.length === 0) {
      pushConflict(base);
    } else {
      for (const sid of overlapIds) pushConflict(base, sid);
    }
  }

  for (const r of rentals) {
    if (draft.excludeRentalId && r.id === draft.excludeRentalId) continue;
    if (!rentalIsBlocking(r)) continue;
    if (!r.venue_id || r.venue_id !== draft.venueId) continue;
    const otherRange = bookingTimeRangeMs({
      dateDebut: r.date_debut,
      dateFin: r.date_fin,
      heureDebut: r.heure_debut,
      heureFin: r.heure_fin,
    });
    if (!otherRange || !bookingRangesOverlap(range, otherRange)) continue;

    const otherIds = await resolveSpaceIdsForBooking(r.venue_id, r.spaces_mode, r.selected_space_ids);
    const otherMode = r.spaces_mode ?? (otherIds.length ? 'specific' : 'all');
    if (!spacesOverlap(draft.venueId, draftSpaceIds, draftMode, r.venue_id, otherIds, otherMode)) continue;

    const overlapIds =
      draftMode === 'all' || otherMode === 'all'
        ? [...new Set([...draftSpaceIds, ...otherIds])].slice(0, 1)
        : draftSpaceIds.filter(id => otherIds.includes(id));
    const base = toConflictFromRental(r);
    if (overlapIds.length === 0) {
      pushConflict(base);
    } else {
      for (const sid of overlapIds) pushConflict(base, sid);
    }
  }

  return conflicts;
}

/** Conflits avant validation d’une demande → création d’événement. */
export async function findBookingConflictsForRentalValidation(rentalId: string): Promise<BookingConflict[]> {
  const r = await getApRentalRequest(rentalId);
  if (!r) return [];
  return findBookingConflictsForDraft({
    venueId: r.venue_id,
    spacesMode: r.spaces_mode,
    selectedSpaceIds: r.selected_space_ids,
    dateDebut: r.date_debut,
    dateFin: r.date_fin,
    heureDebut: r.heure_debut,
    heureFin: r.heure_fin,
    excludeRentalId: rentalId,
  });
}

/** Conflits pour un événement existant (édition). */
export async function findBookingConflictsForEvent(eventId: string): Promise<BookingConflict[]> {
  const ev = await getApEvent(eventId);
  if (!ev) return [];
  return findBookingConflictsForDraft({
    venueId: ev.venue_id,
    spacesMode: ev.spaces_mode,
    selectedSpaceIds: ev.selected_space_ids,
    dateDebut: ev.date_debut,
    dateFin: ev.date_fin,
    heureDebut: ev.heure_debut,
    heureFin: ev.heure_fin,
    excludeEventId: eventId,
  });
}

export function formatBookingConflictLine(c: BookingConflict): string {
  const when = [c.dateDebut, c.heureDebut].filter(Boolean).join(' ');
  const where = c.spaceName ? ` · ${c.spaceName}` : '';
  const kind = c.kind === 'event' ? 'Événement' : 'Demande';
  return `${kind} « ${c.name} » (${when}${where})`;
}

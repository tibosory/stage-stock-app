import type { ApEvent, ApEventReadinessManual, ApEventStatus } from '../types/accueilPro';
import { eventOverlapsDateRange, eventsOnDate, shiftIsoDate } from './accueilProFeuilleHelpers';

export type EventListFilter = 'today' | 'week' | 'all';

export function isCancelledEvent(event: ApEvent): boolean {
  return event.status === 'annulé';
}

export function filterEventsList(
  events: ApEvent[],
  filter: EventListFilter,
  refDate?: string
): ApEvent[] {
  const today = (refDate ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
  let rows = events.filter(e => !isCancelledEvent(e));

  if (filter === 'today') {
    rows = eventsOnDate(rows, today);
  } else if (filter === 'week') {
    const end = shiftIsoDate(today, 6);
    rows = rows.filter(e => eventOverlapsDateRange(e, today, end));
  }

  return rows.sort((a, b) => {
    const dc = (a.date_debut ?? '').localeCompare(b.date_debut ?? '');
    if (dc !== 0) return dc;
    return (a.heure_debut ?? '').localeCompare(b.heure_debut ?? '');
  });
}

export const AP_EVENT_STATUS_OPTIONS: ApEventStatus[] = ['brouillon', 'confirmé', 'annulé', 'terminé'];

export function eventStatusLabelKey(status: ApEventStatus): string {
  return `accueilpro.events.status.${status}`;
}

export function parseReadinessManual(raw: ApEventReadinessManual | null | undefined): ApEventReadinessManual {
  return raw ?? {};
}

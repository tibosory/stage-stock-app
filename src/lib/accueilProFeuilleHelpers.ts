import type { AppLanguage } from '../i18n/strings';
import type { ApEvent } from '../types/accueilPro';

/** Événements actifs sur une date ISO (YYYY-MM-DD). */
export function eventsOnDate(
  events: ApEvent[],
  dateYmd: string,
  opts?: { includeCancelled?: boolean }
): ApEvent[] {
  const d = dateYmd.trim().slice(0, 10);
  if (!d) return [];
  return events.filter(e => {
    if (!opts?.includeCancelled && e.status === 'annulé') return false;
    const start = (e.date_debut ?? '').slice(0, 10);
    const end = (e.date_fin ?? e.date_debut ?? '').slice(0, 10);
    return start <= d && end >= d;
  });
}

export function eventOverlapsDateRange(
  event: ApEvent,
  fromYmd: string,
  toYmd: string,
  opts?: { includeCancelled?: boolean }
): boolean {
  if (!opts?.includeCancelled && event.status === 'annulé') return false;
  const start = (event.date_debut ?? '').slice(0, 10);
  const end = (event.date_fin ?? event.date_debut ?? '').slice(0, 10);
  return start <= toYmd && end >= fromYmd;
}

export function shiftIsoDate(dateYmd: string, deltaDays: number): string {
  const base = new Date(`${dateYmd.trim().slice(0, 10)}T12:00:00`);
  if (Number.isNaN(base.getTime())) return dateYmd;
  base.setDate(base.getDate() + deltaDays);
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, '0');
  const day = String(base.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function apEventDateLocale(language: AppLanguage): string {
  switch (language) {
    case 'en':
      return 'en-GB';
    case 'es':
      return 'es-ES';
    case 'de':
      return 'de-DE';
    case 'it':
      return 'it-IT';
    case 'pt':
      return 'pt-PT';
    default:
      return 'fr-FR';
  }
}

/** Dates affichées pour une feuille de route (ex. « 21 mai 2026 » ou plage). */
export function formatApEventDates(event: ApEvent, locale = 'fr-FR'): string {
  const start = (event.date_debut ?? '').slice(0, 10);
  const end = (event.date_fin ?? event.date_debut ?? '').slice(0, 10);
  const fmt = (ymd: string) => {
    try {
      return new Date(`${ymd}T12:00:00`).toLocaleDateString(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return ymd;
    }
  };
  if (!start) return '—';
  if (end && end !== start) return `${fmt(start)} → ${fmt(end)}`;
  return fmt(start);
}

/** Titre affiché d’une feuille de route : nom de l’événement + dates. */
export function feuilleRouteEventTitle(event: ApEvent, locale = 'fr-FR'): string {
  const name = event.name?.trim() || '—';
  return `${name} — ${formatApEventDates(event, locale)}`;
}

export function sortEventsChronologically(events: ApEvent[]): ApEvent[] {
  return [...events].sort((a, b) => {
    const byDate = (a.date_debut ?? '').localeCompare(b.date_debut ?? '');
    if (byDate !== 0) return byDate;
    return (a.heure_debut ?? '').localeCompare(b.heure_debut ?? '');
  });
}

/** Événements éligibles à une feuille de route (hors annulés), ordre chronologique. */
export function eventsForFeuilleRouteList(events: ApEvent[]): ApEvent[] {
  return sortEventsChronologically(events.filter(e => e.status !== 'annulé'));
}

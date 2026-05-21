import type { ApEvent } from '../types/accueilPro';

/** Événements actifs sur une date ISO (YYYY-MM-DD). */
export function eventsOnDate(events: ApEvent[], dateYmd: string): ApEvent[] {
  const d = dateYmd.trim().slice(0, 10);
  if (!d) return [];
  return events.filter(e => {
    const start = (e.date_debut ?? '').slice(0, 10);
    const end = (e.date_fin ?? e.date_debut ?? '').slice(0, 10);
    return start <= d && end >= d;
  });
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

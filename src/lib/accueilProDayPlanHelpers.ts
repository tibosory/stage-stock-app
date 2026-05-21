import type { ApDayPlanItem } from '../types/accueilPro';

export function sortDayPlanItems(items: ApDayPlanItem[]): ApDayPlanItem[] {
  return [...items].sort((a, b) => {
    const ta = a.time_start ?? '99:99';
    const tb = b.time_start ?? '99:99';
    if (ta !== tb) return ta.localeCompare(tb);
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });
}

export function formatDayPlanTimeRange(item: ApDayPlanItem): string {
  if (item.time_start && item.time_end) return `${item.time_start} – ${item.time_end}`;
  if (item.time_start) return item.time_start;
  if (item.time_end) return `→ ${item.time_end}`;
  return '—';
}

import type { ApEventPersonnel } from '../types/accueilPro';

function phoneKey(phone: string): string {
  let key = phone.replace(/[^\d+]/g, '').replace(/^00/, '+');
  if (/^0\d{9}$/.test(key)) key = `+33${key.slice(1)}`;
  return key;
}

export type EventTeamSmsRecipient = { name: string; phone: string };
export type EventTeamSmsSkipped = { name: string };

/** Déduplique les numéros et sépare les membres sans mobile utilisable. */
export function listEventTeamSmsRecipients(team: ApEventPersonnel[]): {
  withPhone: EventTeamSmsRecipient[];
  withoutPhone: EventTeamSmsSkipped[];
} {
  const seen = new Set<string>();
  const withPhone: EventTeamSmsRecipient[] = [];
  const withoutPhone: EventTeamSmsSkipped[] = [];

  for (const m of team) {
    const name = m.name.trim() || '—';
    const raw = m.phone?.trim();
    const digits = raw?.replace(/\D/g, '') ?? '';
    if (!raw || digits.length < 6) {
      withoutPhone.push({ name });
      continue;
    }
    const key = phoneKey(raw);
    if (seen.has(key)) continue;
    seen.add(key);
    withPhone.push({ name, phone: raw });
  }

  return { withPhone, withoutPhone };
}

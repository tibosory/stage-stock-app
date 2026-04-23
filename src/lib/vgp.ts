import { format, parseISO, addDays, isValid } from 'date-fns';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Materiel } from '../types';

export function isVgpActif(m: Materiel): boolean {
  const v = (m as any).vgp_actif;
  return v === 1 || v === true;
}

/** Équipement suivi dans la zone EPI (contrôle EPI distinct des autres VGP). */
export function isVgpEpi(m: Materiel): boolean {
  const v = (m as any).vgp_epi;
  return v === 1 || v === true;
}

/** Alerte : à traiter dans les N jours, en retard, ou configuration incomplète. */
export function shouldAlertVgp(m: Materiel, fenetreJours: number): boolean {
  if (!isVgpActif(m)) return false;
  const per = m.vgp_periodicite_jours ?? 0;
  if (per <= 0) return true;
  const prochaine = computeVgpProchaineDate(m);
  if (!prochaine) return true;
  const dueStr = format(prochaine, 'yyyy-MM-dd');
  const limit = addDays(new Date(), fenetreJours);
  return dueStr <= format(limit, 'yyyy-MM-dd');
}

/** Prochaine échéance théorique (dernière visite + périodicité). Sans date de dernière visite : considéré comme à planifier. */
export function computeVgpProchaineDate(m: Materiel): Date | null {
  const jours = m.vgp_periodicite_jours;
  if (jours == null || jours <= 0) return null;
  const raw = m.vgp_derniere_visite?.trim();
  if (!raw) return null;
  const base = raw.includes('T') ? parseISO(raw) : parseISO(`${raw}T12:00:00`);
  if (!isValid(base)) return null;
  return addDays(base, jours);
}

/** Date limite à afficher : prochaine échéance ou null si incomplet. */
export function vgpProchaineEcheanceIso(m: Materiel): string | null {
  const d = computeVgpProchaineDate(m);
  return d ? format(d, 'yyyy-MM-dd') : null;
}

/** True si la visite est due (échéance passée ou aujourd’hui). */
export function isVgpEnRetard(m: Materiel): boolean {
  const iso = vgpProchaineEcheanceIso(m);
  if (!iso) return !!(m.vgp_periodicite_jours && m.vgp_periodicite_jours > 0 && !m.vgp_derniere_visite?.trim());
  const today = new Date().toISOString().split('T')[0];
  return iso <= today;
}

function icsEscape(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

function foldIcsLine(line: string): string {
  if (line.length <= 72) return line;
  let out = line.slice(0, 72);
  let rest = line.slice(72);
  while (rest.length) {
    out += `\r\n ${rest.slice(0, 71)}`;
    rest = rest.slice(71);
  }
  return out;
}

/** Génère un calendrier ICS (une journée entière par prochaine échéance VGP). */
export function buildVgpIcsCalendar(items: Materiel[], calName: string = 'Stage Stock — VGP'): string {
  const now = new Date();
  const stamp = format(now, "yyyyMMdd'T'HHmmss'Z'");
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//StageStock//VGP//FR',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${icsEscape(calName)}`,
  ];

  for (const m of items) {
    if (!isVgpActif(m)) continue;
    const jours = m.vgp_periodicite_jours;
    if (jours == null || jours <= 0) continue;
    let due = computeVgpProchaineDate(m);
    if (!due) {
      const today = new Date();
      today.setHours(12, 0, 0, 0);
      due = today;
    }
    const dayStr = format(due, 'yyyyMMdd');
    const uid = `vgp-${m.id}-${dayStr}@stagestock.local`;
    const summary = isVgpEpi(m) ? `VGP EPI — ${m.nom}` : `VGP — ${m.nom}`;
    const desc = [m.vgp_libelle, m.marque, m.numero_serie].filter(Boolean).join(' · ');
    lines.push('BEGIN:VEVENT');
    lines.push(foldIcsLine(`UID:${uid}`));
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART;VALUE=DATE:${dayStr}`);
    lines.push(`DTEND;VALUE=DATE:${format(addDays(due, 1), 'yyyyMMdd')}`);
    lines.push(foldIcsLine(`SUMMARY:${icsEscape(summary)}`));
    if (desc) lines.push(foldIcsLine(`DESCRIPTION:${icsEscape(desc)}`));
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

export async function shareVgpIcsFile(items: Materiel[]): Promise<void> {
  const ics = buildVgpIcsCalendar(items);
  const base = FileSystem.cacheDirectory;
  if (!base) throw new Error('Cache indisponible');
  const path = `${base}stagestock_vgp_controles.ics`;
  await FileSystem.writeAsStringAsync(path, ics, { encoding: FileSystem.EncodingType.UTF8 });
  const can = await Sharing.isAvailableAsync();
  if (can) {
    await Sharing.shareAsync(path, {
      mimeType: 'text/calendar',
      UTI: 'public.calendar-event',
      dialogTitle: 'Exporter VGP (.ics)',
    });
  }
}

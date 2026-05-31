import type { ApEventPersonnel, ApOrganizationContact, ApPersonnel } from '../types/accueilPro';

export type ContactDisplayLine = { label: string; value: string };

export type ContactFieldLabels = {
  role: string;
  mission: string;
  phone: string;
  email: string;
  address: string;
  kind: string;
  venue: string;
  dayRole: string;
  dayMission: string;
  primary: string;
};

function pushLine(lines: ContactDisplayLine[], label: string, value?: string | null) {
  const v = value?.trim();
  if (v) lines.push({ label, value: v });
}

export function contactFieldLabelsFromT(t: (key: string) => string): ContactFieldLabels {
  return {
    role: t('accueilpro.contacts.fieldRole'),
    mission: t('accueilpro.contacts.fieldMission'),
    phone: t('accueilpro.field.phone'),
    email: t('accueilpro.field.email'),
    address: t('accueilpro.field.address'),
    kind: t('accueilpro.personnel.kind'),
    venue: t('accueilpro.contacts.fieldVenue'),
    dayRole: t('accueilpro.eventTeam.dayRole'),
    dayMission: t('accueilpro.eventTeam.dayMission'),
    primary: t('accueilpro.contacts.primary'),
  };
}

export function organizationContactLines(
  c: ApOrganizationContact,
  labels: Pick<ContactFieldLabels, 'role' | 'phone' | 'email'>
): ContactDisplayLine[] {
  const lines: ContactDisplayLine[] = [];
  pushLine(lines, labels.role, c.role);
  pushLine(lines, labels.phone, c.phone);
  pushLine(lines, labels.email, c.email);
  return lines;
}

export function personnelContactLines(
  p: ApPersonnel,
  labels: ContactFieldLabels,
  opts?: { venueName?: string; kindLabel?: string }
): ContactDisplayLine[] {
  const lines: ContactDisplayLine[] = [];
  pushLine(lines, labels.role, p.role);
  pushLine(lines, labels.mission, p.mission);
  pushLine(lines, labels.phone, p.phone);
  pushLine(lines, labels.email, p.email);
  pushLine(lines, labels.address, p.address);
  if (opts?.kindLabel) pushLine(lines, labels.kind, opts.kindLabel);
  if (opts?.venueName) pushLine(lines, labels.venue, opts.venueName);
  return lines;
}

export function eventPersonnelContactLines(
  p: ApEventPersonnel,
  labels: Pick<ContactFieldLabels, 'dayRole' | 'dayMission' | 'phone' | 'email'>
): ContactDisplayLine[] {
  const lines: ContactDisplayLine[] = [];
  pushLine(lines, labels.dayRole, p.day_role);
  pushLine(lines, labels.dayMission, p.day_mission);
  pushLine(lines, labels.phone, p.phone);
  pushLine(lines, labels.email, p.email);
  return lines;
}

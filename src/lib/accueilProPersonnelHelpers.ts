import type { ApPersonnel } from '../types/accueilPro';

export function buildPersonnelDisplayName(parts: {
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
}): string {
  const fn = parts.first_name?.trim() ?? '';
  const ln = parts.last_name?.trim() ?? '';
  const combined = [fn, ln].filter(Boolean).join(' ').trim();
  if (combined) return combined;
  return parts.name?.trim() ?? '';
}

export function personnelDisplayName(p: Pick<ApPersonnel, 'name' | 'first_name' | 'last_name'>): string {
  return buildPersonnelDisplayName(p);
}

export function isPersonnelPermanent(p: Pick<ApPersonnel, 'role_permanent'>): boolean {
  return !!p.role_permanent;
}

export function comparePersonnelByName(
  a: Pick<ApPersonnel, 'name' | 'first_name' | 'last_name'>,
  b: Pick<ApPersonnel, 'name' | 'first_name' | 'last_name'>
): number {
  return personnelDisplayName(a).localeCompare(personnelDisplayName(b), 'fr', { sensitivity: 'base' });
}

/** Équipe permanente en tête, puis le reste — chaque groupe par ordre alphabétique. */
export function sortPersonnelForDirectory<T extends Pick<ApPersonnel, 'name' | 'first_name' | 'last_name' | 'role_permanent'>>(
  rows: T[]
): T[] {
  const permanent = rows.filter(isPersonnelPermanent).sort(comparePersonnelByName);
  const others = rows.filter(p => !isPersonnelPermanent(p)).sort(comparePersonnelByName);
  return [...permanent, ...others];
}

export function partitionPersonnelForDirectory<T extends Pick<ApPersonnel, 'name' | 'first_name' | 'last_name' | 'role_permanent'>>(
  rows: T[]
): { permanent: T[]; others: T[] } {
  return {
    permanent: rows.filter(isPersonnelPermanent).sort(comparePersonnelByName),
    others: rows.filter(p => !isPersonnelPermanent(p)).sort(comparePersonnelByName),
  };
}

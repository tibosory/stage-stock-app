export function clampRappelJoursAvant(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(365, Math.max(1, Math.floor(n)));
}

export function shouldPromoteDemandeToEnCours(previousStatut: string | undefined, nextStatut: unknown): boolean {
  return previousStatut === 'en demande' && nextStatut === 'en cours';
}

export function shouldCleanupDemandeOnCancel(previousStatut: string | undefined, nextStatut: unknown): boolean {
  return previousStatut === 'en demande' && nextStatut === 'annulé';
}

export function resolveRetourReelDate(retourReel: string | null | undefined, nowIso: string): string {
  return retourReel ?? nowIso.split('T')[0];
}

export function resolveEtatRetour(value: string | null | undefined): string {
  const normalized = value?.trim();
  return normalized || 'bon';
}

import type { ApCapiContactRef, ApCapiLieuRef, ApCapiSpectacleRef, ApVenue } from '../types/accueilPro';
import { generateApId, listApVenues, saveVenue } from '../db/accueilProDb';
import { getApCapiContactRefById, getApCapiLieuRefById, getApCapiSpectacleRefById } from '../db/capiAccueilProRefDb';

/** Retrouve ou crée un lieu Accueil Pro à partir d'une référence CAPI. */
export async function ensureApVenueFromCapiLieuRef(refId: string): Promise<ApVenue | null> {
  const ref = await getApCapiLieuRefById(refId);
  if (!ref) return null;

  const existing = (await listApVenues()).find((v) => v.capi_lieu_ref_id === ref.id);
  if (existing) return existing;

  const venue: ApVenue = {
    id: generateApId(),
    name: ref.nom,
    address: ref.adresse ?? null,
    city: ref.ville ?? null,
    capi_lieu_ref_id: ref.id,
  };
  await saveVenue(venue);
  return venue;
}

export function capiLieuRefLabel(ref: ApCapiLieuRef): string {
  const kind = ref.kind === 'salle' ? 'Salle' : 'Ext.';
  return `[${kind}] ${ref.nom}`;
}

export function capiSpectacleRefLabel(ref: ApCapiSpectacleRef): string {
  const cat = ref.categorieLibelle || ref.categorieCode;
  const comp = ref.compagnie ? ` — ${ref.compagnie}` : '';
  const suffix = cat ? ` (${cat})` : '';
  return `${ref.titre}${comp}${suffix}`;
}

export function capiContactRefLabel(ref: ApCapiContactRef): string {
  const kind =
    ref.kind === 'personnel' ? 'Personnel'
    : ref.kind === 'prestataire' ? 'Prestataire'
    : 'Contact';
  const org = ref.organisation ? ` — ${ref.organisation}` : '';
  return `[${kind}] ${ref.nom}${org}`;
}

export function splitCapiContactName(nom: string): { firstName: string; lastName: string } {
  const parts = nom.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: '', lastName: parts[0] ?? '' };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] ?? '' };
}

export async function getApCapiSpectacleRef(refId: string): Promise<ApCapiSpectacleRef | null> {
  return getApCapiSpectacleRefById(refId);
}

export async function getApCapiContactRef(refId: string): Promise<ApCapiContactRef | null> {
  return getApCapiContactRefById(refId);
}

export async function linkEventVenueFromCapiLieuRef(
  refId: string,
): Promise<{ venueId: string; capiLieuRefId: string } | null> {
  const venue = await ensureApVenueFromCapiLieuRef(refId);
  if (!venue) return null;
  return { venueId: venue.id, capiLieuRefId: refId };
}

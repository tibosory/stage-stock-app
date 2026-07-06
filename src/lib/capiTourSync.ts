import { listTourLocations } from '../db/trackingDb';
import type { Tour, TourLocation } from '../types';
import { getApiKeyOverride, getCapiBridgeBaseOverride, looksLikeHttpUrl } from './apiEndpointStorage';
import { fetchWithTimeout } from './fetchWithTimeout';

export type CapiTourPlanningPayload = {
  cattrackTourId: string;
  tourName: string;
  startDate: string;
  endDate?: string | null;
  status: Tour['status'];
  vehiculeIds: string[];
};

function extractVehiculeIds(locations: TourLocation[]): string[] {
  const ids = new Set<string>();
  for (const loc of locations) {
    if (loc.capiKind === 'vehicule' && loc.capiRefId?.trim()) {
      ids.add(loc.capiRefId.trim());
    }
  }
  return [...ids];
}

export function buildCapiTourPlanningPayload(tour: Tour, locations: TourLocation[]): CapiTourPlanningPayload {
  return {
    cattrackTourId: tour.id,
    tourName: tour.name,
    startDate: tour.startDate,
    endDate: tour.endDate ?? tour.startDate,
    status: tour.status,
    vehiculeIds: extractVehiculeIds(locations),
  };
}

/** Notifie CAPI pour réserver / libérer les véhicules dans le planning. */
export async function syncTourVehiculePlanningToCapi(tour: Tour): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const base = await getCapiBridgeBaseOverride();
  if (!base || !looksLikeHttpUrl(base)) {
    return { ok: false, skipped: true };
  }
  const locations = await listTourLocations(tour.id);
  const payload = buildCapiTourPlanningPayload(tour, locations);
  const url = `${base.replace(/\/$/, '')}/api/cattrack/tours/vehicule-planning`;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  const apiKey = (await getApiKeyOverride())?.trim();
  if (apiKey) headers['X-API-Key'] = apiKey;

  try {
    const res = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      },
      45_000,
    );
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, error: `CAPI ${res.status}${text ? ` : ${text.slice(0, 160)}` : ''}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

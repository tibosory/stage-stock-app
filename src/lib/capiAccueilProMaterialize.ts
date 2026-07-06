/**
 * Matérialise les catalogues CAPI synchronisés en données Accueil Pro exploitables
 * (événements, espaces, planning journalier).
 */
import {
  generateApId,
  getApEventByCapiSpectacleRef,
  listApSpaces,
  saveApDayPlanItem,
  saveApEvent,
  saveSpace,
} from '../db/accueilProDb';
import { getDB } from '../db/database';
import {
  listApCapiEspaceRefs,
  listApCapiPlanningRefs,
  listApCapiSpectacleRefs,
} from '../db/capiAccueilProRefDb';
import { ensureApVenueFromCapiLieuRef } from './capiAccueilProHelpers';

export async function materializeCapiAccueilProCatalog(): Promise<{
  venuesLinked: number;
  spacesCreated: number;
  eventsCreated: number;
  planningItems: number;
}> {
  let venuesLinked = 0;
  let spacesCreated = 0;
  let eventsCreated = 0;
  let planningItems = 0;

  const espaces = await listApCapiEspaceRefs();
  for (const ref of espaces) {
    const venue = await ensureApVenueFromCapiLieuRef(ref.capiLieuRefId);
    if (!venue) continue;
    venuesLinked += 1;
    const existing = (await listApSpaces(venue.id)).find((s) => s.capi_espace_ref_id === ref.id);
    if (existing) {
      await saveSpace({
        ...existing,
        name: ref.nom,
        type: ref.type ?? null,
        capacity: ref.jauge ?? null,
        description: ref.description ?? null,
        control_points: ref.controlPoints ?? [],
        capi_espace_ref_id: ref.id,
      });
      continue;
    }
    await saveSpace({
      id: generateApId(),
      venue_id: venue.id,
      name: ref.nom,
      type: ref.type ?? null,
      capacity: ref.jauge ?? null,
      description: ref.description ?? null,
      control_points: ref.controlPoints ?? [],
      capi_espace_ref_id: ref.id,
    });
    spacesCreated += 1;
  }

  const spectacles = await listApCapiSpectacleRefs();
  for (const ref of spectacles) {
    let event = await getApEventByCapiSpectacleRef(ref.id);
    if (!event) {
      const venue = ref.capiLieuRefId ? await ensureApVenueFromCapiLieuRef(ref.capiLieuRefId) : null;
      const id = generateApId();
      await saveApEvent({
        id,
        name: ref.titre,
        type: ref.categorieLibelle || ref.categorieCode || null,
        organisateur: ref.compagnie || null,
        date_debut: ref.dateDebut.slice(0, 10),
        date_fin: ref.dateFin?.slice(0, 10) || null,
        status: 'confirmé',
        venue_id: venue?.id ?? null,
        capi_spectacle_ref_id: ref.id,
        capi_lieu_ref_id: ref.capiLieuRefId || null,
        spaces_mode: 'all',
        selected_space_ids: [],
        readiness_manual: {},
      });
      event = await getApEventByCapiSpectacleRef(ref.id);
      eventsCreated += 1;
    }
    if (!event) continue;

    const planning = (await listApCapiPlanningRefs()).filter((p) => p.capiSpectacleRefId === ref.id);
    for (const item of planning) {
      const existingItems = await (await getDB()).getAllAsync<{ id: string }>(
        'SELECT id FROM ap_day_plan_items WHERE event_id = ? AND title = ? AND plan_date = ? AND time_start IS ?',
        [event.id, item.title, item.dateKey, item.timeStart ?? null],
      );
      if (existingItems.length) continue;
      await saveApDayPlanItem({
        id: generateApId(),
        plan_date: item.dateKey,
        event_id: event.id,
        time_start: item.timeStart ?? null,
        time_end: item.timeEnd ?? null,
        title: item.title,
        assignee_name: item.assigneeName ?? null,
        notes: item.notes ?? null,
        sort_order: item.sortOrder ?? 0,
        venue_id: event.venue_id ?? null,
      });
      planningItems += 1;
    }
  }

  return { venuesLinked, spacesCreated, eventsCreated, planningItems };
}

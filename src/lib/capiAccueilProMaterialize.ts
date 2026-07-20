/**
 * Matérialise les catalogues CAPI synchronisés en données Accueil Pro exploitables
 * (événements, espaces, planning journalier, équipe).
 */
import {
  generateApId,
  getApEventByCapiSpectacleRef,
  getApPersonnel,
  listApSpaces,
  listApVenues,
  saveApDayPlanItem,
  saveApEvent,
  saveApEventPersonnel,
  saveApPersonnel,
  saveSpace,
} from '../db/accueilProDb';
import { getDB } from '../db/database';
import {
  getApCapiDossierRefBySpectacleRefId,
  listApCapiContactRefs,
  listApCapiEspaceRefs,
  listApCapiPlanningRefs,
  listApCapiSpectacleRefs,
} from '../db/capiAccueilProRefDb';
import { ensureApVenueFromCapiLieuRef, splitCapiContactName } from './capiAccueilProHelpers';

export async function materializeCapiAccueilProCatalog(): Promise<{
  venuesLinked: number;
  spacesCreated: number;
  eventsCreated: number;
  planningItems: number;
  teamMembers: number;
  directoryContacts: number;
}> {
  let venuesLinked = 0;
  let spacesCreated = 0;
  let eventsCreated = 0;
  let planningItems = 0;
  let teamMembers = 0;
  let directoryContacts = 0;

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
      if (!venue) continue;
      const id = generateApId();
      await saveApEvent({
        id,
        name: ref.titre,
        type: ref.categorieLibelle || ref.categorieCode || null,
        organisateur: ref.compagnie || null,
        date_debut: ref.dateDebut.slice(0, 10),
        date_fin: ref.dateFin?.slice(0, 10) || null,
        status: 'confirmé',
        venue_id: venue.id,
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

    const dossier = await getApCapiDossierRefBySpectacleRefId(ref.id);
    if (dossier?.equipe?.length) {
      const db = await getDB();
      for (const member of dossier.equipe) {
        const stableId = `capi-eq:${event.id}:${member.id}`;
        const existing = await db.getFirstAsync<{ id: string }>(
          'SELECT id FROM ap_event_personnel WHERE id = ? LIMIT 1',
          [stableId],
        );
        await saveApEventPersonnel({
          id: existing?.id ?? stableId,
          event_id: event.id,
          source: 'adhoc',
          name: member.nom,
          day_role: member.role ?? null,
          day_mission: member.role ?? null,
          phone: member.telephone ?? null,
          email: member.email ?? null,
          source_personnel_id: null,
        });
        teamMembers += 1;
      }
    }
  }

  /** Annuaire CAPI → fiches équipe Accueil Pro (sélectionnables dans l’onglet Équipe). */
  const venues = await listApVenues();
  const defaultVenueId = venues[0]?.id ?? null;
  if (defaultVenueId) {
    const contacts = await listApCapiContactRefs();
    for (const ref of contacts) {
      const stableId = `capi-tm:${ref.id}`;
      const existing = await getApPersonnel(stableId);
      const { firstName, lastName } = splitCapiContactName(ref.nom);
      const venueId = existing?.venue_id || defaultVenueId;
      await saveApPersonnel({
        id: stableId,
        kind: 'externe',
        venue_id: venueId,
        organization_id: null,
        name: ref.nom.trim(),
        first_name: firstName || null,
        last_name: lastName || null,
        address: null,
        role: ref.role ?? null,
        role_permanent: false,
        mission: ref.organisation ?? null,
        phone: ref.telephone ?? null,
        email: ref.email ?? null,
        notes: null,
        photo_uri: existing?.photo_uri ?? null,
        capi_contact_ref_id: ref.id,
        capi_contact_kind: ref.kind,
      });
      directoryContacts += 1;
    }
  }

  return { venuesLinked, spacesCreated, eventsCreated, planningItems, teamMembers, directoryContacts };
}

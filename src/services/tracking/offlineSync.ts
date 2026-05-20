import { flushSyncQueue } from '../../saas/services/offlineSync';
import { TrackingSyncRepository } from '../../infrastructure/repositories';
import { enqueueTrackingUpsert } from './syncQueue';

export async function syncTrackingOfflineQueue(): Promise<void> {
  const unsynced = await TrackingSyncRepository.listUnsynced();

  for (const t of unsynced.tours) {
    await enqueueTrackingUpsert('tours', {
      id: t.id,
      name: t.name,
      status: t.status,
      start_date: t.startDate,
      end_date: t.endDate,
      updated_at: t.updatedAt,
    });
  }
  for (const l of unsynced.locations) {
    await enqueueTrackingUpsert('tour_locations', {
      id: l.id,
      name: l.name,
      address: l.address,
      date_start: l.dateStart,
      date_end: l.dateEnd,
      tour_id: l.tourId,
      updated_at: l.updatedAt,
    });
  }
  for (const a of unsynced.assignments) {
    await enqueueTrackingUpsert('material_assignments', {
      id: a.id,
      material_id: a.materialId,
      tour_id: a.tourId,
      location_id: a.locationId,
      flightcase_id: a.flightcaseId ?? null,
      packaging_photo_local: a.packagingPhotoLocal ?? null,
      quantity: a.quantity,
      status: a.status,
      assigned_at: a.assignedAt,
      returned_at: a.returnedAt,
      assigned_to: a.assignedTo,
      updated_at: a.updatedAt,
    });
  }
  for (const log of unsynced.logs) {
    await enqueueTrackingUpsert('activity_logs', {
      id: log.id,
      type: log.type,
      material_id: log.materialId,
      tour_id: log.tourId,
      location_id: log.locationId,
      user_id: log.userId,
      timestamp: log.timestamp,
      note: log.note,
      created_at: log.createdAt,
    });
  }

  await flushSyncQueue();
  await TrackingSyncRepository.markSynced({
    tourIds: unsynced.tours.map(x => x.id),
    locationIds: unsynced.locations.map(x => x.id),
    assignmentIds: unsynced.assignments.map(x => x.id),
    logIds: unsynced.logs.map(x => x.id),
  });
}

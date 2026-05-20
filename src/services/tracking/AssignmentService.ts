import { ActivityLogRepository, AssignmentRepository, MaterialRepository } from '../../infrastructure/repositories';
import type { ActivityLogType, Assignment } from '../../types';
import { enqueueTrackingUpsert } from './syncQueue';
import { DomainEventBus } from '../../application/events';

async function logAndQueueActivity(input: {
  type: ActivityLogType;
  materialId: string;
  tourId?: string | null;
  locationId?: string | null;
  userId?: string | null;
  note?: string | null;
}) {
  const at = new Date().toISOString();
  const row = await ActivityLogRepository.create({
    type: input.type,
    materialId: input.materialId,
    tourId: input.tourId ?? null,
    locationId: input.locationId ?? null,
    userId: input.userId ?? null,
    timestamp: at,
    note: input.note ?? null,
  });
  await enqueueTrackingUpsert('activity_logs', {
    id: row.id,
    type: row.type,
    material_id: row.materialId,
    tour_id: row.tourId,
    location_id: row.locationId,
    user_id: row.userId,
    timestamp: row.timestamp,
    note: row.note,
    created_at: row.createdAt,
  });
}

export const AssignmentService = {
  async listByTour(tourId: string): Promise<Assignment[]> {
    return AssignmentRepository.listByTour(tourId);
  },

  async assignMaterial(input: {
    materialId: string;
    tourId: string;
    locationId?: string | null;
    flightcaseId?: string | null;
    packagingPhotoLocal?: string | null;
    quantity: number;
    userId?: string | null;
    note?: string | null;
  }): Promise<Assignment> {
    const material = await MaterialRepository.byId(input.materialId);
    if (!material) throw new Error('Matériel introuvable.');
    if (input.quantity <= 0) throw new Error('La quantité doit être positive.');
    if (material.statut !== 'en stock') {
      throw new Error('Matériel hors stock : seules les fiches au statut « en stock » peuvent être affectées.');
    }
    /** Une fiche matériel = 1 unité physique ; le « stock » assignable est 1 moins les lignes encore actives. */
    const stockDisponible = 1;
    const dejaEnSuivi = await AssignmentRepository.sumActiveQtyByMaterial(input.materialId);
    if (input.quantity + dejaEnSuivi > stockDisponible) {
      throw new Error(
        `Quantité trop élevée : cette fiche représente ${stockDisponible} unité(s). Déjà ${dejaEnSuivi} en suivi actif (assigné / en cours), impossible d’ajouter ${input.quantity}.`
      );
    }

    const assignedAt = new Date().toISOString();
    const assignment = await AssignmentRepository.create({
      materialId: input.materialId,
      tourId: input.tourId,
      locationId: input.locationId ?? null,
      flightcaseId: input.flightcaseId ?? null,
      packagingPhotoLocal: input.packagingPhotoLocal ?? null,
      quantity: input.quantity,
      status: 'assigned',
      assignedAt,
      assignedTo: input.userId ?? null,
    });

    await enqueueTrackingUpsert('material_assignments', {
      id: assignment.id,
      material_id: assignment.materialId,
      tour_id: assignment.tourId,
      location_id: assignment.locationId,
      flightcase_id: assignment.flightcaseId ?? null,
      quantity: assignment.quantity,
      status: assignment.status,
      assigned_at: assignment.assignedAt,
      assigned_to: assignment.assignedTo,
      updated_at: assignment.updatedAt,
    });

    await logAndQueueActivity({
      type: 'ASSIGNED',
      materialId: assignment.materialId,
      tourId: assignment.tourId,
      locationId: assignment.locationId,
      userId: input.userId,
      note: input.note,
    });
    await DomainEventBus.publish('assignment.created', {
      assignmentId: assignment.id,
      materialId: assignment.materialId,
      tourId: assignment.tourId,
      locationId: assignment.locationId,
      quantity: assignment.quantity,
      status: assignment.status,
    });

    return assignment;
  },

  async setPackagingPhoto(input: { assignmentId: string; photoUri: string | null }): Promise<void> {
    await AssignmentRepository.updatePackagingPhoto(input.assignmentId, input.photoUri);
    const assignment = await AssignmentRepository.byId(input.assignmentId);
    if (!assignment) return;
    await enqueueTrackingUpsert('material_assignments', {
      id: assignment.id,
      packaging_photo_local: assignment.packagingPhotoLocal ?? null,
      updated_at: assignment.updatedAt,
    });
  },

  async moveMaterial(input: {
    assignmentId: string;
    locationId: string;
    userId?: string | null;
    note?: string | null;
  }): Promise<void> {
    await AssignmentRepository.move(input.assignmentId, input.locationId);
    const assignment = await AssignmentRepository.byId(input.assignmentId);
    if (!assignment) return;
    await enqueueTrackingUpsert('material_assignments', {
      id: assignment.id,
      location_id: input.locationId,
      status: assignment.status,
      updated_at: new Date().toISOString(),
    });
    await logAndQueueActivity({
      type: 'MOVED',
      materialId: assignment.materialId,
      tourId: assignment.tourId,
      locationId: input.locationId,
      userId: input.userId,
      note: input.note,
    });
    await DomainEventBus.publish('assignment.moved', {
      assignmentId: assignment.id,
      materialId: assignment.materialId,
      tourId: assignment.tourId,
      locationId: input.locationId,
      status: assignment.status,
    });
  },

  async setInUse(input: { assignmentId: string; userId?: string | null; note?: string | null }): Promise<void> {
    await AssignmentRepository.updateStatus(input.assignmentId, { status: 'in_use' });
    const assignment = await AssignmentRepository.byId(input.assignmentId);
    if (!assignment) return;
    await logAndQueueActivity({
      type: 'CHECKED',
      materialId: assignment.materialId,
      tourId: assignment.tourId,
      locationId: assignment.locationId,
      userId: input.userId,
      note: input.note,
    });
    await DomainEventBus.publish('assignment.status_changed', {
      assignmentId: assignment.id,
      materialId: assignment.materialId,
      tourId: assignment.tourId,
      locationId: assignment.locationId,
      nextStatus: 'in_use',
    });
  },

  async returnMaterial(input: {
    assignmentId: string;
    locationId?: string | null;
    userId?: string | null;
    note?: string | null;
  }): Promise<void> {
    const returnedAt = new Date().toISOString();
    await AssignmentRepository.updateStatus(input.assignmentId, {
      status: 'returned',
      returnedAt,
      locationId: input.locationId ?? null,
    });
    const assignment = await AssignmentRepository.byId(input.assignmentId);
    if (!assignment) return;
    await logAndQueueActivity({
      type: 'RETURNED',
      materialId: assignment.materialId,
      tourId: assignment.tourId,
      locationId: input.locationId ?? null,
      userId: input.userId,
      note: input.note,
    });
    await DomainEventBus.publish('assignment.status_changed', {
      assignmentId: assignment.id,
      materialId: assignment.materialId,
      tourId: assignment.tourId,
      locationId: input.locationId ?? null,
      nextStatus: 'returned',
    });
  },

  async reportIssue(input: {
    assignmentId: string;
    status: 'lost' | 'damaged';
    userId?: string | null;
    note?: string | null;
  }): Promise<void> {
    await AssignmentRepository.updateStatus(input.assignmentId, { status: input.status });
    const assignment = await AssignmentRepository.byId(input.assignmentId);
    if (!assignment) return;
    await logAndQueueActivity({
      type: 'DAMAGED',
      materialId: assignment.materialId,
      tourId: assignment.tourId,
      locationId: assignment.locationId,
      userId: input.userId,
      note: input.note ?? (input.status === 'lost' ? 'Material lost' : 'Material damaged'),
    });
    await DomainEventBus.publish('assignment.status_changed', {
      assignmentId: assignment.id,
      materialId: assignment.materialId,
      tourId: assignment.tourId,
      locationId: assignment.locationId,
      nextStatus: input.status,
    });
  },
};

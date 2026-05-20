import { ActivityLogSystem } from '../services';
import { TourService, TrackingService } from '../../services/tracking';
import type { Tour } from '../../types';

export async function listToursUseCase(): Promise<Tour[]> {
  return TourService.list();
}

export async function getTourUseCase(tourId: string): Promise<Tour | null> {
  const id = tourId?.trim();
  if (!id) return null;
  return TourService.getById(id);
}

export async function createTourUseCase(input: {
  name: string;
  status?: Tour['status'];
  startDate: string;
  endDate?: string | null;
}): Promise<Tour> {
  const name = input.name.trim();
  if (!name) throw new Error('Nom de tour requis');
  return TourService.create({ ...input, name });
}

export async function updateTourUseCase(input: {
  tourId: string;
  status?: Tour['status'];
  endDate?: string | null;
  name?: string;
}): Promise<Tour> {
  const id = input.tourId?.trim();
  if (!id) throw new Error('Identifiant de tournée manquant.');
  return TourService.update({
    id,
    name: input.name,
    status: input.status,
    endDate: input.endDate,
  });
}

export async function getTrackingSnapshotUseCase(status?: string) {
  return TrackingService.snapshot(status);
}

export async function listActivityLogsUseCase(filters?: { materialId?: string; tourId?: string }) {
  if (filters?.materialId) return ActivityLogSystem.listByMaterial(filters.materialId);
  if (filters?.tourId) return ActivityLogSystem.listByTour(filters.tourId);
  return ActivityLogSystem.listAll();
}

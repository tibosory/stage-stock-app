import { ActivityLogRepository, TrackingRepository } from '../../infrastructure/repositories';

export const TrackingService = {
  async snapshot(status?: string | null) {
    return TrackingRepository.snapshot(status);
  },

  async activityByMaterial(materialId: string) {
    return ActivityLogRepository.list({ materialId });
  },

  async activityByTour(tourId: string) {
    return ActivityLogRepository.list({ tourId });
  },
};

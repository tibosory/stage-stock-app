import { ActivityLogRepository } from '../../infrastructure/repositories';

export const ActivityLogSystem = {
  listByMaterial(materialId: string) {
    return ActivityLogRepository.list({ materialId });
  },
  listByTour(tourId: string) {
    return ActivityLogRepository.list({ tourId });
  },
  listAll() {
    return ActivityLogRepository.list();
  },
};

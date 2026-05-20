import { getTrackingSnapshot } from '../../db/trackingDb';

export const TrackingRepository = {
  snapshot: (statusFilter?: string | null) => getTrackingSnapshot(statusFilter),
};

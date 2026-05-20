import { listUnsyncedTourEntities, markTourEntitiesSynced } from '../../db/trackingDb';

export const TrackingSyncRepository = {
  listUnsynced: listUnsyncedTourEntities,
  markSynced: markTourEntitiesSynced,
};

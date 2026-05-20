import { listActivityLogs, logActivity } from '../../db/trackingDb';

export const ActivityLogRepository = {
  create: logActivity,
  list: listActivityLogs,
};

export type QueueTaskLite = {
  table: string;
  retries: number;
};

export type PurgeSyncQueueResult = {
  removedCount: number;
  keptCount: number;
  removedByTable: Record<string, number>;
};

const CRITICAL_TABLES = new Set([
  'material_assignments',
  'activity_logs',
  'tours',
  'tour_locations',
]);

export function planQueuePurge<T extends QueueTaskLite>(
  queue: T[],
  options?: { allowCritical?: boolean; maxRetriesToKeep?: number }
): { nextQueue: T[]; result: PurgeSyncQueueResult } {
  const allowCritical = options?.allowCritical ?? false;
  const maxRetriesToKeep = options?.maxRetriesToKeep ?? 0;
  const removedByTable: Record<string, number> = {};
  const nextQueue: T[] = [];
  let removedCount = 0;

  for (const task of queue) {
    const isCritical = CRITICAL_TABLES.has(task.table);
    const keepByRetry = task.retries > maxRetriesToKeep;
    if ((!allowCritical && isCritical) || keepByRetry) {
      nextQueue.push(task);
      continue;
    }
    removedCount += 1;
    removedByTable[task.table] = (removedByTable[task.table] ?? 0) + 1;
  }

  return {
    nextQueue,
    result: {
      removedCount,
      keptCount: nextQueue.length,
      removedByTable,
    },
  };
}

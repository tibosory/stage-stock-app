import { enqueueSyncTask } from '../../saas/services/offlineSync';

const ORG_LOCAL = 'local';
function queueId(prefix: string): string {
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`;
}

export async function enqueueTrackingUpsert(table: string, payload: Record<string, unknown>): Promise<void> {
  const now = new Date().toISOString();
  await enqueueSyncTask({
    id: queueId(`${table}:${String(payload.id ?? 'row')}`),
    table,
    op: 'upsert',
    payload,
    organization_id: ORG_LOCAL,
    updated_at: now,
  });
}

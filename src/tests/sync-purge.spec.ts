import assert from 'node:assert/strict';
import { planQueuePurge } from '../application/sync/SyncQueuePurge';

function run() {
  const queue: any[] = [
    { id: '1', table: 'material_assignments', retries: 0, updated_at: new Date().toISOString() },
    { id: '2', table: 'activity_logs', retries: 1, updated_at: new Date().toISOString() },
    { id: '3', table: 'misc_table', retries: 0, updated_at: new Date().toISOString() },
    { id: '4', table: 'misc_table', retries: 3, updated_at: new Date().toISOString() },
  ];

  const safe = planQueuePurge(queue as any, { allowCritical: false, maxRetriesToKeep: 1 });
  assert.equal(safe.result.removedCount, 1, 'should remove only non-critical low-retry task');
  assert.equal(safe.result.keptCount, 3);
  assert.equal(safe.result.removedByTable.misc_table, 1);

  const force = planQueuePurge(queue as any, { allowCritical: true, maxRetriesToKeep: 10 });
  assert.equal(force.result.removedCount, 4, 'should remove all when critical allowed and retries threshold high');
  assert.equal(force.result.keptCount, 0);

  console.log('sync-purge.spec: OK');
}

run();

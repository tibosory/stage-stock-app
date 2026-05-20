import assert from 'node:assert/strict';
import { computeSyncBackoffDelay } from '../application/sync/SyncBackoff';

function run() {
  assert.equal(computeSyncBackoffDelay(30000, 0), 30000);
  assert.equal(computeSyncBackoffDelay(30000, 1), 60000);
  assert.equal(computeSyncBackoffDelay(30000, 2), 120000);
  assert.equal(computeSyncBackoffDelay(30000, 10), 300000, 'must cap at 5 minutes');
  assert.equal(computeSyncBackoffDelay(1000, 0), 10000, 'must enforce minimum scheduler interval');
  console.log('sync-backoff.spec: OK');
}

run();

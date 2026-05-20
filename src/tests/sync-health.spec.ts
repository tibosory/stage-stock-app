import assert from 'node:assert/strict';
import { computeSyncHealth } from '../application/sync/SyncHealth';

function run() {
  const healthy = computeSyncHealth(
    { phase: 'success', consecutiveFailures: 0 },
    { size: 0, retryingCount: 0, maxRetries: 0, byTable: {} }
  );
  assert.equal(healthy.level, 'healthy');
  assert.ok(healthy.score >= 75);

  const warning = computeSyncHealth(
    { phase: 'success', consecutiveFailures: 2, lastErrorCategory: 'network' },
    { size: 20, retryingCount: 5, maxRetries: 3, byTable: { a: 20 } }
  );
  assert.ok(warning.score < 100);
  assert.equal(warning.level, 'warning');

  const critical = computeSyncHealth(
    { phase: 'error', consecutiveFailures: 5, lastErrorCategory: 'auth' },
    { size: 200, retryingCount: 30, maxRetries: 5, byTable: { x: 200 } }
  );
  assert.equal(critical.level, 'critical');
  assert.ok(critical.score < 45);

  console.log('sync-health.spec: OK');
}

run();

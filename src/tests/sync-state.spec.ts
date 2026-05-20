import assert from 'node:assert/strict';
import { getSyncState, setSyncState, subscribeSyncState } from '../application/sync/SyncStateStore';

function run() {
  const seen: string[] = [];
  const unsub = subscribeSyncState(s => {
    seen.push(s.phase);
  });

  setSyncState({
    phase: 'running',
    schedulerActive: true,
    nextBackoffMs: 30000,
    nextScheduledAt: new Date(Date.now() + 30000).toISOString(),
    lastRunAt: new Date().toISOString(),
  });
  setSyncState({ phase: 'success', lastSuccessAt: new Date().toISOString(), consecutiveFailures: 0 });
  const finalState = getSyncState();
  unsub();

  assert.equal(finalState.phase, 'success');
  assert.equal(finalState.schedulerActive, true);
  assert.equal(finalState.nextBackoffMs, 30000);
  assert.ok(seen.includes('running'));
  assert.ok(seen.includes('success'));
  console.log('sync-state.spec: OK');
}

run();

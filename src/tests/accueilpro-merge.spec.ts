import assert from 'node:assert/strict';
import { decideMergeAction } from '../lib/accueilProMerge';

function merge_newRemote_inserts() {
  assert.equal(decideMergeAction(null, { updated_at: '2026-01-01' }), 'insert_remote');
  console.log('  ✓ insert when no local');
}

function merge_localPending_keepsLocal() {
  assert.equal(
    decideMergeAction({ synced: 0, updated_at: '2026-05-20' }, { updated_at: '2026-05-19' }),
    'keep_local'
  );
  console.log('  ✓ keep local pending when newer');
}

function merge_localPending_conflict() {
  assert.equal(
    decideMergeAction({ synced: 0, updated_at: '2026-05-19' }, { updated_at: '2026-05-20' }),
    'conflict'
  );
  console.log('  ✓ conflict when local pending and remote newer');
}

function merge_synced_remoteNewer_applies() {
  assert.equal(
    decideMergeAction({ synced: 1, updated_at: '2026-05-19' }, { updated_at: '2026-05-20' }),
    'apply_remote'
  );
  console.log('  ✓ apply remote when synced and remote newer');
}

function merge_synced_localNewer_repush() {
  assert.equal(
    decideMergeAction({ synced: 1, updated_at: '2026-05-21' }, { updated_at: '2026-05-20' }),
    'keep_local_repush'
  );
  console.log('  ✓ repush when local synced but newer');
}

console.log('accueilpro-merge.spec.ts');
merge_newRemote_inserts();
merge_localPending_keepsLocal();
merge_localPending_conflict();
merge_synced_remoteNewer_applies();
merge_synced_localNewer_repush();
console.log('OK');

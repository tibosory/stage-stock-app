import assert from 'node:assert/strict';
import { resolveAssignmentConflict, resolveLww } from '../application/sync/ConflictResolver';

function run() {
  // LWW baseline
  const lww = resolveLww(
    { id: 'x', updated_at: '2026-04-26T10:00:00.000Z', value: 'local' },
    { id: 'x', updated_at: '2026-04-26T09:00:00.000Z', value: 'remote' }
  );
  assert.equal(lww.value, 'local');

  const lwwRemote = resolveLww(
    { id: 'x', updated_at: '2026-04-26T09:00:00.000Z', value: 'local' },
    { id: 'x', updated_at: '2026-04-26T10:00:00.000Z', value: 'remote' }
  );
  assert.equal(lwwRemote.value, 'remote');

  // Tracking-specific guard: terminal local state is preserved
  const localTerminal = resolveAssignmentConflict(
    { id: 'a1', updated_at: '2026-04-26T08:00:00.000Z', status: 'lost' },
    { id: 'a1', updated_at: '2026-04-26T11:00:00.000Z', status: 'in_use' }
  );
  assert.equal(localTerminal.status, 'lost');

  // Terminal remote can win when local is non-terminal and newer policy allows through LWW
  const remoteTerminal = resolveAssignmentConflict(
    { id: 'a1', updated_at: '2026-04-26T08:00:00.000Z', status: 'in_use' },
    { id: 'a1', updated_at: '2026-04-26T11:00:00.000Z', status: 'damaged' }
  );
  assert.equal(remoteTerminal.status, 'damaged');

  console.log('sync-conflict.spec: OK');
}

run();

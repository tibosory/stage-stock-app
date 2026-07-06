import assert from 'node:assert/strict';
import { isPartialInventorySync, formatPartialInventorySyncError } from '../lib/inventorySyncPartial';

function run() {
  assert.equal(
    isPartialInventorySync({ ok: false, backend: 'supabase', pushOk: true, pullOk: false }),
    true
  );
  assert.equal(
    isPartialInventorySync({ ok: false, backend: 'supabase', pushOk: false, pullOk: false }),
    false
  );
  assert.equal(isPartialInventorySync({ ok: true, backend: 'supabase', pushOk: true, pullOk: true }), false);

  const msg = formatPartialInventorySyncError({
    ok: false,
    backend: 'supabase',
    pushOk: true,
    pullOk: false,
    error: 'timeout',
  });
  assert.ok(msg.includes('timeout'));

  console.log('inventory-sync-partial.spec: OK');
}

run();

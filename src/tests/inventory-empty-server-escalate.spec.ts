import { shouldEscalateToFullInventoryPush } from '../lib/inventoryEmptyServerEscalate';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

assert(
  shouldEscalateToFullInventoryPush({
    localMateriels: 3,
    localConsommables: 0,
    remoteMateriels: 0,
    remoteConsommables: 0,
  }) === true,
  'local mats + empty server → escalate'
);

assert(
  shouldEscalateToFullInventoryPush({
    localMateriels: 0,
    localConsommables: 2,
    remoteMateriels: 0,
    remoteConsommables: 0,
  }) === true,
  'local conso + empty server → escalate'
);

assert(
  shouldEscalateToFullInventoryPush({
    localMateriels: 5,
    localConsommables: 1,
    remoteMateriels: 1,
    remoteConsommables: 0,
  }) === true,
  'partial mats + missing consos on server → escalate'
);

assert(
  shouldEscalateToFullInventoryPush({
    localMateriels: 200,
    localConsommables: 12,
    remoteMateriels: 50,
    remoteConsommables: 12,
  }) === true,
  'local mats > remote → escalate'
);

assert(
  shouldEscalateToFullInventoryPush({
    localMateriels: 50,
    localConsommables: 12,
    remoteMateriels: 50,
    remoteConsommables: 0,
  }) === true,
  'same mats but missing consos → escalate'
);

assert(
  shouldEscalateToFullInventoryPush({
    localMateriels: 50,
    localConsommables: 12,
    remoteMateriels: 50,
    remoteConsommables: 12,
  }) === false,
  'counts aligned → no escalate'
);

assert(
  shouldEscalateToFullInventoryPush({
    localMateriels: 0,
    localConsommables: 0,
    remoteMateriels: 0,
    remoteConsommables: 0,
  }) === false,
  'both empty → no escalate'
);

console.log('inventory-empty-server-escalate.spec.ts: ok');

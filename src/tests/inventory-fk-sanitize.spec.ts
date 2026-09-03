import assert from 'node:assert/strict';
import {
  collectNonEmptyIds,
  filterPretMaterielsByParents,
  nullifyOrphanRowFks,
} from '../lib/inventorySnapshotFkSanitize';

function testNullifyOrphanCategoryAndLocalisation() {
  const validCats = new Set(['cat-ok']);
  const validLocs = new Set(['loc-ok']);
  const cleaned = nullifyOrphanRowFks(
    { id: 'm1', categorie_id: 'cat-gone', localisation_id: 'loc-ok', nom: 'X' },
    validCats,
    validLocs
  );
  assert.equal(cleaned.categorie_id, null);
  assert.equal(cleaned.localisation_id, 'loc-ok');
}

function testFilterPretMaterielsRequiresBothParents() {
  const prets = new Set(['p1']);
  const mats = new Set(['m1']);
  const kept = filterPretMaterielsByParents(
    [
      { id: 'pm1', pret_id: 'p1', materiel_id: 'm1' },
      { id: 'pm2', pret_id: 'p1', materiel_id: 'm-missing' },
      { id: 'pm3', pret_id: 'p-missing', materiel_id: 'm1' },
    ],
    prets,
    mats
  );
  assert.equal(kept.length, 1);
  assert.equal(kept[0]?.id, 'pm1');
}

function testCollectIds() {
  const ids = collectNonEmptyIds([{ id: 'a' }, { id: '  ' }, { id: null }, { id: 'b' }], 'id');
  assert.deepEqual([...ids].sort(), ['a', 'b']);
}

testNullifyOrphanCategoryAndLocalisation();
testFilterPretMaterielsRequiresBothParents();
testCollectIds();
console.log('inventory-fk-sanitize.spec.ts: ok');

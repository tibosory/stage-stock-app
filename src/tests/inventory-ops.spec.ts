import assert from 'node:assert/strict';
import {
  buildMouvementsStockHistoriqueQuery,
  categoryIdsMatchingPathQuery,
} from '../db/inventoryOpsQuery';
import type { Categorie } from '../types';

function testCategoryIdsMatchingPathQuery() {
  const categories: Categorie[] = [
    { id: 'lights', nom: 'Lumiere', parent_id: null, created_at: '2026-01-01T00:00:00.000Z' },
    { id: 'projectors', nom: 'Projecteurs', parent_id: 'lights', created_at: '2026-01-01T00:00:00.000Z' },
    { id: 'sound', nom: 'Son', parent_id: null, created_at: '2026-01-01T00:00:00.000Z' },
  ];

  const byLeafName = categoryIdsMatchingPathQuery(categories, 'project');
  assert.deepEqual(byLeafName, ['projectors'], 'leaf name query should match target category');

  const byPathSegment = categoryIdsMatchingPathQuery(categories, 'lumiere');
  assert.ok(byPathSegment.includes('lights'), 'path query should include parent category');
  assert.ok(byPathSegment.includes('projectors'), 'path query should include descendants via path match');

  const empty = categoryIdsMatchingPathQuery(categories, '   ');
  assert.equal(empty.length, 0, 'empty query should return no category IDs');
}

function testBuildMouvementsStockHistoriqueQueryWithFilters() {
  const { sql, params } = buildMouvementsStockHistoriqueQuery({
    type: 'entrée',
    dateFrom: '2026-01-01T00:00:00.000Z',
    dateTo: '2026-12-31T23:59:59.999Z',
    search: " Gel%Lee ",
    limit: 120,
  });

  assert.ok(sql.includes('WHERE m.type = ? AND m.created_at >= ? AND m.created_at <= ?'));
  assert.ok(sql.includes("lower(coalesce(c.nom, '')) LIKE ?"));
  assert.equal(params[0], 'entrée');
  assert.equal(params[1], '2026-01-01T00:00:00.000Z');
  assert.equal(params[2], '2026-12-31T23:59:59.999Z');
  assert.equal(params[3], '%gellee%', 'search should be trimmed, lowercased and wildcard-sanitized');
  assert.equal(params[4], '%gellee%');
  assert.equal(params[5], 120);
}

function testBuildMouvementsStockHistoriqueQueryLimitBounds() {
  const low = buildMouvementsStockHistoriqueQuery(0);
  assert.equal(low.params[low.params.length - 1], 1, 'limit should clamp to minimum 1');

  const high = buildMouvementsStockHistoriqueQuery(10000);
  assert.equal(high.params[high.params.length - 1], 5000, 'limit should clamp to maximum 5000');
}

function run() {
  testCategoryIdsMatchingPathQuery();
  testBuildMouvementsStockHistoriqueQueryWithFilters();
  testBuildMouvementsStockHistoriqueQueryLimitBounds();
  console.log('inventory-ops.spec: OK');
}

run();

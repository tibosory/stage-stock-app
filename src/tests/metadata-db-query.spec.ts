import assert from 'node:assert/strict';
import {
  applyBeneficiairePatch,
  coerceDashboardStats,
  normalizeOptionalText,
} from '../db/metadataDbQuery';

function testNormalizeOptionalText() {
  assert.equal(normalizeOptionalText('  Theatre  '), 'Theatre');
  assert.equal(normalizeOptionalText('   '), null);
  assert.equal(normalizeOptionalText(undefined), null);
}

function testApplyBeneficiairePatch() {
  const base = {
    nom: 'Alice',
    organisation: 'ENSATT',
    telephone: '0102030405',
    email: 'alice@example.com',
  };

  const merged = applyBeneficiairePatch(base, {
    nom: '  Alice B  ',
    organisation: '   ',
    email: '  bob@example.com ',
  });

  assert.equal(merged.nom, 'Alice B');
  assert.equal(merged.organisation, null);
  assert.equal(merged.telephone, '0102030405');
  assert.equal(merged.email, 'bob@example.com');
}

function testCoerceDashboardStats() {
  const stats = coerceDashboardStats({
    totalMateriels: 42,
    enPret: null,
    pretsEnCours: 3,
  });
  assert.deepEqual(stats, {
    totalMateriels: 42,
    enPret: 0,
    pretsEnCours: 3,
    alertesConsommables: 0,
  });
}

function run() {
  testNormalizeOptionalText();
  testApplyBeneficiairePatch();
  testCoerceDashboardStats();
  console.log('metadata-db-query.spec: OK');
}

run();

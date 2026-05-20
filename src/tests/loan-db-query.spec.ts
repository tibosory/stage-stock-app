import assert from 'node:assert/strict';
import {
  clampRappelJoursAvant,
  resolveEtatRetour,
  resolveRetourReelDate,
  shouldCleanupDemandeOnCancel,
  shouldPromoteDemandeToEnCours,
} from '../db/loanDbQuery';

function testClampRappelJoursAvant() {
  assert.equal(clampRappelJoursAvant(null), null);
  assert.equal(clampRappelJoursAvant('abc'), null);
  assert.equal(clampRappelJoursAvant(0), 1);
  assert.equal(clampRappelJoursAvant(12.7), 12);
  assert.equal(clampRappelJoursAvant(999), 365);
}

function testDemandeTransitions() {
  assert.equal(shouldPromoteDemandeToEnCours('en demande', 'en cours'), true);
  assert.equal(shouldPromoteDemandeToEnCours('en cours', 'en cours'), false);
  assert.equal(shouldCleanupDemandeOnCancel('en demande', 'annulé'), true);
  assert.equal(shouldCleanupDemandeOnCancel('en demande', 'en cours'), false);
}

function testRetourResolvers() {
  assert.equal(resolveRetourReelDate('2026-04-15', '2026-04-20T10:00:00.000Z'), '2026-04-15');
  assert.equal(resolveRetourReelDate(undefined, '2026-04-20T10:00:00.000Z'), '2026-04-20');
  assert.equal(resolveEtatRetour('  usé  '), 'usé');
  assert.equal(resolveEtatRetour('   '), 'bon');
  assert.equal(resolveEtatRetour(undefined), 'bon');
}

function run() {
  testClampRappelJoursAvant();
  testDemandeTransitions();
  testRetourResolvers();
  console.log('loan-db-query.spec: OK');
}

run();

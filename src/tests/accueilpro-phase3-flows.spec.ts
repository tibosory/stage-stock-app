import assert from 'node:assert/strict';
import { eventsOnDate, shiftIsoDate } from '../lib/accueilProFeuilleHelpers';
import { activityLogActionLabel, conventionIsSigned } from '../lib/accueilProActivityLog';
import type { ApEvent } from '../types/accueilPro';

function feuille_eventsOnDate() {
  const events: ApEvent[] = [
    { id: '1', name: 'A', date_debut: '2026-06-01', date_fin: '2026-06-02', status: 'confirmé' },
    { id: '2', name: 'B', date_debut: '2026-06-03', status: 'confirmé' },
  ];
  assert.equal(eventsOnDate(events, '2026-06-01').length, 1);
  assert.equal(eventsOnDate(events, '2026-06-02').length, 1);
  assert.equal(eventsOnDate(events, '2026-06-03').length, 1);
  assert.equal(eventsOnDate(events, '2026-06-04').length, 0);
  console.log('  ✓ eventsOnDate multi-day span');
}

function feuille_shiftDate() {
  assert.equal(shiftIsoDate('2026-06-01', 1), '2026-06-02');
  assert.equal(shiftIsoDate('2026-06-01', -1), '2026-05-31');
  console.log('  ✓ shiftIsoDate');
}

function convention_signedDetection() {
  assert.equal(conventionIsSigned({ status: 'signé', signature_data: 'abc' }), true);
  assert.equal(conventionIsSigned({ status: 'signé', signature_data: '' }), false);
  assert.equal(conventionIsSigned({ status: 'brouillon', signature_data: 'abc' }), false);
  console.log('  ✓ conventionIsSigned');
}

function activity_labels() {
  assert.equal(activityLogActionLabel('rental.validated'), 'Demande validée');
  assert.equal(activityLogActionLabel('unknown.action'), 'unknown.action');
  console.log('  ✓ activityLogActionLabel');
}

console.log('accueilpro-phase3-flows.spec.ts');
feuille_eventsOnDate();
feuille_shiftDate();
convention_signedDetection();
activity_labels();
console.log('OK accueilpro-phase3-flows');

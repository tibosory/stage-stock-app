import assert from 'node:assert/strict';
import { resolveAssignmentConflict, resolveLww } from '../application/sync/ConflictResolver';
import { ValidationService } from '../application/services/ValidationService';

function testConflictResolver() {
  const local = { id: '1', updated_at: '2026-04-26T18:00:00.000Z', status: 'lost' };
  const remote = { id: '1', updated_at: '2026-04-26T19:00:00.000Z', status: 'in_use' };
  const resolved = resolveAssignmentConflict(local, remote);
  assert.equal(resolved.status, 'lost', 'terminal local status must be preserved');

  const lww = resolveLww(
    { id: 'a', updated_at: '2026-04-26T20:00:00.000Z' },
    { id: 'a', updated_at: '2026-04-26T19:00:00.000Z' }
  );
  assert.equal(lww.updated_at, '2026-04-26T20:00:00.000Z');
}

function testValidationService() {
  const missing = ValidationService.validateAssignmentInput({});
  assert.ok(missing.length >= 2, 'missing required assignment fields should be detected');
  const ok = ValidationService.validateAssignmentInput({
    materialId: 'm1',
    tourId: 't1',
    quantity: 1,
  });
  assert.equal(ok.length, 0, 'valid assignment input should pass');

  const transitionOk = ValidationService.validateAssignmentTransition('assigned', 'in_use');
  assert.equal(transitionOk.length, 0, 'valid assignment transition should pass');
  const transitionBad = ValidationService.validateAssignmentTransition('assigned', 'foo' as any);
  assert.ok(transitionBad.length > 0, 'invalid assignment transition should fail');
  const transitionReturnedToInUse = ValidationService.validateAssignmentTransition('returned', 'in_use');
  assert.ok(transitionReturnedToInUse.length > 0, 'returned assignment should not go back in_use');
  const transitionDamagedToReturned = ValidationService.validateAssignmentTransition('damaged', 'returned');
  assert.equal(transitionDamagedToReturned.length, 0, 'damaged assignment can be returned after repair');

  const fields = [
    {
      id: 'power',
      label: 'Puissance',
      type: 'number' as const,
      required: true,
      isDeleted: false,
      min: 10,
      max: 100,
    },
    {
      id: 'mode',
      label: 'Mode',
      type: 'select' as const,
      required: true,
      isDeleted: false,
      options: ['A', 'B'],
    },
  ];
  const issues = ValidationService.validateProfileAttributes(fields, { power: 5, mode: 'Z' });
  assert.ok(issues.some(i => i.includes('minimum')), 'min bound should be validated');
  assert.ok(issues.some(i => i.includes('option invalide')), 'select option set should be validated');

  const issuesRequired = ValidationService.validateProfileAttributes(fields, { power: 20 });
  assert.ok(issuesRequired.some(i => i.includes('obligatoire')), 'required field should be validated');
}

function run() {
  testConflictResolver();
  testValidationService();
  console.log('core-domain.spec: OK');
}

run();

import assert from 'node:assert/strict';
import { ValidationService } from '../application/services/ValidationService';
import type { AssignmentStatus } from '../types';

const statuses: AssignmentStatus[] = ['assigned', 'in_use', 'returned', 'lost', 'damaged'];

function isAllowed(from: AssignmentStatus, to: AssignmentStatus): boolean {
  const issues = ValidationService.validateAssignmentTransition(from, to);
  return issues.length === 0;
}

function run() {
  // Allowed transitions
  assert.equal(isAllowed('assigned', 'in_use'), true);
  assert.equal(isAllowed('assigned', 'returned'), true);
  assert.equal(isAllowed('in_use', 'damaged'), true);
  assert.equal(isAllowed('damaged', 'returned'), true);

  // Forbidden transitions
  assert.equal(isAllowed('returned', 'assigned'), false);
  assert.equal(isAllowed('returned', 'in_use'), false);
  assert.equal(isAllowed('lost', 'returned'), false);
  assert.equal(isAllowed('lost', 'in_use'), false);

  // Self transitions should stay valid (idempotent updates)
  for (const s of statuses) {
    assert.equal(isAllowed(s, s), true, `self transition ${s} -> ${s} should be valid`);
  }

  console.log('tracking-transition.spec: OK');
}

run();

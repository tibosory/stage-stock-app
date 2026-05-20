import { AssignmentService } from '../../services/tracking';
import { AssignmentRepository } from '../../infrastructure/repositories';
import { ValidationService } from '../services';

export async function moveAssignedMaterial(input: {
  assignmentId: string;
  locationId: string;
  userId?: string;
  note?: string | null;
}): Promise<void> {
  const assignment = await AssignmentRepository.byId(input.assignmentId);
  if (!assignment) throw new Error('Affectation introuvable');
  if (!ValidationService.canChangeAssignmentLocation(assignment.status)) {
    throw new Error(
      'Impossible de changer de lieu : l’affectation est terminée (retour, perdu ou abîmé) ou n’est plus active.'
    );
  }
  await AssignmentService.moveMaterial(input);
}

export async function setAssignedMaterialInUse(input: {
  assignmentId: string;
  userId?: string;
  note?: string | null;
}): Promise<void> {
  const assignment = await AssignmentRepository.byId(input.assignmentId);
  if (!assignment) throw new Error('Affectation introuvable');
  const issues = ValidationService.validateAssignmentTransition(assignment.status, 'in_use');
  if (issues.length) throw new Error(issues.join(', '));
  await AssignmentService.setInUse(input);
}

export async function returnAssignedMaterial(input: {
  assignmentId: string;
  locationId?: string | null;
  userId?: string;
  note?: string | null;
}): Promise<void> {
  const assignment = await AssignmentRepository.byId(input.assignmentId);
  if (!assignment) throw new Error('Affectation introuvable');
  const issues = ValidationService.validateAssignmentTransition(assignment.status, 'returned');
  if (issues.length) throw new Error(issues.join(', '));
  await AssignmentService.returnMaterial(input);
}

export async function reportAssignedMaterialIssue(input: {
  assignmentId: string;
  status: 'lost' | 'damaged';
  userId?: string;
  note?: string | null;
}): Promise<void> {
  const assignment = await AssignmentRepository.byId(input.assignmentId);
  if (!assignment) throw new Error('Affectation introuvable');
  const issues = ValidationService.validateAssignmentTransition(assignment.status, input.status);
  if (issues.length) throw new Error(issues.join(', '));
  await AssignmentService.reportIssue(input);
}

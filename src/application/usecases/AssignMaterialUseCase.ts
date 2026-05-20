import { AssignmentService } from '../../services/tracking';
import { ValidationService } from '../services/ValidationService';
import type { Assignment } from '../../types';

export async function assignMaterialToTour(input: {
  materialId: string;
  tourId: string;
  locationId?: string | null;
  flightcaseId?: string | null;
  quantity: number;
  userId?: string;
  note?: string | null;
}): Promise<Assignment> {
  const qty = Math.floor(Number(input.quantity));
  const issues = ValidationService.validateAssignmentInput({
    materialId: input.materialId,
    tourId: input.tourId,
    quantity: qty,
  });
  if (issues.length) {
    throw new Error(issues.join(', '));
  }
  return AssignmentService.assignMaterial({ ...input, quantity: qty });
}

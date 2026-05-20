import type { Assignment, FieldDefinition } from '../../types';
import { validateAttributesAgainstSchema } from '../../lib/profileValidation';

export const ValidationService = {
  validateAssignmentInput(input: {
    materialId?: string;
    tourId?: string;
    quantity?: number;
  }): string[] {
    const issues: string[] = [];
    if (!input.materialId) issues.push('materialId requis');
    if (!input.tourId) issues.push('tourId requis');
    const q = input.quantity ?? 0;
    if (!Number.isFinite(q) || q <= 0 || !Number.isInteger(q)) {
      issues.push('La quantité doit être un entier strictement positif');
    }
    return issues;
  },

  validateAssignmentTransition(from: Assignment['status'], to: Assignment['status']): string[] {
    const transitions: Record<Assignment['status'], Assignment['status'][]> = {
      assigned: ['assigned', 'in_use', 'returned', 'lost', 'damaged'],
      in_use: ['in_use', 'returned', 'lost', 'damaged'],
      returned: ['returned'],
      lost: ['lost'],
      damaged: ['damaged', 'returned'],
    };
    const allowed = transitions[from] ?? [];
    return allowed.includes(to) ? [] : [`transition invalide: ${from} -> ${to}`];
  },

  /** Déplacer vers un autre lieu : seulement tant que le matériel est encore « sur la route ». */
  canChangeAssignmentLocation(status: Assignment['status']): boolean {
    return status === 'assigned' || status === 'in_use';
  },

  validateProfileAttributes(fields: FieldDefinition[], attributes: Record<string, unknown>): string[] {
    return validateAttributesAgainstSchema(fields, attributes).map(i => i.message);
  },
};

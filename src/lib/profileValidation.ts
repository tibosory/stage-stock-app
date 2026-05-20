import type { FieldDefinition } from '../types';

export type ValidationIssue = {
  fieldId: string;
  message: string;
};

type Attrs = Record<string, unknown>;

function isEmpty(value: unknown): boolean {
  return value == null || (typeof value === 'string' && value.trim() === '');
}

export function validateAttributesAgainstSchema(
  fields: FieldDefinition[],
  attributes: Attrs
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const field of fields) {
    if (field.isDeleted) continue;
    const value = attributes[field.id];

    if (field.required && isEmpty(value)) {
      issues.push({ fieldId: field.id, message: `${field.label}: valeur obligatoire.` });
      continue;
    }
    if (isEmpty(value)) continue;

    switch (field.type) {
      case 'text':
      case 'date':
        if (typeof value !== 'string') {
          issues.push({ fieldId: field.id, message: `${field.label}: texte attendu.` });
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean') {
          issues.push({ fieldId: field.id, message: `${field.label}: booléen attendu.` });
        }
        break;
      case 'number': {
        const num = typeof value === 'number' ? value : Number(value);
        if (!Number.isFinite(num)) {
          issues.push({ fieldId: field.id, message: `${field.label}: nombre invalide.` });
          break;
        }
        if (field.min != null && num < field.min) {
          issues.push({ fieldId: field.id, message: `${field.label}: minimum ${field.min}.` });
        }
        if (field.max != null && num > field.max) {
          issues.push({ fieldId: field.id, message: `${field.label}: maximum ${field.max}.` });
        }
        break;
      }
      case 'select': {
        if (typeof value !== 'string') {
          issues.push({ fieldId: field.id, message: `${field.label}: option texte attendue.` });
          break;
        }
        const options = field.options ?? [];
        if (options.length && !options.includes(value)) {
          issues.push({ fieldId: field.id, message: `${field.label}: option invalide.` });
        }
        break;
      }
      default:
        break;
    }
  }
  return issues;
}

import type { AssociationChecklistSnapshot } from '../../../lib/associationProfileStorage';

export type ClientPortalChecklistItem = {
  id: string;
  label: string;
  description: string;
  required: boolean;
  isComplete: (snap: AssociationChecklistSnapshot) => boolean;
};

export const CLIENT_PORTAL_CHECKLIST: ClientPortalChecklistItem[] = [
  {
    id: 'identity',
    label: 'Identité organisation',
    description: 'Nom et coordonnées de base.',
    required: true,
    isComplete: snap => Boolean(String((snap as { name?: string }).name ?? '').trim()),
  },
  {
    id: 'address',
    label: 'Adresse complète',
    description: 'Adresse, code postal et ville.',
    required: false,
    isComplete: snap => Boolean((snap as { addressFilled?: boolean }).addressFilled),
  },
  {
    id: 'contact',
    label: 'Contact principal',
    description: 'Une personne référente avec e-mail et téléphone.',
    required: true,
    isComplete: snap => Boolean((snap as { contactFilled?: boolean }).contactFilled),
  },
  {
    id: 'documents',
    label: 'Documents',
    description: 'Ajout d’au moins une pièce (assurance, programme, rider…).',
    required: false,
    isComplete: snap => Boolean((snap as { documentCategoriesPresent?: boolean }).documentCategoriesPresent),
  },
];

export function computeClientChecklistProgress(snapshot: AssociationChecklistSnapshot): {
  requiredDone: number;
  requiredTotal: number;
} {
  const req = CLIENT_PORTAL_CHECKLIST.filter(i => i.required);
  let done = 0;
  for (const item of req) {
    try {
      if (item.isComplete(snapshot)) done += 1;
    } catch {
      /* ignore */
    }
  }
  return { requiredDone: done, requiredTotal: req.length };
}

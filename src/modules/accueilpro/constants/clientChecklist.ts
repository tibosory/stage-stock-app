/**
 * Checklist portail client (complétion des dossiers association / entreprise).
 * Brancher sur les données Supabase : organizations, organization_contacts, organization_documents.
 */

export type ClientOrgSnapshot = {
  name?: string | null;
  address?: string | null;
  email?: string | null;
  contacts?: Array<{ is_primary?: boolean | null; phone?: string | null }>;
  documents?: Array<{ category?: string | null }>;
};

export type ClientChecklistItem = {
  id: string;
  label: string;
  description: string;
  required: boolean;
  isComplete: (org: ClientOrgSnapshot) => boolean;
};

export const CLIENT_PORTAL_CHECKLIST: ClientChecklistItem[] = [
  {
    id: 'org_info',
    label: 'Informations sur votre organisation',
    description: 'Nom, adresse, e-mail de contact',
    required: true,
    isComplete: o => !!(o.name?.trim() && o.address?.trim() && o.email?.trim()),
  },
  {
    id: 'contacts',
    label: 'Contacts référents',
    description: 'Au moins un contact principal avec téléphone',
    required: true,
    isComplete: o =>
      !!o.contacts?.some(c => c.is_primary && (c.phone?.trim() ?? '').length > 0),
  },
  {
    id: 'assurance',
    label: 'Attestation d’assurance',
    description: 'Document de responsabilité civile à jour',
    required: true,
    isComplete: o => !!o.documents?.some(d => d.category === 'assurance'),
  },
  {
    id: 'programme',
    label: 'Programme / descriptif',
    description: 'Déroulé, public, artistes',
    required: false,
    isComplete: o => !!o.documents?.some(d => d.category === 'programme'),
  },
  {
    id: 'rider',
    label: 'Rider technique',
    description: 'Besoins son, lumière, scène',
    required: false,
    isComplete: o => !!o.documents?.some(d => d.category === 'rider'),
  },
  {
    id: 'liste',
    label: 'Liste des intervenants / artistes',
    description: 'Noms et rôles',
    required: false,
    isComplete: o => !!o.documents?.some(d => d.category === 'liste'),
  },
];

export function computeClientChecklistProgress(org: ClientOrgSnapshot): {
  done: number;
  total: number;
  requiredDone: number;
  requiredTotal: number;
} {
  let done = 0;
  let total = CLIENT_PORTAL_CHECKLIST.length;
  let requiredDone = 0;
  let requiredTotal = 0;
  for (const item of CLIENT_PORTAL_CHECKLIST) {
    if (item.required) requiredTotal += 1;
    if (item.isComplete(org)) {
      done += 1;
      if (item.required) requiredDone += 1;
    }
  }
  return { done, total, requiredDone, requiredTotal };
}

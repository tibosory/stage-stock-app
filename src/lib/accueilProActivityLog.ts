import { appendApActivityLog } from '../db/accueilProDb';
import type { ApActivityLogAction, ApConvention } from '../types/accueilPro';

export async function logAccueilProAction(args: {
  action: ApActivityLogAction | string;
  entity: string;
  entityId?: string | null;
  summary: string;
  actorName?: string | null;
}): Promise<void> {
  try {
    await appendApActivityLog({
      action: args.action,
      entity: args.entity,
      entity_id: args.entityId ?? null,
      summary: args.summary.slice(0, 480),
      actor_name: args.actorName ?? null,
    });
  } catch {
    /* journal local non bloquant */
  }
}

export function conventionIsSigned(c: Pick<ApConvention, 'status' | 'signature_data'>): boolean {
  return c.status === 'signé' && Boolean(c.signature_data?.trim());
}

export function activityLogActionLabel(action: string): string {
  const map: Record<string, string> = {
    'rental.submitted': 'Demande soumise',
    'rental.validated': 'Demande validée',
    'rental.refused': 'Demande refusée',
    'event.saved': 'Événement enregistré',
    'convention.signed': 'Convention signée',
    'document.added': 'Document ajouté',
  };
  return map[action] ?? action;
}

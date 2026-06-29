import type { Assignment, Materiel } from '../types';

/** Affectations encore à réintégrer au stock (contenu initial non clôturé). */
export function isTourReturnPending(assignment: Assignment): boolean {
  return assignment.status === 'assigned' || assignment.status === 'in_use';
}

export type TourReturnSummary = {
  totalExpected: number;
  returnedCount: number;
  pendingAssignments: Assignment[];
  returnedAssignments: Assignment[];
};

export function summarizeTourReturns(assignments: Assignment[]): TourReturnSummary {
  const returnedAssignments = assignments.filter(a => a.status === 'returned');
  const pendingAssignments = assignments.filter(isTourReturnPending);
  const totalExpected = returnedAssignments.length + pendingAssignments.length;
  return {
    totalExpected,
    returnedCount: returnedAssignments.length,
    pendingAssignments,
    returnedAssignments,
  };
}

export function findPendingAssignmentForMaterial(
  assignments: Assignment[],
  tourId: string,
  materialId: string
): Assignment | null {
  return (
    assignments.find(
      a => a.tourId === tourId && a.materialId === materialId && isTourReturnPending(a)
    ) ?? null
  );
}

export function filterManualReturnCandidates(
  pending: Assignment[],
  materials: Materiel[],
  query: string
): { assignment: Assignment; material: Materiel }[] {
  const raw = query.trim().toLowerCase();
  const materialById = new Map(materials.map(m => [m.id, m]));
  const items = pending
    .map(a => {
      const material = materialById.get(a.materialId);
      if (!material) return null;
      return { assignment: a, material };
    })
    .filter((x): x is { assignment: Assignment; material: Materiel } => x !== null);

  if (!raw) return items.slice(0, 25);
  return items.filter(({ material }) => {
    const hay = `${material.nom} ${material.numero_serie ?? ''} ${material.qr_code ?? ''}`.toLowerCase();
    return hay.includes(raw);
  });
}

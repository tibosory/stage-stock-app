export type BeneficiairePatch = {
  nom?: string;
  organisation?: string | null;
  telephone?: string | null;
  email?: string | null;
};

export type BeneficiaireRowLike = {
  nom: string;
  organisation?: string | null;
  telephone?: string | null;
  email?: string | null;
};

export type DashboardStats = {
  totalMateriels: number;
  enPret: number;
  pretsEnCours: number;
  alertesConsommables: number;
};

export function normalizeOptionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : null;
}

export function applyBeneficiairePatch(row: BeneficiaireRowLike, patch: BeneficiairePatch): BeneficiaireRowLike {
  return {
    nom: patch.nom !== undefined ? patch.nom.trim() : row.nom,
    organisation:
      patch.organisation !== undefined ? normalizeOptionalText(patch.organisation) : (row.organisation ?? null),
    telephone:
      patch.telephone !== undefined ? normalizeOptionalText(patch.telephone) : (row.telephone ?? null),
    email: patch.email !== undefined ? normalizeOptionalText(patch.email) : (row.email ?? null),
  };
}

export function coerceDashboardStats(input: {
  totalMateriels?: number | null;
  enPret?: number | null;
  pretsEnCours?: number | null;
  alertesConsommables?: number | null;
}): DashboardStats {
  return {
    totalMateriels: input.totalMateriels ?? 0,
    enPret: input.enPret ?? 0,
    pretsEnCours: input.pretsEnCours ?? 0,
    alertesConsommables: input.alertesConsommables ?? 0,
  };
}

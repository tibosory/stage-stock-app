import type { ApSpace, ApEventFeuilleInfo } from '../types/accueilPro';

export type { ApEventFeuilleInfo };

/** Matériel et consignes affichés sur la feuille de route, par lieu / espace. */
export type FeuilleMaterialRow = {
  spaceId: string;
  spaceName: string;
  equipment: string;
};

export function emptyApEventFeuilleInfo(): ApEventFeuilleInfo {
  return { spaces: {} };
}

export function parseApEventFeuilleInfo(raw: string | null | undefined): ApEventFeuilleInfo {
  if (!raw?.trim()) return emptyApEventFeuilleInfo();
  try {
    const j = JSON.parse(raw) as Partial<ApEventFeuilleInfo>;
    const spaces: Record<string, string> = {};
    if (j.spaces && typeof j.spaces === 'object') {
      for (const [id, text] of Object.entries(j.spaces)) {
        if (typeof text === 'string' && text.trim()) spaces[id] = text;
      }
    }
    return {
      venueEquipment: typeof j.venueEquipment === 'string' ? j.venueEquipment : undefined,
      spaces,
    };
  } catch {
    return emptyApEventFeuilleInfo();
  }
}

export function serializeApEventFeuilleInfo(info: ApEventFeuilleInfo): string {
  const spaces = Object.fromEntries(
    Object.entries(info.spaces ?? {}).filter(([, v]) => typeof v === 'string' && v.trim())
  );
  const venueEquipment = info.venueEquipment?.trim();
  if (!venueEquipment && Object.keys(spaces).length === 0) return '{}';
  return JSON.stringify({
    ...(venueEquipment ? { venueEquipment } : {}),
    spaces,
  });
}

export function buildFeuilleMaterialRows(info: ApEventFeuilleInfo, spaces: ApSpace[]): FeuilleMaterialRow[] {
  return spaces
    .map(sp => ({
      spaceId: sp.id,
      spaceName: sp.name,
      equipment: (info.spaces[sp.id] ?? '').trim(),
    }))
    .filter(r => r.equipment.length > 0);
}

export function hasFeuilleMaterialContent(info: ApEventFeuilleInfo, spaces: ApSpace[]): boolean {
  if (info.venueEquipment?.trim()) return true;
  return buildFeuilleMaterialRows(info, spaces).length > 0;
}

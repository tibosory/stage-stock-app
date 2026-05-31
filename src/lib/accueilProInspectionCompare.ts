import { resolveInspectionChecksForSpace } from '../modules/accueilpro/constants/inspectionChecklist';
import type { ApRoomInspection, ApSpace } from '../types/accueilPro';

export type InspectionCompareRow = {
  checkId: string;
  label: string;
  entry?: string;
  exit?: string;
  changed: boolean;
  worsened: boolean;
};

export type SpaceInspectionCompare = {
  space: ApSpace;
  entry: ApRoomInspection | null;
  exit: ApRoomInspection | null;
  rows: InspectionCompareRow[];
};

function isWorse(prev: string | undefined, next: string | undefined): boolean {
  if (!next) return false;
  if (next === 'KO') return prev !== 'OK';
  return false;
}

export function compareInspectionsForSpace(
  space: ApSpace,
  entry: ApRoomInspection | null,
  exit: ApRoomInspection | null
): SpaceInspectionCompare {
  const checks = resolveInspectionChecksForSpace(space);
  const entryV = entry?.verifications ?? {};
  const exitV = exit?.verifications ?? {};

  const rows: InspectionCompareRow[] = checks.map(def => {
    const eVal = entryV[def.id];
    const xVal = exitV[def.id];
    const changed = eVal !== xVal && (eVal != null || xVal != null);
    return {
      checkId: def.id,
      label: def.label,
      entry: eVal,
      exit: xVal,
      changed,
      worsened: isWorse(eVal, xVal),
    };
  });

  return { space, entry, exit, rows };
}

export function countCompareIssues(block: SpaceInspectionCompare): number {
  return block.rows.filter(r => r.worsened).length;
}

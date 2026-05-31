import * as FileSystem from 'expo-file-system/legacy';

export type VenuePlanKind = 'pdf' | 'dwg';

const PLAN_EXT: Record<VenuePlanKind, string> = {
  pdf: 'pdf',
  dwg: 'dwg',
};

export function venuePlanKindFromFilename(filename?: string | null): VenuePlanKind | null {
  const lower = filename?.trim().toLowerCase() ?? '';
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.dwg')) return 'dwg';
  return null;
}

export function venuePlanMimeType(kind: VenuePlanKind): string {
  if (kind === 'pdf') return 'application/pdf';
  return 'application/acad';
}

function venuePlanDir(venueId: string): string {
  const root = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
  if (!root) throw new Error('Stockage local indisponible.');
  return `${root}accueilpro/venues/${venueId}/plan/`;
}

/** Copie un plan PDF ou DWG dans le répertoire persistant du lieu. */
export async function persistVenuePlanCopy(
  venueId: string,
  sourceUri: string,
  filename: string
): Promise<{ localUri: string; filename: string; kind: VenuePlanKind }> {
  const kind = venuePlanKindFromFilename(filename);
  if (!kind) {
    throw new Error('Format non pris en charge — choisissez un fichier PDF ou DWG.');
  }
  const base = venuePlanDir(venueId);
  await FileSystem.makeDirectoryAsync(base, { intermediates: true });
  const safeName = filename.trim().replace(/[/\\?%*:|"<>]/g, '_') || `plan.${PLAN_EXT[kind]}`;
  const dest = `${base}${Date.now()}-${safeName}`;
  await FileSystem.copyAsync({ from: sourceUri, to: dest });
  return { localUri: dest, filename: safeName, kind };
}

export async function removeVenuePlanLocal(uri: string | null | undefined): Promise<void> {
  const t = uri?.trim();
  if (!t) return;
  try {
    await FileSystem.deleteAsync(t, { idempotent: true });
  } catch {
    /* ignore */
  }
}

export async function venuePlanFileExists(uri: string | null | undefined): Promise<boolean> {
  const t = uri?.trim();
  if (!t) return false;
  try {
    const info = await FileSystem.getInfoAsync(t);
    return info.exists;
  } catch {
    return false;
  }
}

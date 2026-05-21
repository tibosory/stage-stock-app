import * as FileSystem from 'expo-file-system/legacy';

function safePdfName(name: string): string {
  const base = name.trim().replace(/[/\\?%*:|"<>]/g, '_') || 'convention.pdf';
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
}

/** Copie le PDF choisi dans documentDirectory (persistant). */
export async function persistConventionPdfCopy(
  conventionId: string,
  sourceUri: string,
  filename: string
): Promise<string> {
  const root = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
  if (!root) throw new Error('Stockage local indisponible.');
  const base = `${root}accueilpro/conventions/${conventionId}/`;
  await FileSystem.makeDirectoryAsync(base, { intermediates: true });
  const dest = `${base}${Date.now()}-${safePdfName(filename)}`;
  await FileSystem.copyAsync({ from: sourceUri, to: dest });
  return dest;
}

export async function removeConventionPdfLocal(uri: string | null | undefined): Promise<void> {
  const t = uri?.trim();
  if (!t) return;
  try {
    await FileSystem.deleteAsync(t, { idempotent: true });
  } catch {
    /* ignore */
  }
}

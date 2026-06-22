import * as FileSystem from 'expo-file-system/legacy';

/** Répertoire persistant des photos d’une position de mise technique. */
function positionPhotoDir(positionId: string): string {
  const root = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
  if (!root) throw new Error('Stockage local indisponible.');
  return `${root}mise-technique/${positionId}/`;
}

/** Copie une photo choisie/prise dans le répertoire persistant de la position. */
export async function persistPositionPhotoCopy(positionId: string, sourceUri: string): Promise<string> {
  const base = positionPhotoDir(positionId);
  await FileSystem.makeDirectoryAsync(base, { intermediates: true });
  const ext = sourceUri.toLowerCase().includes('.png') ? 'png' : 'jpg';
  const dest = `${base}${Date.now()}.${ext}`;
  await FileSystem.copyAsync({ from: sourceUri, to: dest });
  return dest;
}

/** Supprime un fichier photo local (best-effort). */
export async function removePositionPhotoLocal(uri: string | null | undefined): Promise<void> {
  const t = uri?.trim();
  if (!t || !t.startsWith('file://')) return;
  try {
    await FileSystem.deleteAsync(t, { idempotent: true });
  } catch {
    /* ignore */
  }
}

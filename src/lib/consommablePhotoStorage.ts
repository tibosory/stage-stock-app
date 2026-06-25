import * as FileSystem from 'expo-file-system/legacy';

function consommablePhotoDir(consommableId: string): string {
  const root = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
  if (!root) throw new Error('Stockage local indisponible.');
  return `${root}consommables/${consommableId}/`;
}

/** Copie une photo dans le répertoire persistant du consommable. */
export async function persistConsommablePhotoCopy(
  consommableId: string,
  sourceUri: string
): Promise<string> {
  const base = consommablePhotoDir(consommableId);
  await FileSystem.makeDirectoryAsync(base, { intermediates: true });
  const ext = sourceUri.toLowerCase().includes('.png') ? 'png' : 'jpg';
  const dest = `${base}${Date.now()}.${ext}`;
  await FileSystem.copyAsync({ from: sourceUri, to: dest });
  return dest;
}

export async function consommablePhotoFileExists(uri: string | null | undefined): Promise<boolean> {
  const t = uri?.trim();
  if (!t || !t.startsWith('file://')) return false;
  try {
    const info = await FileSystem.getInfoAsync(t);
    return info.exists;
  } catch {
    return false;
  }
}

export async function removeConsommablePhotoLocal(uri: string | null | undefined): Promise<void> {
  const t = uri?.trim();
  if (!t || !t.startsWith('file://')) return;
  try {
    await FileSystem.deleteAsync(t, { idempotent: true });
  } catch {
    /* ignore */
  }
}

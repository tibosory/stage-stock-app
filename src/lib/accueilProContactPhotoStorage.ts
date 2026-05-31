import * as FileSystem from 'expo-file-system/legacy';

function contactPhotoDir(contactId: string): string {
  const root = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
  if (!root) throw new Error('Stockage local indisponible.');
  return `${root}accueilpro/contacts/${contactId}/`;
}

/** Copie une photo choisie dans le répertoire persistant du contact. */
export async function persistContactPhotoCopy(contactId: string, sourceUri: string): Promise<string> {
  const base = contactPhotoDir(contactId);
  await FileSystem.makeDirectoryAsync(base, { intermediates: true });
  const ext = sourceUri.toLowerCase().includes('.png') ? 'png' : 'jpg';
  const dest = `${base}photo.${ext}`;
  const existing = await FileSystem.getInfoAsync(dest);
  if (existing.exists) {
    await FileSystem.deleteAsync(dest, { idempotent: true });
  }
  await FileSystem.copyAsync({ from: sourceUri, to: dest });
  return dest;
}

export async function removeContactPhotoLocal(uri: string | null | undefined): Promise<void> {
  const t = uri?.trim();
  if (!t) return;
  try {
    await FileSystem.deleteAsync(t, { idempotent: true });
  } catch {
    /* ignore */
  }
}

export async function contactPhotoExists(uri: string | null | undefined): Promise<boolean> {
  const t = uri?.trim();
  if (!t) return false;
  try {
    const info = await FileSystem.getInfoAsync(t);
    return info.exists;
  } catch {
    return false;
  }
}

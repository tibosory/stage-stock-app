/** Chemins fichiers locaux (appareil) — jamais transportés par le snapshot serveur. */
export type MaterielLocalMedia = {
  photo_local?: string | null;
  photo_url?: string | null;
  notice_pdf_local?: string | null;
  notice_pdf_url?: string | null;
  notice_photo_local?: string | null;
  notice_photo_url?: string | null;
};

export type ConsommableLocalMedia = {
  photo_local?: string | null;
  photo_url?: string | null;
};

const MATERIEL_LOCAL_PATH_KEYS = ['photo_local', 'notice_pdf_local', 'notice_photo_local'] as const;
const MATERIEL_REMOTE_URL_KEYS = ['photo_url', 'notice_pdf_url', 'notice_photo_url'] as const;
const CONSO_MEDIA_KEYS = ['photo_local', 'photo_url'] as const;

function nonEmptyLocalPath(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

/**
 * Fusionne une ligne matériel distante avec les chemins locaux existants.
 * Règle : si le serveur n'a pas de chemin local (toujours null), conserver le local.
 */
export function mergeMaterielLocalMedia(
  remote: Record<string, unknown>,
  local: MaterielLocalMedia | null | undefined
): Record<string, unknown> {
  if (!local) return { ...remote };
  const merged: Record<string, unknown> = { ...remote };
  for (const key of MATERIEL_LOCAL_PATH_KEYS) {
    const remoteVal = nonEmptyLocalPath(remote[key]);
    const localVal = nonEmptyLocalPath(local[key]);
    if (!remoteVal && localVal) {
      merged[key] = localVal;
    }
  }
  for (const key of MATERIEL_REMOTE_URL_KEYS) {
    const remoteVal = nonEmptyLocalPath(remote[key]);
    const localVal = nonEmptyLocalPath(local[key]);
    if (!remoteVal && localVal) {
      merged[key] = localVal;
    }
  }
  return merged;
}

/**
 * Fusionne une ligne consommable distante avec photo locale / URL déjà connues.
 * Le serveur n’envoie jamais photo_local ; photo_url peut être absent si pas encore téléversée.
 */
export function mergeConsommableLocalMedia(
  remote: Record<string, unknown>,
  local: ConsommableLocalMedia | null | undefined
): Record<string, unknown> {
  if (!local) return { ...remote };
  const merged: Record<string, unknown> = { ...remote };
  for (const key of CONSO_MEDIA_KEYS) {
    const remoteVal = nonEmptyLocalPath(remote[key]);
    const localVal = nonEmptyLocalPath(local[key]);
    if (!remoteVal && localVal) {
      merged[key] = localVal;
    }
  }
  return merged;
}

/** Exclut du snapshot entrant les lignes encore non poussées localement (synced = 0). */
export function filterSnapshotRowsByUnsyncedIds<T extends { id?: unknown }>(
  rows: T[],
  unsyncedIds: Set<string>
): T[] {
  if (unsyncedIds.size === 0) return rows;
  return rows.filter(row => {
    if (row?.id == null) return true;
    return !unsyncedIds.has(String(row.id));
  });
}

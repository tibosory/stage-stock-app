import { Platform } from 'react-native';
import type { ApRoomInspection } from '../types/accueilPro';
import { generateApId, saveInspection } from '../db/accueilProDb';
import { getDataBackendMode } from './backendMode';
import { uploadAccueilProFileToSupabase } from './accueilProSupabaseStorage';
import type { InventorySyncEndpoint } from './inventoryApiSync';
import { accueilProMultipartFetch } from './accueilProMultipart';
import { parsePhotosJson, parseVerificationsJson } from './inspectionChecklist';

function normalizedAssetUri(uri: string): string {
  if (!uri) return uri;
  if (Platform.OS === 'android') return uri;
  return uri;
}

/**
 * Télécharge des photos locales (JPEG/PNG…) vers le PC serveur après création du contrôle.
 * `POST /api/accueilpro/inspections/:id/photos`
 */
export async function uploadAccueilProInspectionPhotos(args: {
  inspectionId: string;
  photoUris: string[];
  fieldName?: string;
  endpoint: InventorySyncEndpoint | null;
}): Promise<Response> {
  const { inspectionId, photoUris, fieldName = 'photos', endpoint } = args;

  if ((await getDataBackendMode()) === 'supabase') {
    for (let i = 0; i < photoUris.length; i++) {
      const uri = normalizedAssetUri(photoUris[i]);
      const ext = /\.png$/i.test(uri) ? 'png' : 'jpg';
      await uploadAccueilProFileToSupabase({
        localUri: uri,
        storagePath: `inspections/${inspectionId}/${i + 1}.${ext}`,
        contentType: ext === 'png' ? 'image/png' : 'image/jpeg',
      });
    }
    return new Response(JSON.stringify({ ok: true, count: photoUris.length }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const form = new FormData();

  for (let i = 0; i < photoUris.length; i++) {
    const uri = normalizedAssetUri(photoUris[i]);
    const ext = /\.png$/i.test(uri) ? 'png' : 'jpg';
    const type = ext === 'png' ? 'image/png' : 'image/jpeg';

    form.append(
      fieldName,
      // React Native polyfill fichier local (pas un Blob web).
      { uri, type, name: `${inspectionId}-${i + 1}.${ext}` } as unknown as Blob
    );
  }

  const path = `/api/accueilpro/inspections/${encodeURIComponent(inspectionId)}/photos`;
  return accueilProMultipartFetch(
    path,
    { method: 'POST', body: form },
    endpoint,
    `accueilProInspectionPhotos:${inspectionId}`
  );
}

type InspectionDraft = {
  id?: string | null;
  event_id?: string | null;
  space_id?: string | null;
  type: ApRoomInspection['type'];
  status: ApRoomInspection['status'];
  inspection_date?: string | null;
  representant_lieu?: string | null;
  representant_orga?: string | null;
  verifications: string | Record<string, string>;
  commentaire?: string | null;
  photos?: string | string[] | null;
};

/** Persiste SQLite puis tente `POST …/photos` pour les fichiers locaux encore présents dans `localPhotoUris`. */
export async function saveInspectionWithPhotoUpload(
  draft: InspectionDraft,
  localPhotoUris: string[],
  opts?: { endpoint: InventorySyncEndpoint | null }
): Promise<{ id: string; uploadError?: boolean }> {
  const endpoint = opts?.endpoint ?? null;
  const id =
    draft.id && String(draft.id).trim().length ?
      String(draft.id).trim()
    : generateApId();

  const verifications =
    typeof draft.verifications === 'string'
      ? parseVerificationsJson(draft.verifications)
      : (draft.verifications as Record<string, string>);
  const photosFromDraft =
    draft.photos == null ? []
    : typeof draft.photos === 'string' ? parsePhotosJson(draft.photos)
    : draft.photos;

  await saveInspection({
    id,
    event_id: draft.event_id ?? null,
    space_id: draft.space_id ?? null,
    type: draft.type,
    status: draft.status,
    inspection_date: draft.inspection_date ?? null,
    representant_lieu: draft.representant_lieu ?? null,
    representant_orga: draft.representant_orga ?? null,
    verifications: verifications as ApRoomInspection['verifications'],
    commentaire: draft.commentaire ?? null,
    photos: photosFromDraft,
    updated_at: new Date().toISOString(),
  });

  let uploadError = false;
  const localsOnly = localPhotoUris.filter(u => u && typeof u === 'string' && !/^https?:/i.test(u));
  if (localsOnly.length) {
    try {
      const res = await uploadAccueilProInspectionPhotos({
        inspectionId: id,
        photoUris: localsOnly,
        endpoint,
      });
      if (!res.ok) uploadError = true;
    } catch {
      uploadError = true;
    }
  }

  return { id, ...(uploadError ? { uploadError: true } : {}) };
}

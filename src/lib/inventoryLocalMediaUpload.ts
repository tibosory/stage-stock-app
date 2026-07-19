/**
 * Upload inventaire vers le serveur CATRACK local (multipart), sans Supabase.
 */
import { Platform } from 'react-native';
import { accueilProMultipartFetch } from './accueilProMultipart';
import type { InventorySyncEndpoint } from './inventoryApiSync';

function normalizedAssetUri(uri: string): string {
  if (!uri) return uri;
  if (Platform.OS === 'android') return uri;
  return uri;
}

export type InventoryLocalMediaKind =
  | 'materiel-photo'
  | 'consommable-photo'
  | 'materiel-notice-photo'
  | 'materiel-notice-pdf';

const UPLOAD_PATH: Record<InventoryLocalMediaKind, (id: string) => string> = {
  'materiel-photo': id => `/api/inventory/materiel-photos/${encodeURIComponent(id)}/upload`,
  'consommable-photo': id => `/api/inventory/consommable-photos/${encodeURIComponent(id)}/upload`,
  'materiel-notice-photo': id =>
    `/api/inventory/materiel-notice-photos/${encodeURIComponent(id)}/upload`,
  'materiel-notice-pdf': id => `/api/inventory/materiel-notice-pdfs/${encodeURIComponent(id)}/upload`,
};

/** POST multipart vers l’API locale — retourne le chemin relatif `/api/inventory/…`. */
export async function uploadInventoryMediaToLocalServer(args: {
  kind: InventoryLocalMediaKind;
  entityId: string;
  localUri: string;
  endpoint?: InventorySyncEndpoint | null;
}): Promise<string> {
  const uri = normalizedAssetUri(args.localUri);
  if (!uri.startsWith('file://')) {
    throw new Error('URI locale attendue pour upload inventaire.');
  }

  const isPdf = args.kind === 'materiel-notice-pdf';
  const ext = isPdf ? 'pdf' : /\.png$/i.test(uri) ? 'png' : 'jpg';
  const fieldName = isPdf ? 'file' : 'photo';
  const form = new FormData();
  form.append(
    fieldName,
    {
      uri,
      type: isPdf ? 'application/pdf' : ext === 'png' ? 'image/png' : 'image/jpeg',
      name: `${args.entityId}.${ext}`,
    } as unknown as Blob,
  );

  const path = UPLOAD_PATH[args.kind](args.entityId);
  const res = await accueilProMultipartFetch(
    path,
    { method: 'POST', body: form },
    args.endpoint ?? null,
    `inventoryMedia:${args.kind}:${args.entityId}`,
  );
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Upload inventaire HTTP ${res.status}: ${text.slice(0, 280)}`);
  }
  let json: {
    url?: string;
    path?: string;
    photo_url?: string;
    notice_photo_url?: string;
    notice_pdf_url?: string;
  };
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    throw new Error('Réponse upload inventaire invalide.');
  }
  const url =
    json.url?.trim() ||
    json.path?.trim() ||
    json.photo_url?.trim() ||
    json.notice_photo_url?.trim() ||
    json.notice_pdf_url?.trim();
  if (!url) throw new Error('URL média absente après upload.');
  return url;
}

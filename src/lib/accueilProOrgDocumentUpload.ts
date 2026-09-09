import type { InventorySyncEndpoint } from './inventoryApiSync';
import { accueilProMultipartFetch } from './accueilProMultipart';
import { getDataBackendMode } from './backendMode';
import { uploadAccueilProFileToSupabase } from './accueilProSupabaseStorage';

function extFromMime(mimeType: string, filename?: string): string {
  const fromName = filename?.includes('.') ? filename.slice(filename.lastIndexOf('.')) : '';
  if (fromName && fromName.length <= 8) return fromName;
  if (mimeType.includes('pdf')) return '.pdf';
  if (mimeType.startsWith('image/jpeg') || mimeType === 'image/jpg') return '.jpg';
  if (mimeType.startsWith('image/png')) return '.png';
  if (mimeType.startsWith('image/webp')) return '.webp';
  if (mimeType.startsWith('image/')) return '.img';
  if (mimeType.startsWith('audio/mpeg') || mimeType.includes('mp3')) return '.mp3';
  if (mimeType.startsWith('audio/')) return '.audio';
  if (mimeType.includes('mp4') || mimeType === 'video/mp4') return '.mp4';
  if (mimeType.startsWith('video/')) return '.video';
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return '.xlsx';
  if (mimeType.includes('msword')) return '.doc';
  if (mimeType.includes('wordprocessingml')) return '.docx';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '.pptx';
  if (mimeType.includes('zip') || mimeType.includes('compressed')) return '.zip';
  if (mimeType.includes('dwg') || mimeType.includes('acad')) return '.dwg';
  if (mimeType.includes('plain')) return '.txt';
  return '.bin';
}

/**
 * Téléverse un document d’organisation ou d’événement (PC local ou Supabase Storage).
 */
export async function uploadAccueilProOrganizationDocument(args: {
  organizationId: string;
  eventId?: string | null;
  fileUri: string;
  title: string;
  category?: string;
  mimeType: string;
  filename: string;
  endpoint: InventorySyncEndpoint | null;
  fieldName?: string;
}): Promise<Response> {
  const hasExt = /\.[a-z0-9]{1,8}$/i.test(args.filename.trim());
  const ext = hasExt ? '' : extFromMime(args.mimeType, args.filename);
  const safeName = args.filename.trim() || `${args.organizationId}-${Date.now().toString(36)}${ext}`;

  if ((await getDataBackendMode()) === 'supabase') {
    const folder = args.eventId ? `events/${args.eventId}` : `organizations/${args.organizationId}`;
    const storagePath = `${folder}/${Date.now().toString(36)}-${safeName}`;
    await uploadAccueilProFileToSupabase({
      localUri: args.fileUri,
      storagePath,
      contentType: args.mimeType,
    });
    return new Response(
      JSON.stringify({ ok: true, path: storagePath, title: args.title, event_id: args.eventId ?? null }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const form = new FormData();
  form.append('title', args.title);
  if (args.category) form.append('category', args.category);
  if (args.eventId) form.append('event_id', args.eventId);
  form.append(args.fieldName ?? 'file', {
    uri: args.fileUri,
    type: args.mimeType,
    name: safeName,
  } as unknown as Blob);

  const path = `/api/accueilpro/organizations/${encodeURIComponent(args.organizationId)}/documents`;
  return accueilProMultipartFetch(
    path,
    { method: 'POST', body: form },
    args.endpoint,
    `accueilProOrgDocument:${args.organizationId}:${args.eventId ?? 'org'}`
  );
}

/** @deprecated utiliser uploadAccueilProOrganizationDocument */
export async function uploadAccueilProOrganizationPdf(args: {
  organizationId: string;
  fileUri: string;
  title: string;
  category?: string;
  endpoint: InventorySyncEndpoint | null;
  fieldName?: string;
}): Promise<Response> {
  return uploadAccueilProOrganizationDocument({
    ...args,
    mimeType: 'application/pdf',
    filename: `${args.organizationId}-${Date.now().toString(36)}.pdf`,
  });
}

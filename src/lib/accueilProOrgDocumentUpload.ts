import type { InventorySyncEndpoint } from './inventoryApiSync';
import { accueilProMultipartFetch } from './accueilProMultipart';
import { getDataBackendMode } from './backendMode';
import { uploadAccueilProFileToSupabase } from './accueilProSupabaseStorage';

function extFromMime(mimeType: string): string {
  if (mimeType.includes('pdf')) return '.pdf';
  if (mimeType.startsWith('audio/')) return mimeType.includes('mpeg') ? '.mp3' : '.audio';
  if (mimeType.startsWith('video/')) return mimeType.includes('mp4') ? '.mp4' : '.video';
  return '';
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
  const ext = extFromMime(args.mimeType) || (args.filename.includes('.') ? '' : '.bin');
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

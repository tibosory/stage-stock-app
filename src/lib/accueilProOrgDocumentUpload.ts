import type { InventorySyncEndpoint } from './inventoryApiSync';
import { accueilProMultipartFetch } from './accueilProMultipart';
import { getDataBackendMode } from './backendMode';
import { uploadAccueilProFileToSupabase } from './accueilProSupabaseStorage';

/**
 * Téléverse un PDF d’organisation (PC local ou Supabase Storage selon backend).
 */
export async function uploadAccueilProOrganizationPdf(args: {
  organizationId: string;
  fileUri: string;
  title: string;
  category?: string;
  endpoint: InventorySyncEndpoint | null;
  fieldName?: string;
}): Promise<Response> {
  if ((await getDataBackendMode()) === 'supabase') {
    const filename = `${args.organizationId}-${Date.now().toString(36)}.pdf`;
    const storagePath = `organizations/${args.organizationId}/${filename}`;
    await uploadAccueilProFileToSupabase({
      localUri: args.fileUri,
      storagePath,
      contentType: 'application/pdf',
    });
    return new Response(JSON.stringify({ ok: true, path: storagePath, title: args.title }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { organizationId, fileUri, title, category, endpoint, fieldName = 'file' } = args;
  const form = new FormData();
  form.append('title', title);
  if (category) form.append('category', category);
  form.append(fieldName, {
    uri: fileUri,
    type: 'application/pdf',
    name: `${organizationId}-${Date.now().toString(36)}.pdf`,
  } as unknown as Blob);

  const path = `/api/accueilpro/organizations/${encodeURIComponent(organizationId)}/documents`;
  return accueilProMultipartFetch(
    path,
    { method: 'POST', body: form },
    endpoint,
    `accueilProOrgDocument:${organizationId}`
  );
}

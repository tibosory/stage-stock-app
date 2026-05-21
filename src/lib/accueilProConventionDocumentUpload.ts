import type { InventorySyncEndpoint } from './inventoryApiSync';
import { accueilProMultipartFetch } from './accueilProMultipart';
import { getDataBackendMode } from './backendMode';
import { uploadAccueilProFileToSupabase } from './accueilProSupabaseStorage';

/** Téléverse le PDF convention (PC local ou Supabase Storage selon backend). */
export async function uploadAccueilProConventionPdf(args: {
  conventionId: string;
  fileUri: string;
  filename: string;
  endpoint: InventorySyncEndpoint | null;
}): Promise<{ storagePath: string; filename: string }> {
  if ((await getDataBackendMode()) === 'supabase') {
    const safeName = args.filename.replace(/[^\w.\-()+ ]+/g, '_') || 'convention.pdf';
    const storagePath = `conventions/${args.conventionId}/${safeName}`;
    const uploaded = await uploadAccueilProFileToSupabase({
      localUri: args.fileUri,
      storagePath,
      contentType: 'application/pdf',
    });
    return { storagePath: uploaded.storagePath, filename: safeName };
  }

  const form = new FormData();
  form.append('filename', args.filename);
  form.append('file', {
    uri: args.fileUri,
    type: 'application/pdf',
    name: args.filename,
  } as unknown as Blob);

  const path = `/api/accueilpro/conventions/${encodeURIComponent(args.conventionId)}/document`;
  const res = await accueilProMultipartFetch(
    path,
    { method: 'POST', body: form },
    args.endpoint,
    `accueilProConventionPdf:${args.conventionId}`
  );
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Upload convention PDF HTTP ${res.status}: ${text.slice(0, 280)}`);
  }
  let json: { path?: string; filename?: string };
  try {
    json = JSON.parse(text) as { path?: string; filename?: string };
  } catch {
    throw new Error('Réponse upload convention invalide.');
  }
  const storagePath = json.path?.trim();
  if (!storagePath) throw new Error('Chemin serveur absent après upload.');
  return { storagePath, filename: json.filename?.trim() || args.filename };
}

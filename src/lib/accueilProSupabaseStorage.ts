import { getSupabase, isSupabaseConfigured } from './supabase';
import { canCallSupabaseSync } from './syncGuards';

export const ACCUEILPRO_FILES_BUCKET = 'accueilpro-files';

export async function uploadAccueilProFileToSupabase(args: {
  localUri: string;
  storagePath: string;
  contentType: string;
}): Promise<{ storagePath: string; publicUrl: string }> {
  const guard = await canCallSupabaseSync('uploadAccueilProFileToSupabase');
  if (!guard.ok) throw new Error(guard.reason);
  if (!isSupabaseConfigured()) throw new Error('Supabase non configuré');

  const path = args.storagePath.replace(/^\/+/, '');
  const response = await fetch(args.localUri);
  const blob = await response.blob();

  const sb = getSupabase();
  const { error } = await sb.storage.from(ACCUEILPRO_FILES_BUCKET).upload(path, blob, {
    upsert: true,
    contentType: args.contentType,
  });
  if (error) throw new Error(`Storage Accueil Pro: ${error.message}`);

  const { data } = sb.storage.from(ACCUEILPRO_FILES_BUCKET).getPublicUrl(path);
  return { storagePath: path, publicUrl: data.publicUrl };
}

export function accueilProSupabasePublicUrl(storagePath: string): string {
  const { data } = getSupabase().storage.from(ACCUEILPRO_FILES_BUCKET).getPublicUrl(storagePath.replace(/^\/+/, ''));
  return data.publicUrl;
}

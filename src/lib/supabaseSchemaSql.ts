import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { SUPABASE_MOBILE_SCHEMA_SQL } from '../content/supabaseMobileSchema.sql';

const SUPABASE_SCHEMA_SQL = SUPABASE_MOBILE_SCHEMA_SQL;

export async function exportShareSupabaseSchemaSql(): Promise<void> {
  const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!dir) throw new Error('Impossible de trouver un dossier local pour exporter le schema SQL.');
  const path = `${dir}stagestock-supabase-schema.sql`;
  await FileSystem.writeAsStringAsync(path, SUPABASE_SCHEMA_SQL, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, {
      mimeType: 'application/sql',
      dialogTitle: 'Schema SQL Supabase StageStock',
      UTI: 'public.sql',
    });
  }
}


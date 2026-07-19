/**
 * Téléversement / téléchargement des médias matériel (photo, notices PDF/photo).
 */
import * as FileSystem from 'expo-file-system/legacy';
import type { SqliteDb } from '../db/coreDb';
import type { InventorySyncEndpoint } from './inventoryApiSync';
import { getResolvedApiBase } from '../config/stageStockApi';
import { stripStageStockServerRootSuffix } from './apiEndpointStorage';
import { buildServerAuthHeaders } from './serverAuthHeaders';
import {
  ensureMaterielAttachmentsDir,
  mediaFileExists,
  persistMaterielMainPhotoCopy,
  storedMaterielPhotoPath,
  storedNoticePdfPath,
  storedNoticePhotoPath,
  syncMaterielNoticeAttachments,
} from './materielAttachments';
import {
  isSupabaseConfigured,
  pushMaterielNoticesToSupabaseAfterSave,
  uploadPhoto,
} from './supabase';
import { getDataBackendMode } from './backendMode';
import { uploadInventoryMediaToLocalServer } from './inventoryLocalMediaUpload';

function joinApiUrl(base: string, path: string): string {
  const b = stripStageStockServerRootSuffix(base.replace(/\/+$/, ''));
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}

async function downloadRemoteFileToPath(args: {
  remoteUrl: string;
  destPath: string;
  endpoint?: InventorySyncEndpoint | null;
}): Promise<string> {
  const remoteUrl = args.remoteUrl.trim();
  let url: string;
  let headers: Record<string, string> = {};

  if (/^https?:\/\//i.test(remoteUrl)) {
    url = remoteUrl;
  } else {
    const base = args.endpoint?.baseUrl?.trim()
      ? args.endpoint.baseUrl.trim().replace(/\/+$/, '')
      : ((await getResolvedApiBase()) ?? '').replace(/\/+$/, '');
    if (!base) throw new Error('API non configurée pour télécharger le fichier.');
    const rel = remoteUrl.startsWith('/') ? remoteUrl : `/${remoteUrl}`;
    url = joinApiUrl(base, rel);
    headers = await buildServerAuthHeaders();
  }

  const root = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!root) throw new Error('Cache indisponible.');
  const tmp = `${root}mat-dl-${Date.now()}`;
  const result = await FileSystem.downloadAsync(url, tmp, { headers });
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Téléchargement HTTP ${result.status}`);
  }
  const ex = await FileSystem.getInfoAsync(args.destPath);
  if (ex.exists) await FileSystem.deleteAsync(args.destPath, { idempotent: true });
  await FileSystem.copyAsync({ from: result.uri, to: args.destPath });
  return args.destPath;
}

/** Téléverse photo principale et notices sans URL distante (Supabase ou serveur local). */
export async function uploadPendingMaterielMedia(database: SqliteDb): Promise<void> {
  const mode = await getDataBackendMode();
  const useSupabase = mode === 'supabase' && isSupabaseConfigured();
  const useLocal = mode === 'local_server' || (!useSupabase && !isSupabaseConfigured());
  if (!useSupabase && !useLocal) return;

  const rows = await database.getAllAsync<{
    id: string;
    photo_local: string | null;
    photo_url: string | null;
    notice_pdf_local: string | null;
    notice_pdf_url: string | null;
    notice_photo_local: string | null;
    notice_photo_url: string | null;
  }>(`SELECT id, photo_local, photo_url, notice_pdf_local, notice_pdf_url,
      notice_photo_local, notice_photo_url FROM materiels`);

  for (const row of rows) {
    const id = String(row.id);

    const photoLocal = row.photo_local?.trim();
    if (photoLocal && !row.photo_url?.trim() && (await mediaFileExists(photoLocal))) {
      try {
        const url = useSupabase
          ? await uploadPhoto(photoLocal, id)
          : await uploadInventoryMediaToLocalServer({
              kind: 'materiel-photo',
              entityId: id,
              localUri: photoLocal,
            });
        if (url) {
          await database.runAsync('UPDATE materiels SET photo_url = ?, updated_at = ? WHERE id = ?', [
            url,
            new Date().toISOString(),
            id,
          ]);
        }
      } catch {
        /* retenter */
      }
    }

    if (useLocal) {
      const noticePhotoLocal = row.notice_photo_local?.trim();
      if (noticePhotoLocal && !row.notice_photo_url?.trim() && (await mediaFileExists(noticePhotoLocal))) {
        try {
          const url = await uploadInventoryMediaToLocalServer({
            kind: 'materiel-notice-photo',
            entityId: id,
            localUri: noticePhotoLocal,
          });
          await database.runAsync(
            'UPDATE materiels SET notice_photo_url = ?, updated_at = ? WHERE id = ?',
            [url, new Date().toISOString(), id],
          );
        } catch {
          /* retenter */
        }
      }
      const noticePdfLocal = row.notice_pdf_local?.trim();
      if (noticePdfLocal && !row.notice_pdf_url?.trim() && (await mediaFileExists(noticePdfLocal))) {
        try {
          const url = await uploadInventoryMediaToLocalServer({
            kind: 'materiel-notice-pdf',
            entityId: id,
            localUri: noticePdfLocal,
          });
          await database.runAsync(
            'UPDATE materiels SET notice_pdf_url = ?, updated_at = ? WHERE id = ?',
            [url, new Date().toISOString(), id],
          );
        } catch {
          /* retenter */
        }
      }
      continue;
    }

    const noticePatch: {
      notice_pdf_local?: string | null;
      notice_photo_local?: string | null;
    } = {};
    if (row.notice_pdf_local?.trim() && !row.notice_pdf_url?.trim()) {
      noticePatch.notice_pdf_local = row.notice_pdf_local;
    }
    if (row.notice_photo_local?.trim() && !row.notice_photo_url?.trim()) {
      noticePatch.notice_photo_local = row.notice_photo_local;
    }
    if (Object.keys(noticePatch).length) {
      try {
        const urlPatch = await pushMaterielNoticesToSupabaseAfterSave(id, noticePatch);
        if (Object.keys(urlPatch).length) {
          const sets: string[] = [];
          const params: (string | null)[] = [];
          if ('notice_pdf_url' in urlPatch) {
            sets.push('notice_pdf_url = ?');
            params.push(urlPatch.notice_pdf_url ?? null);
          }
          if ('notice_photo_url' in urlPatch) {
            sets.push('notice_photo_url = ?');
            params.push(urlPatch.notice_photo_url ?? null);
          }
          if (sets.length) {
            sets.push('updated_at = ?');
            params.push(new Date().toISOString(), id);
            await database.runAsync(
              `UPDATE materiels SET ${sets.join(', ')} WHERE id = ?`,
              params
            );
          }
        }
      } catch {
        /* retenter */
      }
    }
  }
}

/** Télécharge les médias distants manquants localement. */
export async function downloadMissingMaterielMedia(
  database: SqliteDb,
  endpoint?: InventorySyncEndpoint | null
): Promise<void> {
  const rows = await database.getAllAsync<{
    id: string;
    photo_local: string | null;
    photo_url: string | null;
    notice_pdf_local: string | null;
    notice_pdf_url: string | null;
    notice_photo_local: string | null;
    notice_photo_url: string | null;
  }>(`SELECT id, photo_local, photo_url, notice_pdf_local, notice_pdf_url,
      notice_photo_local, notice_photo_url FROM materiels`);

  for (const row of rows) {
    const id = String(row.id);
    const patch: Record<string, string | null> = {};

    const photoUrl = row.photo_url?.trim();
    if (photoUrl) {
      const local = row.photo_local?.trim() ?? '';
      if (!local.startsWith('file://') || !(await mediaFileExists(local))) {
        try {
          const dest = storedMaterielPhotoPath(id);
          await ensureMaterielAttachmentsDir(id);
          await downloadRemoteFileToPath({ remoteUrl: photoUrl, destPath: dest, endpoint });
          patch.photo_local = dest;
        } catch {
          /* retenter */
        }
      }
    }

    const noticePdfUrl = row.notice_pdf_url?.trim();
    if (noticePdfUrl) {
      const local = row.notice_pdf_local?.trim() ?? '';
      if (!local.startsWith('file://') || !(await mediaFileExists(local))) {
        try {
          const dest = storedNoticePdfPath(id);
          await ensureMaterielAttachmentsDir(id);
          await downloadRemoteFileToPath({ remoteUrl: noticePdfUrl, destPath: dest, endpoint });
          patch.notice_pdf_local = dest;
        } catch {
          /* retenter */
        }
      }
    }

    const noticePhotoUrl = row.notice_photo_url?.trim();
    if (noticePhotoUrl) {
      const local = row.notice_photo_local?.trim() ?? '';
      if (!local.startsWith('file://') || !(await mediaFileExists(local))) {
        try {
          const dest = storedNoticePhotoPath(id);
          await ensureMaterielAttachmentsDir(id);
          await downloadRemoteFileToPath({ remoteUrl: noticePhotoUrl, destPath: dest, endpoint });
          patch.notice_photo_local = dest;
        } catch {
          /* retenter */
        }
      }
    }

    if (Object.keys(patch).length) {
      const sets = Object.keys(patch).map(k => `${k} = ?`);
      const params = [...Object.values(patch), new Date().toISOString(), id];
      await database.runAsync(
        `UPDATE materiels SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`,
        params
      );
    }
  }
}

export { persistMaterielMainPhotoCopy, syncMaterielNoticeAttachments };

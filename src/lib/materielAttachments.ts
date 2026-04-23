import * as FileSystem from 'expo-file-system/legacy';
import type { Materiel } from '../types';

const ROOT = 'materiel_attachments';

function norm(uri: string): string {
  return uri.replace(/\\/g, '/');
}

export function storedNoticePdfPath(materielId: string): string {
  const base = FileSystem.documentDirectory;
  if (!base) throw new Error('Stockage document indisponible');
  return `${base}${ROOT}/${materielId}/notice.pdf`;
}

export function storedNoticePhotoPath(materielId: string): string {
  const base = FileSystem.documentDirectory;
  if (!base) throw new Error('Stockage document indisponible');
  return `${base}${ROOT}/${materielId}/notice_photo.jpg`;
}

export function isPersistedNoticePdf(uri: string, materielId: string): boolean {
  return norm(uri).includes(`${ROOT}/${materielId}/notice.pdf`);
}

export function isPersistedNoticePhoto(uri: string, materielId: string): boolean {
  return norm(uri).includes(`${ROOT}/${materielId}/notice_photo.jpg`);
}

async function ensureDir(materielId: string): Promise<void> {
  const base = FileSystem.documentDirectory;
  if (!base) throw new Error('Stockage document indisponible');
  const dir = `${base}${ROOT}/${materielId}/`;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
}

async function copyReplace(dest: string, fromUri: string): Promise<void> {
  const ex = await FileSystem.getInfoAsync(dest);
  if (ex.exists) {
    await FileSystem.deleteAsync(dest, { idempotent: true });
  }
  await FileSystem.copyAsync({ from: fromUri, to: dest });
}

export async function removeNoticePdfFile(materielId: string): Promise<void> {
  const p = storedNoticePdfPath(materielId);
  const info = await FileSystem.getInfoAsync(p);
  if (info.exists) await FileSystem.deleteAsync(p, { idempotent: true });
}

export async function removeNoticePhotoFile(materielId: string): Promise<void> {
  const p = storedNoticePhotoPath(materielId);
  const info = await FileSystem.getInfoAsync(p);
  if (info.exists) await FileSystem.deleteAsync(p, { idempotent: true });
}

/** Supprime le dossier local des pièces jointes (notice PDF / photo). */
export async function removeMaterielAttachmentsDir(materielId: string): Promise<void> {
  const base = FileSystem.documentDirectory;
  if (!base) return;
  const dir = `${base}${ROOT}/${materielId}/`;
  const info = await FileSystem.getInfoAsync(dir);
  if (info.exists) await FileSystem.deleteAsync(dir, { idempotent: true });
}

/**
 * Copie les fichiers vers le stockage persistant.
 * `undefined` = ne pas modifier cette pièce jointe.
 * Chaîne vide = supprimer la pièce jointe locale.
 */
export async function syncMaterielNoticeAttachments(
  materielId: string,
  nextPdf?: string,
  nextPhoto?: string
): Promise<Partial<Pick<Materiel, 'notice_pdf_local' | 'notice_photo_local'>>> {
  const out: Partial<Pick<Materiel, 'notice_pdf_local' | 'notice_photo_local'>> = {};

  if (nextPdf !== undefined) {
    if (nextPdf.trim()) {
      if (isPersistedNoticePdf(nextPdf, materielId)) {
        out.notice_pdf_local = storedNoticePdfPath(materielId);
      } else {
        await ensureDir(materielId);
        const dest = storedNoticePdfPath(materielId);
        await copyReplace(dest, nextPdf);
        out.notice_pdf_local = dest;
      }
    } else {
      await removeNoticePdfFile(materielId);
      out.notice_pdf_local = null;
    }
  }

  if (nextPhoto !== undefined) {
    if (nextPhoto.trim()) {
      if (isPersistedNoticePhoto(nextPhoto, materielId)) {
        out.notice_photo_local = storedNoticePhotoPath(materielId);
      } else {
        await ensureDir(materielId);
        const dest = storedNoticePhotoPath(materielId);
        await copyReplace(dest, nextPhoto);
        out.notice_photo_local = dest;
      }
    } else {
      await removeNoticePhotoFile(materielId);
      out.notice_photo_local = null;
    }
  }

  return out;
}

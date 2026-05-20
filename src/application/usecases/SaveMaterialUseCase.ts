import { insertMateriel, updateMateriel } from '../../db/inventoryDb';
import { syncMaterielNoticeAttachments } from '../../lib/materielAttachments';
import { pushMaterielNoticesToSupabaseAfterSave } from '../../lib/supabase';
import type { Materiel } from '../../types';
import { ValidationService } from '../services';

export async function saveMaterialUseCase(input: {
  existingMaterialId?: string;
  materialData: Partial<Materiel> & { nom: string };
  profileFields: any[];
  dynamicAttrs: Record<string, unknown>;
  noticePdfUri?: string;
  noticePhotoUri?: string;
  noticePdfTouched?: boolean;
  noticePhotoTouched?: boolean;
}): Promise<{ materialId: string }> {
  const hasDynamicProfile = Boolean(input.materialData.profile_id);
  if (hasDynamicProfile) {
    const issues = ValidationService.validateProfileAttributes(input.profileFields as any, input.dynamicAttrs);
    if (issues.length) {
      throw new Error(issues.join('\n'));
    }
  }

  const data = {
    ...input.materialData,
    technical_data: input.dynamicAttrs as any,
  };

  if (input.existingMaterialId) {
    const id = input.existingMaterialId;
    await updateMateriel(id, data);
    const pdfArg = input.noticePdfTouched ? input.noticePdfUri : undefined;
    const photoArg = input.noticePhotoTouched ? input.noticePhotoUri : undefined;
    const n = await syncMaterielNoticeAttachments(id, pdfArg, photoArg);
    if (Object.keys(n).length) await updateMateriel(id, n);
    const urlPatch = await pushMaterielNoticesToSupabaseAfterSave(id, n);
    if (Object.keys(urlPatch).length) await updateMateriel(id, urlPatch);
    return { materialId: id };
  }

  const newId = await insertMateriel(data as any);
  const n = await syncMaterielNoticeAttachments(newId, input.noticePdfUri, input.noticePhotoUri);
  if (Object.keys(n).length) await updateMateriel(newId, n);
  const urlPatch = await pushMaterielNoticesToSupabaseAfterSave(newId, n);
  if (Object.keys(urlPatch).length) await updateMateriel(newId, urlPatch);
  return { materialId: newId };
}

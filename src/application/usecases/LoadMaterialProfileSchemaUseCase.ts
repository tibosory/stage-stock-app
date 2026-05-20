import { ProfileSchemaSystem } from '../services';
import type { FieldDefinition, Profile } from '../../types';

export async function loadMaterialProfileSchema(input: {
  materialProfileId?: string | null;
  materialProfileVersion?: number | null;
}): Promise<{
  profiles: Profile[];
  selectedProfileId: string;
  selectedProfileVersion: number | null;
  fields: FieldDefinition[];
}> {
  const list = await ProfileSchemaSystem.listProfiles();
  const activeProfiles = list.filter(p => p.isActive);
  const selectedProfileId =
    (input.materialProfileId ?? '').trim() || activeProfiles.find(p => p.isActive)?.id || '';
  if (!selectedProfileId) {
    return {
      profiles: activeProfiles,
      selectedProfileId: '',
      selectedProfileVersion: null,
      fields: [],
    };
  }

  const schema = await ProfileSchemaSystem.getCurrentSchema(
    selectedProfileId,
    input.materialProfileVersion ?? undefined
  );
  return {
    profiles: activeProfiles,
    selectedProfileId,
    selectedProfileVersion: schema?.version ?? null,
    fields: schema?.fields ?? [],
  };
}

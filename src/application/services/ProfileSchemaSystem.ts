import { ProfileRepository } from '../../infrastructure/repositories';
import type { FieldDefinition } from '../../types';

export const ProfileSchemaSystem = {
  listProfiles: ProfileRepository.list,
  createProfile: ProfileRepository.create,
  setProfileActive: ProfileRepository.setActive,
  getCurrentSchema: ProfileRepository.currentSchema,
  getVersionHistory: ProfileRepository.history,
  saveNewVersion: (profileId: string, fields: FieldDefinition[], nextName?: string) =>
    ProfileRepository.saveNewVersion(profileId, fields, nextName),
};

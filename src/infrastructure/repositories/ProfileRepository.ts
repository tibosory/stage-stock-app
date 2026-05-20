import {
  createProfile,
  getProfileSchema,
  getProfileVersionHistory,
  getProfiles,
  saveProfileSchemaNewVersion,
  setProfileActive,
} from '../../db/profileDb';

export const ProfileRepository = {
  list: getProfiles,
  create: createProfile,
  setActive: setProfileActive,
  currentSchema: getProfileSchema,
  history: getProfileVersionHistory,
  saveNewVersion: saveProfileSchemaNewVersion,
};

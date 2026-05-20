import { ProfileSchemaSystem, ValidationService } from '../services';
import type { FieldDefinition, ProfileSchema } from '../../types';
import { DomainEventBus } from '../events';

export async function createProfile(input: { name: string }) {
  const name = input.name.trim();
  if (!name) {
    throw new Error('Nom de profil requis');
  }
  const profile = await ProfileSchemaSystem.createProfile(name);
  await DomainEventBus.publish('profile.created', {
    profileId: profile.id,
    name: profile.name,
    isActive: profile.isActive,
  });
  return profile;
}

export async function saveProfileSchemaVersion(input: {
  profileId: string;
  fields: FieldDefinition[];
  nextName?: string;
}): Promise<ProfileSchema> {
  if (!input.profileId) {
    throw new Error('profileId requis');
  }
  const schema = await ProfileSchemaSystem.saveNewVersion(input.profileId, input.fields, input.nextName);
  await DomainEventBus.publish('profile.schema_version_saved', {
    profileId: schema.profileId,
    version: schema.version,
    fieldsCount: schema.fields.length,
  });
  return schema;
}

export function validateProfileSchemaPreview(input: {
  fields: FieldDefinition[];
  values: Record<string, unknown>;
}): string[] {
  return ValidationService.validateProfileAttributes(input.fields, input.values);
}

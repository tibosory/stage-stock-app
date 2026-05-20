import type { FieldDefinition, Profile, ProfileSchema } from '../types';
import { generateId, getDB } from './database';

function sanitizeFieldsForSchema(fields: FieldDefinition[]): FieldDefinition[] {
  const seen = new Set<string>();
  return fields.map(f => {
    const id = String(f.id || '').trim();
    if (!id) throw new Error('Chaque champ doit avoir un id.');
    if (seen.has(id)) throw new Error(`ID de champ duplique: ${id}`);
    seen.add(id);
    return {
      ...f,
      id,
      label: String(f.label || '').trim(),
      type: f.type,
      required: !!f.required,
      unit: f.unit ?? null,
      defaultValue: f.defaultValue ?? null,
      options: Array.isArray(f.options) ? f.options.map(o => String(o).trim()).filter(Boolean) : [],
      min: f.min ?? null,
      max: f.max ?? null,
      isDeleted: !!f.isDeleted,
    };
  });
}

function mapProfileRow(r: any): Profile {
  return {
    id: r.id,
    name: r.name,
    version: Number(r.current_version ?? 1),
    isActive: !!r.is_active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function getProfiles(): Promise<Profile[]> {
  const database = await getDB();
  const rows = await database.getAllAsync<any>(
    'SELECT * FROM profiles ORDER BY is_active DESC, updated_at DESC'
  );
  return rows.map(mapProfileRow);
}

export async function createProfile(name: string): Promise<Profile> {
  const database = await getDB();
  const id = generateId();
  const now = new Date().toISOString();
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Nom de profil requis.');

  await database.runAsync(
    `INSERT INTO profiles (id, name, current_version, is_active, created_at, updated_at)
     VALUES (?, ?, 1, 1, ?, ?)`,
    [id, trimmed, now, now]
  );
  await database.runAsync(
    `INSERT INTO profile_schemas (profile_id, version, fields_json, created_at, updated_at)
     VALUES (?, 1, ?, ?, ?)`,
    [id, JSON.stringify([]), now, now]
  );
  const row = await database.getFirstAsync<any>('SELECT * FROM profiles WHERE id = ?', [id]);
  return mapProfileRow(row);
}

export async function setProfileActive(profileId: string, isActive: boolean): Promise<void> {
  const database = await getDB();
  await database.runAsync(
    'UPDATE profiles SET is_active = ?, updated_at = ? WHERE id = ?',
    [isActive ? 1 : 0, new Date().toISOString(), profileId]
  );
}

export async function getProfileVersionHistory(profileId: string): Promise<ProfileSchema[]> {
  const database = await getDB();
  const rows = await database.getAllAsync<any>(
    'SELECT * FROM profile_schemas WHERE profile_id = ? ORDER BY version DESC',
    [profileId]
  );
  return rows.map(r => ({
    profileId: r.profile_id,
    version: Number(r.version),
    fields: JSON.parse(r.fields_json || '[]'),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export async function getProfileSchema(
  profileId: string,
  version?: number
): Promise<ProfileSchema | null> {
  const database = await getDB();
  let row: any;
  if (version != null) {
    row = await database.getFirstAsync<any>(
      'SELECT * FROM profile_schemas WHERE profile_id = ? AND version = ?',
      [profileId, version]
    );
  } else {
    row = await database.getFirstAsync<any>(
      `SELECT s.* FROM profile_schemas s
       JOIN profiles p ON p.id = s.profile_id AND p.current_version = s.version
       WHERE s.profile_id = ?`,
      [profileId]
    );
  }
  if (!row) return null;
  return {
    profileId: row.profile_id,
    version: Number(row.version),
    fields: JSON.parse(row.fields_json || '[]'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function saveProfileSchemaNewVersion(
  profileId: string,
  fields: FieldDefinition[],
  nextName?: string
): Promise<ProfileSchema> {
  const database = await getDB();
  const now = new Date().toISOString();
  const sanitized = sanitizeFieldsForSchema(fields);
  const profile = await database.getFirstAsync<any>('SELECT * FROM profiles WHERE id = ?', [profileId]);
  if (!profile) throw new Error('Profil introuvable.');
  const nextVersion = Number(profile.current_version ?? 1) + 1;

  await database.runAsync(
    `INSERT INTO profile_schemas (profile_id, version, fields_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [profileId, nextVersion, JSON.stringify(sanitized), now, now]
  );
  await database.runAsync(
    `UPDATE profiles
     SET current_version = ?, updated_at = ?, name = COALESCE(?, name)
     WHERE id = ?`,
    [nextVersion, now, nextName?.trim() || null, profileId]
  );

  return {
    profileId,
    version: nextVersion,
    fields: sanitized,
    createdAt: now,
    updatedAt: now,
  };
}

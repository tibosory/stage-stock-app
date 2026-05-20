import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppUser, AppUserRole } from '../types';
import { generateId, getDB } from './database';
import { normalizePushTokenOrNull, uniqueNormalizedEmails } from './userDbQuery';

const APP_SESSION_USER_ID_KEY = 'stagestock_session_user_id';

export async function getSessionAppUserRole(): Promise<AppUserRole | null> {
  const id = await AsyncStorage.getItem(APP_SESSION_USER_ID_KEY);
  if (!id) return null;
  const database = await getDB();
  const row = await database.getFirstAsync<{ role: string }>(
    'SELECT role FROM app_users WHERE id = ? AND actif = 1',
    [id]
  );
  if (!row?.role) return null;
  return row.role as AppUserRole;
}

export async function listAppUsersForLogin(): Promise<Pick<AppUser, 'id' | 'nom' | 'role'>[]> {
  const database = await getDB();
  return database.getAllAsync<Pick<AppUser, 'id' | 'nom' | 'role'>>(
    'SELECT id, nom, role FROM app_users WHERE actif = 1 ORDER BY nom ASC'
  );
}

export async function listAppUsersAll(): Promise<AppUser[]> {
  const database = await getDB();
  const rows = await database.getAllAsync<any>('SELECT * FROM app_users ORDER BY nom ASC');
  return rows.map(r => ({ ...r, actif: !!r.actif, role: r.role as AppUserRole }));
}

export async function insertAppUser(
  nom: string,
  role: AppUserRole,
  pin: string,
  email?: string
): Promise<string> {
  const database = await getDB();
  const { hashPin } = await import('../lib/pinAuth');
  const uid = generateId();
  const h = await hashPin(pin);
  await database.runAsync(
    `INSERT INTO app_users (id, nom, email, role, pin_hash, actif) VALUES (?, ?, ?, ?, ?, 1)`,
    [uid, nom.trim(), email?.trim() ?? null, role, h]
  );
  return uid;
}

export async function verifyAppUserPin(userId: string, pin: string): Promise<AppUser | null> {
  const database = await getDB();
  const row = await database.getFirstAsync<any>('SELECT * FROM app_users WHERE id = ? AND actif = 1', [userId]);
  if (!row) return null;
  const { verifyPin } = await import('../lib/pinAuth');
  const ok = await verifyPin(pin, row.pin_hash);
  if (!ok) return null;
  return { ...row, actif: !!row.actif, role: row.role as AppUserRole };
}

export async function updateAppUserPin(userId: string, newPin: string): Promise<void> {
  const database = await getDB();
  const { hashPin } = await import('../lib/pinAuth');
  const h = await hashPin(newPin);
  await database.runAsync('UPDATE app_users SET pin_hash = ? WHERE id = ? AND actif = 1', [h, userId]);
}

export async function updateAppUserExpoPushToken(userId: string, token: string | null): Promise<void> {
  const database = await getDB();
  await database.runAsync('UPDATE app_users SET expo_push_token = ? WHERE id = ?', [token, userId]);
}

export async function getStaffExpoPushTokens(): Promise<string[]> {
  const database = await getDB();
  const rows = await database.getAllAsync<{ t: string }>(
    `SELECT DISTINCT trim(expo_push_token) AS t FROM app_users
     WHERE actif = 1 AND role IN ('admin', 'technicien')
       AND expo_push_token IS NOT NULL AND trim(expo_push_token) != ''`
  );
  return rows
    .map(r => normalizePushTokenOrNull(r.t))
    .filter((t): t is string => Boolean(t));
}

export async function getAdminExpoPushTokens(): Promise<string[]> {
  const database = await getDB();
  const rows = await database.getAllAsync<{ t: string }>(
    `SELECT DISTINCT trim(expo_push_token) AS t FROM app_users
     WHERE actif = 1 AND role = 'admin'
       AND expo_push_token IS NOT NULL AND trim(expo_push_token) != ''`
  );
  return rows
    .map(r => normalizePushTokenOrNull(r.t))
    .filter((t): t is string => Boolean(t));
}

export async function getAdminNotificationEmails(): Promise<string[]> {
  const database = await getDB();
  const fromUsers = await database.getAllAsync<{ email: string }>(
    `SELECT email FROM app_users
     WHERE actif = 1 AND role = 'admin'
       AND email IS NOT NULL AND trim(email) != ''`
  );
  return uniqueNormalizedEmails(fromUsers.map(r => r.email));
}

export async function getExpoPushTokenForUserId(userId: string | undefined | null): Promise<string | null> {
  if (!userId?.trim()) return null;
  const database = await getDB();
  const row = await database.getFirstAsync<{ t: string | null }>(
    `SELECT trim(expo_push_token) AS t FROM app_users WHERE id = ? AND actif = 1`,
    [userId.trim()]
  );
  return normalizePushTokenOrNull(row?.t);
}

export async function getStaffNotificationEmails(): Promise<string[]> {
  const database = await getDB();
  const fromAlertes = await database.getAllAsync<{ email: string }>(
    `SELECT email FROM alertes_email WHERE email IS NOT NULL AND trim(email) != ''`
  );
  const fromUsers = await database.getAllAsync<{ email: string }>(
    `SELECT email FROM app_users
     WHERE actif = 1 AND role IN ('admin', 'technicien')
       AND email IS NOT NULL AND trim(email) != ''`
  );
  return uniqueNormalizedEmails([...fromAlertes, ...fromUsers].map(r => r.email));
}

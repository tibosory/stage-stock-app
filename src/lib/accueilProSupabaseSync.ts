/**
 * Sync Accueil Pro via Supabase (tables ap_* + Storage).
 * Même cycle push/pull + merge LWW que l’API serveur local.
 */
import type * as SQLite from 'expo-sqlite';
import type { PostgrestError } from '@supabase/supabase-js';
import { getDB } from '../db/coreDb';
import {
  ensureAccueilProSchema,
  listUnsyncedAccueilProRows,
  markAccueilProRowsSynced,
  type AccueilProBulkPayload,
} from '../db/accueilProDb';
import {
  getAccueilProLastPullAt,
  mergeAccueilProSnapshot,
  setAccueilProLastPullAt,
  type MergeAccueilProResult,
} from './accueilProMerge';
import { getSupabase, isSupabaseConfigured } from './supabase';
import { canCallSupabaseSync } from './syncGuards';

export type AccueilProSyncDatabase = SQLite.SQLiteDatabase;

const MSG_SUPABASE = 'Supabase non configuré pour Accueil Pro.';

const LOCAL_ONLY_COLS = new Set([
  'synced',
  'local_uri',
  'document_local_uri',
  'photo_local',
]);

type ApTable =
  | 'ap_venues'
  | 'ap_organizations'
  | 'ap_spaces'
  | 'ap_organization_contacts'
  | 'ap_organization_documents'
  | 'ap_rental_requests'
  | 'ap_events'
  | 'ap_conventions'
  | 'ap_room_inspections'
  | 'ap_team_members'
  | 'ap_event_personnel'
  | 'ap_day_plan_items'
  | 'ap_day_notes';

const PUSH_ORDER: { key: keyof AccueilProBulkPayload; table: ApTable }[] = [
  { key: 'venues', table: 'ap_venues' },
  { key: 'organizations', table: 'ap_organizations' },
  { key: 'spaces', table: 'ap_spaces' },
  { key: 'organization_contacts', table: 'ap_organization_contacts' },
  { key: 'organization_documents', table: 'ap_organization_documents' },
  { key: 'rental_requests', table: 'ap_rental_requests' },
  { key: 'events', table: 'ap_events' },
  { key: 'conventions', table: 'ap_conventions' },
  { key: 'room_inspections', table: 'ap_room_inspections' },
  { key: 'team_members', table: 'ap_team_members' },
  { key: 'event_personnel', table: 'ap_event_personnel' },
  { key: 'day_plan_items', table: 'ap_day_plan_items' },
  { key: 'day_notes', table: 'ap_day_notes' },
];

const PULL_SNAPSHOT_KEYS: { table: ApTable; key: keyof AccueilProBulkPayload }[] = [
  { table: 'ap_venues', key: 'venues' },
  { table: 'ap_spaces', key: 'spaces' },
  { table: 'ap_organizations', key: 'organizations' },
  { table: 'ap_organization_contacts', key: 'organization_contacts' },
  { table: 'ap_organization_documents', key: 'organization_documents' },
  { table: 'ap_rental_requests', key: 'rental_requests' },
  { table: 'ap_events', key: 'events' },
  { table: 'ap_conventions', key: 'conventions' },
  { table: 'ap_room_inspections', key: 'room_inspections' },
  { table: 'ap_team_members', key: 'team_members' },
  { table: 'ap_event_personnel', key: 'event_personnel' },
  { table: 'ap_day_plan_items', key: 'day_plan_items' },
  { table: 'ap_day_notes', key: 'day_notes' },
];

function extractMissingColumnName(raw: string): string | null {
  const m =
    /column\s+"?([a-zA-Z0-9_]+)"?\s+(?:of relation|does not exist)/i.exec(raw) ??
    /Could not find the '([a-zA-Z0-9_]+)' column/i.exec(raw);
  return m?.[1] ?? null;
}

function sanitizeRowForRemote(row: Record<string, unknown>, table: ApTable): Record<string, unknown> {
  const out: Record<string, unknown> = { synced: true };
  for (const [k, v] of Object.entries(row)) {
    if (LOCAL_ONLY_COLS.has(k)) continue;
    out[k] = v;
  }
  if (table === 'ap_day_notes' && out.plan_date && !out.id) {
    out.id = out.plan_date;
  }
  if (typeof out.is_primary === 'number') out.is_primary = out.is_primary === 1;
  if (typeof out.all_spaces === 'number') out.all_spaces = out.all_spaces === 1;
  if (typeof out.role_permanent === 'number') out.role_permanent = out.role_permanent === 1;
  return out;
}

async function safeUpsertApTable(
  table: ApTable,
  rows: Record<string, unknown>[]
): Promise<{ error: PostgrestError | null }> {
  let current = rows;
  const sb = getSupabase();
  for (let i = 0; i < 10; i += 1) {
    const { error } = await sb.from(table).upsert(current);
    if (!error) return { error: null };
    const missing = extractMissingColumnName(error.message);
    if (!missing) return { error };
    current = current.map(row => {
      const next = { ...row };
      delete next[missing];
      return next;
    });
  }
  return { error: { message: `Trop de colonnes incompatibles (${table}).` } as PostgrestError };
}

async function fetchApTable(table: ApTable, since: string | null): Promise<Record<string, unknown>[]> {
  const sb = getSupabase();
  let q = sb.from(table).select('*');
  if (since) {
    q = q.gte('updated_at', since);
  }
  const { data, error } = await q;
  if (error) {
    if (/does not exist/i.test(error.message)) return [];
    throw new Error(`Supabase ${table}: ${error.message}`);
  }
  return (data ?? []) as Record<string, unknown>[];
}

function countBulkRows(body: AccueilProBulkPayload): number {
  return Object.values(body).reduce((n, v) => n + (Array.isArray(v) ? v.length : 0), 0);
}

export async function pushAccueilProToSupabase(
  opts?: { database?: AccueilProSyncDatabase }
): Promise<boolean> {
  const guard = await canCallSupabaseSync('pushAccueilProToSupabase');
  if (!guard.ok) throw new Error(guard.reason);
  if (!isSupabaseConfigured()) throw new Error(MSG_SUPABASE);

  const db = opts?.database ?? (await getDB());
  await ensureAccueilProSchema(db);
  const body = await listUnsyncedAccueilProRows(db);
  if (countBulkRows(body) === 0) return false;

  const applied: AccueilProBulkPayload = {};

  for (const { key, table } of PUSH_ORDER) {
    const rows = body[key];
    if (!rows?.length) continue;
    const remoteRows = rows.map(r => sanitizeRowForRemote(r, table));
    const { error } = await safeUpsertApTable(table, remoteRows);
    if (error) {
      throw new Error(`Accueil Pro Supabase ${table}: ${error.message}`);
    }
    applied[key] = rows;
  }

  await markAccueilProRowsSynced(applied, db);
  return true;
}

export async function syncAccueilProFromSupabase(
  opts?: { database?: AccueilProSyncDatabase; full?: boolean }
): Promise<MergeAccueilProResult> {
  const guard = await canCallSupabaseSync('syncAccueilProFromSupabase');
  if (!guard.ok) throw new Error(guard.reason);
  if (!isSupabaseConfigured()) throw new Error(MSG_SUPABASE);

  const db = opts?.database ?? (await getDB());
  await ensureAccueilProSchema(db);

  const since = opts?.full ? null : await getAccueilProLastPullAt(db);
  const snapshot: Record<string, unknown> = {};

  for (const { table, key } of PULL_SNAPSHOT_KEYS) {
    const rows = await fetchApTable(table, since);
    if (rows.length) snapshot[key] = rows;
  }

  const mergeResult = await mergeAccueilProSnapshot(snapshot, db);
  await setAccueilProLastPullAt(new Date().toISOString(), db);
  return mergeResult;
}

export async function syncAccueilProBidirectionalSupabase(
  opts?: { database?: AccueilProSyncDatabase }
): Promise<{ pushed: boolean; pull: MergeAccueilProResult }> {
  const pushed = await pushAccueilProToSupabase(opts);
  const pull = await syncAccueilProFromSupabase(opts);
  return { pushed, pull };
}

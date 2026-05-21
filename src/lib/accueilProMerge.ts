/**
 * Fusion incrémentale snapshot Accueil Pro (remplace l’écrasement total au pull).
 */
import type * as SQLite from 'expo-sqlite';
import { resolveLww } from '../application/sync/ConflictResolver';
import {
  ensureAccueilProSchema,
  pickSnapshotPayload,
  type AccueilProBulkPayload,
} from '../db/accueilProDb';

export type AccueilProSyncConflict = {
  id: string;
  entity: keyof AccueilProBulkPayload;
  entity_id: string;
  label: string;
  local_updated_at: string | null;
  remote_updated_at: string | null;
  remote_json: string;
  detected_at: string;
};

export type MergeAccueilProResult = {
  applied: number;
  keptLocal: number;
  conflicts: number;
  inserted: number;
};

export type MergeAction = 'insert_remote' | 'apply_remote' | 'keep_local' | 'conflict' | 'keep_local_repush';

function ts(value?: string | null): number {
  const n = value ? Date.parse(value) : 0;
  return Number.isFinite(n) ? n : 0;
}

function nowIso(): string {
  return new Date().toISOString();
}

function int01(v: unknown): number {
  if (v === true || v === 1) return 1;
  return 0;
}

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (raw == null || raw === '') return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

type LocalRow = { synced: number; updated_at?: string | null; name?: string | null; titre?: string | null };

/** Décision de fusion — exporté pour tests unitaires. */
export function decideMergeAction(local: LocalRow | null, remote: { updated_at?: string | null }): MergeAction {
  if (!local) return 'insert_remote';

  if (local.synced === 0) {
    if (ts(remote.updated_at) > ts(local.updated_at)) return 'conflict';
    return 'keep_local';
  }

  const winner = resolveLww(
    { updated_at: local.updated_at ?? undefined },
    { updated_at: remote.updated_at ?? undefined },
    'prefer_remote'
  );
  const remoteWins = ts(winner.updated_at) === ts(remote.updated_at) && ts(remote.updated_at) >= ts(local.updated_at);
  if (remoteWins && ts(remote.updated_at) > ts(local.updated_at)) return 'apply_remote';
  if (ts(local.updated_at) > ts(remote.updated_at)) return 'keep_local_repush';
  return 'keep_local';
}

async function ensureMergeSchema(db: SQLite.SQLiteDatabase): Promise<void> {
  await ensureAccueilProSchema(db);
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS ap_sync_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS ap_sync_conflicts (
      id TEXT PRIMARY KEY,
      entity TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      label TEXT,
      local_updated_at TEXT,
      remote_updated_at TEXT,
      remote_json TEXT NOT NULL,
      detected_at TEXT NOT NULL
    );
  `);
}

async function resolveMergeDb(database?: SQLite.SQLiteDatabase): Promise<SQLite.SQLiteDatabase> {
  if (database) return database;
  const { getDB } = await import('../db/coreDb');
  return getDB();
}

export async function getAccueilProLastPullAt(database?: SQLite.SQLiteDatabase): Promise<string | null> {
  const db = await resolveMergeDb(database);
  await ensureMergeSchema(db);
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM ap_sync_meta WHERE key = 'last_pull_at'`
  );
  return row?.value ?? null;
}

export async function setAccueilProLastPullAt(at: string, database?: SQLite.SQLiteDatabase): Promise<void> {
  const db = await resolveMergeDb(database);
  await ensureMergeSchema(db);
  await db.runAsync(`INSERT OR REPLACE INTO ap_sync_meta (key, value) VALUES ('last_pull_at', ?)`, [at]);
}

export async function listAccueilProConflicts(database?: SQLite.SQLiteDatabase): Promise<AccueilProSyncConflict[]> {
  const db = await resolveMergeDb(database);
  await ensureMergeSchema(db);
  const rows = await db.getAllAsync<AccueilProSyncConflict>(
    `SELECT * FROM ap_sync_conflicts ORDER BY detected_at DESC`
  );
  return rows;
}

export async function countAccueilProConflicts(database?: SQLite.SQLiteDatabase): Promise<number> {
  const db = await resolveMergeDb(database);
  await ensureMergeSchema(db);
  const row = await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) as n FROM ap_sync_conflicts`);
  return row?.n ?? 0;
}

export async function clearAccueilProConflict(conflictId: string, database?: SQLite.SQLiteDatabase): Promise<void> {
  const db = await resolveMergeDb(database);
  await db.runAsync(`DELETE FROM ap_sync_conflicts WHERE id = ?`, [conflictId]);
}

export async function resolveAccueilProConflict(
  conflict: AccueilProSyncConflict,
  choice: 'local' | 'remote',
  database?: SQLite.SQLiteDatabase
): Promise<void> {
  const db = await resolveMergeDb(database);
  await ensureMergeSchema(db);
  if (choice === 'remote') {
    const remote = JSON.parse(conflict.remote_json) as Record<string, unknown>;
    await upsertRemoteRow(db, conflict.entity, remote);
  } else if (conflict.entity === 'day_notes') {
    await db.runAsync(`UPDATE ap_day_notes SET synced = 0 WHERE plan_date = ?`, [conflict.entity_id]);
  } else {
    await db.runAsync(
      `UPDATE ${tableForEntity(conflict.entity)} SET synced = 0 WHERE id = ?`,
      [conflict.entity_id]
    );
  }
  await clearAccueilProConflict(conflict.id, db);
}

function tableForEntity(entity: keyof AccueilProBulkPayload): string {
  const map: Record<string, string> = {
    venues: 'ap_venues',
    spaces: 'ap_spaces',
    organizations: 'ap_organizations',
    organization_contacts: 'ap_organization_contacts',
    organization_documents: 'ap_organization_documents',
    rental_requests: 'ap_rental_requests',
    events: 'ap_events',
    conventions: 'ap_conventions',
    room_inspections: 'ap_room_inspections',
    team_members: 'ap_team_members',
    event_personnel: 'ap_event_personnel',
    day_plan_items: 'ap_day_plan_items',
    day_notes: 'ap_day_notes',
  };
  return map[entity] ?? 'ap_venues';
}

function labelFromRow(entity: keyof AccueilProBulkPayload, r: Record<string, unknown>): string {
  if (entity === 'conventions') return String(r.titre ?? r.id ?? '');
  if (entity === 'day_notes') return String(r.plan_date ?? '');
  if (entity === 'day_plan_items') return String(r.title ?? r.id ?? '');
  return String(r.name ?? r.title ?? r.titre ?? r.id ?? '');
}

async function recordConflict(
  db: SQLite.SQLiteDatabase,
  entity: keyof AccueilProBulkPayload,
  entityId: string,
  label: string,
  local: LocalRow,
  remote: Record<string, unknown>
): Promise<void> {
  const id = `${entity}:${entityId}`;
  await db.runAsync(
    `INSERT OR REPLACE INTO ap_sync_conflicts
      (id, entity, entity_id, label, local_updated_at, remote_updated_at, remote_json, detected_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [
      id,
      entity,
      entityId,
      label,
      local.updated_at ?? null,
      (remote.updated_at as string) ?? null,
      JSON.stringify(remote),
      nowIso(),
    ]
  );
}

async function upsertRemoteRow(
  db: SQLite.SQLiteDatabase,
  entity: keyof AccueilProBulkPayload,
  r: Record<string, unknown>
): Promise<void> {
  const now = nowIso();
  switch (entity) {
    case 'venues':
      await db.runAsync(
        `INSERT OR REPLACE INTO ap_venues (id,name,address,cp,city,phone,email,erp_type,erp_category,capacity,
          fire_notes,safety_rules,created_at,updated_at,synced)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`,
        [
          String(r.id),
          String(r.name ?? ''),
          (r.address as string) ?? null,
          (r.cp as string) ?? null,
          (r.city as string) ?? null,
          (r.phone as string) ?? null,
          (r.email as string) ?? null,
          (r.erp_type as string) ?? null,
          (r.erp_category as string) ?? null,
          r.capacity != null ? Number(r.capacity) : 0,
          (r.fire_notes as string) ?? null,
          (r.safety_rules as string) ?? null,
          (r.created_at as string) ?? now,
          (r.updated_at as string) ?? now,
        ]
      );
      break;
    case 'spaces':
      await db.runAsync(
        `INSERT OR REPLACE INTO ap_spaces (id,venue_id,name,type,capacity,description,control_points_json,updated_at,synced)
         VALUES (?,?,?,?,?,?,?,?,1)`,
        [
          String(r.id),
          String(r.venue_id ?? ''),
          String(r.name ?? ''),
          (r.type as string) ?? null,
          r.capacity != null ? Number(r.capacity) : 0,
          (r.description as string) ?? null,
          typeof r.control_points_json === 'string'
            ? r.control_points_json
            : JSON.stringify(r.control_points ?? []),
          (r.updated_at as string) ?? now,
        ]
      );
      break;
    case 'organizations':
      await db.runAsync(
        `INSERT OR REPLACE INTO ap_organizations (
          id,name,type,siret,address,cp,city,phone,email,website,supabase_user_id,status,notes_internes,created_at,updated_at,synced)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`,
        [
          String(r.id),
          String(r.name ?? ''),
          (r.type as string) ?? null,
          (r.siret as string) ?? null,
          (r.address as string) ?? null,
          (r.cp as string) ?? null,
          (r.city as string) ?? null,
          (r.phone as string) ?? null,
          (r.email as string) ?? null,
          (r.website as string) ?? null,
          r.supabase_user_id != null ? String(r.supabase_user_id) : null,
          String(r.status ?? 'actif'),
          (r.notes_internes as string) ?? (r.notes as string) ?? null,
          (r.created_at as string) ?? now,
          (r.updated_at as string) ?? now,
        ]
      );
      break;
    case 'events': {
      const sel =
        typeof r.selected_space_ids_json === 'string'
          ? (r.selected_space_ids_json as string)
          : JSON.stringify(
              (r.selected_space_ids as string[]) ??
                (Array.isArray(r.space_ids) ? (r.space_ids as string[]) : [])
            );
      await db.runAsync(
        `INSERT OR REPLACE INTO ap_events (
          id,venue_id,organization_id,name,type,organisateur,date_debut,date_fin,heure_debut,heure_fin,
          participants,description,status,spaces_mode,selected_space_ids_json,space_id,created_at,updated_at,synced)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`,
        [
          String(r.id),
          r.venue_id != null ? String(r.venue_id) : null,
          r.organization_id != null ? String(r.organization_id) : null,
          String(r.name ?? ''),
          (r.type as string) ?? null,
          (r.organisateur as string) ?? null,
          String(r.date_debut ?? ''),
          (r.date_fin as string) ?? null,
          (r.heure_debut as string) ?? null,
          (r.heure_fin as string) ?? null,
          r.participants != null ? Number(r.participants) : 0,
          (r.description as string) ?? null,
          String(r.status ?? 'brouillon'),
          String(r.spaces_mode ?? 'all'),
          sel,
          r.space_id != null ? String(r.space_id) : null,
          (r.created_at as string) ?? now,
          (r.updated_at as string) ?? now,
        ]
      );
      break;
    }
    case 'room_inspections': {
      const verifs =
        typeof r.verifications === 'string'
          ? (r.verifications as string)
          : JSON.stringify((r.verifications as Record<string, unknown>) ?? {});
      const photos =
        typeof r.photos === 'string' ? (r.photos as string) : JSON.stringify((r.photos as string[]) ?? []);
      await db.runAsync(
        `INSERT OR REPLACE INTO ap_room_inspections (
          id,event_id,space_id,type,status,inspection_date,representant_lieu,representant_orga,verifications,commentaire,photos,updated_at,synced)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1)`,
        [
          String(r.id),
          r.event_id != null ? String(r.event_id) : null,
          r.space_id != null ? String(r.space_id) : null,
          String(r.type ?? 'entrée'),
          String(r.status ?? 'en cours'),
          (r.inspection_date as string) ?? (r.date as string) ?? null,
          (r.representant_lieu as string) ?? null,
          (r.representant_orga as string) ?? null,
          verifs,
          (r.commentaire as string) ?? null,
          photos,
          (r.updated_at as string) ?? now,
        ]
      );
      break;
    }
    case 'team_members':
      await db.runAsync(
        `INSERT OR REPLACE INTO ap_team_members (
          id,venue_id,name,role,mission,phone,email,kind,organization_id,role_permanent,notes,updated_at,synced)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1)`,
        [
          String(r.id),
          String(r.venue_id ?? ''),
          String(r.name ?? ''),
          (r.role as string) ?? null,
          (r.mission as string) ?? null,
          (r.phone as string) ?? null,
          (r.email as string) ?? null,
          String(r.kind ?? 'lieu'),
          r.organization_id != null ? String(r.organization_id) : null,
          int01(r.role_permanent),
          (r.notes as string) ?? null,
          (r.updated_at as string) ?? now,
        ]
      );
      break;
    case 'event_personnel':
      await db.runAsync(
        `INSERT OR REPLACE INTO ap_event_personnel (
          id,event_id,source,name,day_role,day_mission,phone,email,source_personnel_id,updated_at,synced)
         VALUES (?,?,?,?,?,?,?,?,?,?,1)`,
        [
          String(r.id),
          String(r.event_id ?? ''),
          String(r.source ?? 'adhoc'),
          String(r.name ?? ''),
          (r.day_role as string) ?? null,
          (r.day_mission as string) ?? (r.day_role as string) ?? null,
          (r.phone as string) ?? null,
          (r.email as string) ?? null,
          r.source_personnel_id != null ? String(r.source_personnel_id) : null,
          (r.updated_at as string) ?? now,
        ]
      );
      break;
    case 'day_plan_items':
      await db.runAsync(
        `INSERT OR REPLACE INTO ap_day_plan_items (
          id,plan_date,event_id,time_start,time_end,title,assignee_name,space_id,venue_id,notes,sort_order,updated_at,synced)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1)`,
        [
          String(r.id),
          String(r.plan_date ?? ''),
          r.event_id != null ? String(r.event_id) : null,
          (r.time_start as string) ?? null,
          (r.time_end as string) ?? null,
          String(r.title ?? ''),
          (r.assignee_name as string) ?? null,
          r.space_id != null ? String(r.space_id) : null,
          r.venue_id != null ? String(r.venue_id) : null,
          (r.notes as string) ?? null,
          r.sort_order != null ? Number(r.sort_order) : 0,
          (r.updated_at as string) ?? now,
        ]
      );
      break;
    case 'day_notes':
      await db.runAsync(
        `INSERT OR REPLACE INTO ap_day_notes (plan_date,note,updated_at,synced) VALUES (?,?,?,1)`,
        [String(r.plan_date ?? ''), String(r.note ?? ''), (r.updated_at as string) ?? now]
      );
      break;
    case 'rental_requests': {
      const legacySpaceIds =
        Array.isArray(r.space_ids) ? (r.space_ids as string[]) : parseJson<string[]>(r.space_ids_json as string, []);
      const selected =
        Array.isArray(r.selected_space_ids) ?
          (r.selected_space_ids as string[])
        : parseJson<string[]>(String(r.selected_space_ids_json ?? ''), legacySpaceIds);
      await db.runAsync(
        `INSERT OR REPLACE INTO ap_rental_requests (
          id,organization_id,venue_id,space_id,event_name,
          space_ids_json,selected_space_ids_json,spaces_mode,
          date_debut,date_fin,heure_debut,heure_fin,
          participants,motif,staff_notes,
          all_spaces,status,notes,created_at,updated_at,synced)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`,
        [
          String(r.id),
          String(r.organization_id ?? ''),
          r.venue_id != null ? String(r.venue_id) : null,
          r.space_id != null ? String(r.space_id) : null,
          (r.event_name as string) ?? null,
          JSON.stringify(legacySpaceIds),
          JSON.stringify(selected),
          String(r.spaces_mode ?? 'all'),
          String(r.date_debut ?? ''),
          (r.date_fin as string) ?? null,
          (r.heure_debut as string) ?? null,
          (r.heure_fin as string) ?? null,
          r.participants != null ? Number(r.participants) : 0,
          (r.motif as string) ?? null,
          (r.staff_notes as string) ?? null,
          int01(r.all_spaces),
          String(r.status ?? 'soumise'),
          (r.notes as string) ?? null,
          (r.created_at as string) ?? now,
          (r.updated_at as string) ?? now,
        ]
      );
      break;
    }
    case 'conventions': {
      const existing = await db.getFirstAsync<{ document_local_uri: string | null }>(
        'SELECT document_local_uri FROM ap_conventions WHERE id = ?',
        [String(r.id)]
      );
      const localUri =
        (r.document_local_uri as string | undefined)?.trim() ||
        existing?.document_local_uri?.trim() ||
        null;
      await db.runAsync(
        `INSERT OR REPLACE INTO ap_conventions (
          id,event_id,titre,contenu,status,signature_data,signed_at,signed_by,
          document_local_uri,document_storage_path,document_filename,created_at,updated_at,synced)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1)`,
        [
          String(r.id),
          r.event_id != null ? String(r.event_id) : null,
          String(r.titre ?? ''),
          (r.contenu as string) ?? null,
          String(r.status ?? 'brouillon'),
          (r.signature_data as string) ?? null,
          (r.signed_at as string) ?? null,
          (r.signed_by as string) ?? null,
          localUri,
          (r.document_storage_path as string) ?? null,
          (r.document_filename as string) ?? null,
          (r.created_at as string) ?? now,
          (r.updated_at as string) ?? now,
        ]
      );
      break;
    }
    case 'organization_contacts':
      await db.runAsync(
        `INSERT OR REPLACE INTO ap_organization_contacts (id,organization_id,name,role,phone,email,is_primary,updated_at,synced)
         VALUES (?,?,?,?,?,?,?,?,1)`,
        [
          String(r.id),
          String(r.organization_id ?? ''),
          String(r.name ?? ''),
          (r.role as string) ?? null,
          (r.phone as string) ?? null,
          (r.email as string) ?? null,
          int01(r.is_primary),
          (r.updated_at as string) ?? now,
        ]
      );
      break;
    case 'organization_documents':
      await db.runAsync(
        `INSERT OR REPLACE INTO ap_organization_documents (
          id,organization_id,event_id,title,category,storage_path,public_url,file_size,mime_type,uploaded_by,created_at,local_uri,synced)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1)`,
        [
          String(r.id),
          String(r.organization_id ?? ''),
          r.event_id != null ? String(r.event_id) : null,
          String(r.title ?? ''),
          (r.category as string) ?? null,
          (r.storage_path as string) ?? (r.file_path as string) ?? null,
          (r.public_url as string) ?? null,
          r.file_size != null ? Number(r.file_size) : null,
          (r.mime_type as string) ?? null,
          r.uploaded_by != null ? String(r.uploaded_by) : null,
          (r.created_at as string) ?? now,
          (r.local_uri as string) ?? null,
        ]
      );
      break;
    default:
      break;
  }
}

async function mergeEntity(
  db: SQLite.SQLiteDatabase,
  entity: keyof AccueilProBulkPayload,
  remoteRows: Record<string, unknown>[],
  stats: MergeAccueilProResult
): Promise<void> {
  const table = tableForEntity(entity);
  for (const remote of remoteRows) {
    const id =
      entity === 'day_notes'
        ? String(remote.plan_date ?? '')
        : String(remote.id ?? '');
    if (!id) continue;

    const local =
      entity === 'day_notes'
        ? await db.getFirstAsync<{ synced: number; updated_at?: string | null }>(
            `SELECT synced, updated_at FROM ap_day_notes WHERE plan_date = ?`,
            [id]
          )
        : await db.getFirstAsync<{ synced: number; updated_at?: string | null }>(
            `SELECT synced, updated_at FROM ${table} WHERE id = ?`,
            [id]
          );
    const action = decideMergeAction(local ?? null, remote);

    switch (action) {
      case 'insert_remote':
        await upsertRemoteRow(db, entity, remote);
        stats.inserted += 1;
        stats.applied += 1;
        break;
      case 'apply_remote':
        await upsertRemoteRow(db, entity, remote);
        stats.applied += 1;
        break;
      case 'conflict':
        await recordConflict(db, entity, id, labelFromRow(entity, remote), { ...local!, updated_at: local!.updated_at }, remote);
        stats.conflicts += 1;
        stats.keptLocal += 1;
        break;
      case 'keep_local_repush':
        stats.keptLocal += 1;
        if (entity === 'day_notes') {
          await db.runAsync(`UPDATE ap_day_notes SET synced = 0 WHERE plan_date = ?`, [id]);
        } else {
          await db.runAsync(`UPDATE ${table} SET synced = 0 WHERE id = ?`, [id]);
        }
        break;
      case 'keep_local':
        stats.keptLocal += 1;
        break;
      default:
        break;
    }
  }
}

/** Fusionne le snapshot serveur sans effacer les données locales non synchronisées. */
export async function mergeAccueilProSnapshot(
  snapshot: Record<string, unknown> | AccueilProBulkPayload | null | undefined,
  database?: SQLite.SQLiteDatabase
): Promise<MergeAccueilProResult> {
  const db = await resolveMergeDb(database);
  await ensureMergeSchema(db);
  const p = pickSnapshotPayload((snapshot ?? {}) as Record<string, unknown>);

  const stats: MergeAccueilProResult = { applied: 0, keptLocal: 0, conflicts: 0, inserted: 0 };

  await db.withTransactionAsync(async () => {
    const entities = Object.keys(p) as (keyof AccueilProBulkPayload)[];
    for (const entity of entities) {
      const rows = (p[entity] ?? []) as Record<string, unknown>[];
      if (!rows.length) continue;
      await mergeEntity(db, entity, rows, stats);
    }
  });

  return stats;
}

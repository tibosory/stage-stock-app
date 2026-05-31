import type * as SQLite from 'expo-sqlite';

import type {
  ApActivityLogEntry,
  ApConvention,
  ApDayNote,
  ApDayPlanItem,
  ApEvent,
  ApEventFeuilleInfo,
  ApEventPersonnel,
  ApOrganization,
  ApOrganizationContact,
  ApOrganizationDocument,
  ApPersonnel,
  ApPersonnelKind,
  ApRentalRequest,
  ApRoomInspection,
  ApSpacesMode,
  ApSpace,
  ApVenue,
} from '../types/accueilPro';
import { parseControlPointsJson, serializeControlPointsJson } from '../lib/inspectionChecklist';
import { parseApEventFeuilleInfo, serializeApEventFeuilleInfo } from '../lib/accueilProFeuilleInfo';

type AssociationPortalProfile = {
  name: string;
  type?: string;
  siret?: string;
  address?: string;
  cp?: string;
  city?: string;
  website?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  notes?: string;
  linkedOrganizationId?: string | null;
};

const nowIso = () => new Date().toISOString();

export function generateApId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (raw == null || raw === '') return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function int01(v: number | boolean | null | undefined): number {
  if (v === true || v === 1) return 1;
  if (typeof v === 'number' && v === 1) return 1;
  return 0;
}

async function resolveDb(database?: SQLite.SQLiteDatabase): Promise<SQLite.SQLiteDatabase> {
  if (database) return database;
  const { getDB } = await import('./coreDb');
  return getDB();
}

/** Corps JSON poussé vers `POST /api/accueilpro/bulk` (clés métier lisibles pour le backend). */
export type AccueilProBulkPayload = {
  venues?: Record<string, unknown>[];
  spaces?: Record<string, unknown>[];
  organizations?: Record<string, unknown>[];
  organization_contacts?: Record<string, unknown>[];
  organization_documents?: Record<string, unknown>[];
  rental_requests?: Record<string, unknown>[];
  events?: Record<string, unknown>[];
  conventions?: Record<string, unknown>[];
  room_inspections?: Record<string, unknown>[];
  team_members?: Record<string, unknown>[];
  event_personnel?: Record<string, unknown>[];
  day_plan_items?: Record<string, unknown>[];
  day_notes?: Record<string, unknown>[];
};

export async function ensureAccueilProSchema(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS ap_venues (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT,
      cp TEXT,
      city TEXT,
      phone TEXT,
      email TEXT,
      erp_type TEXT,
      erp_category TEXT,
      capacity INTEGER DEFAULT 0,
      fire_notes TEXT,
      safety_rules TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      synced INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS ap_spaces (
      id TEXT PRIMARY KEY,
      venue_id TEXT NOT NULL REFERENCES ap_venues(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      type TEXT,
      capacity INTEGER DEFAULT 0,
      description TEXT,
      updated_at TEXT DEFAULT (datetime('now')),
      synced INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS ap_organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT,
      siret TEXT,
      address TEXT,
      cp TEXT,
      city TEXT,
      phone TEXT,
      email TEXT,
      website TEXT,
      supabase_user_id TEXT,
      status TEXT NOT NULL DEFAULT 'actif',
      notes_internes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      synced INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS ap_organization_contacts (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES ap_organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      role TEXT,
      phone TEXT,
      email TEXT,
      is_primary INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now')),
      synced INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS ap_organization_documents (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES ap_organizations(id) ON DELETE CASCADE,
      event_id TEXT,
      title TEXT NOT NULL,
      category TEXT,
      storage_path TEXT,
      public_url TEXT,
      file_size INTEGER,
      mime_type TEXT,
      uploaded_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      local_uri TEXT,
      synced INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS ap_rental_requests (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES ap_organizations(id) ON DELETE CASCADE,
      venue_id TEXT REFERENCES ap_venues(id) ON DELETE SET NULL,
      space_ids_json TEXT,
      date_debut TEXT NOT NULL,
      date_fin TEXT,
      participants INTEGER DEFAULT 0,
      all_spaces INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'en_attente',
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      synced INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS ap_events (
      id TEXT PRIMARY KEY,
      venue_id TEXT REFERENCES ap_venues(id) ON DELETE SET NULL,
      organization_id TEXT REFERENCES ap_organizations(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      type TEXT,
      organisateur TEXT,
      date_debut TEXT NOT NULL,
      date_fin TEXT,
      heure_debut TEXT,
      heure_fin TEXT,
      participants INTEGER DEFAULT 0,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'brouillon',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      synced INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS ap_room_inspections (
      id TEXT PRIMARY KEY,
      event_id TEXT REFERENCES ap_events(id) ON DELETE SET NULL,
      space_id TEXT REFERENCES ap_spaces(id) ON DELETE SET NULL,
      type TEXT NOT NULL CHECK (type IN ('entrée', 'sortie')),
      status TEXT NOT NULL DEFAULT 'en cours' CHECK (status IN ('en cours', 'terminé')),
      inspection_date TEXT,
      representant_lieu TEXT,
      representant_orga TEXT,
      verifications TEXT NOT NULL DEFAULT '{}',
      commentaire TEXT,
      photos TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT DEFAULT (datetime('now')),
      synced INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS ap_conventions (
      id TEXT PRIMARY KEY,
      event_id TEXT REFERENCES ap_events(id) ON DELETE SET NULL,
      titre TEXT NOT NULL,
      contenu TEXT,
      status TEXT NOT NULL DEFAULT 'brouillon',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      synced INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS ap_team_members (
      id TEXT PRIMARY KEY,
      venue_id TEXT NOT NULL REFERENCES ap_venues(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      role TEXT,
      mission TEXT,
      phone TEXT,
      email TEXT,
      updated_at TEXT DEFAULT (datetime('now')),
      synced INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_ap_spaces_venue ON ap_spaces(venue_id);
    CREATE INDEX IF NOT EXISTS idx_ap_events_venue ON ap_events(venue_id);
    CREATE INDEX IF NOT EXISTS idx_ap_events_org ON ap_events(organization_id);
    CREATE INDEX IF NOT EXISTS idx_ap_events_date ON ap_events(date_debut);
    CREATE INDEX IF NOT EXISTS idx_ap_inspections_event ON ap_room_inspections(event_id);
    CREATE INDEX IF NOT EXISTS idx_ap_team_venue ON ap_team_members(venue_id);
    CREATE INDEX IF NOT EXISTS idx_ap_org_docs_org ON ap_organization_documents(organization_id);
    CREATE INDEX IF NOT EXISTS idx_ap_rentals_org ON ap_rental_requests(organization_id);
  `);

  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS ap_event_personnel (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES ap_events(id) ON DELETE CASCADE,
      source TEXT NOT NULL DEFAULT 'adhoc',
      name TEXT NOT NULL,
      day_role TEXT,
      phone TEXT,
      email TEXT,
      source_personnel_id TEXT REFERENCES ap_team_members(id) ON DELETE SET NULL,
      updated_at TEXT DEFAULT (datetime('now')),
      synced INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_ap_event_pers_event ON ap_event_personnel(event_id);
  `);

  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS ap_day_plan_items (
      id TEXT PRIMARY KEY,
      plan_date TEXT NOT NULL,
      event_id TEXT REFERENCES ap_events(id) ON DELETE SET NULL,
      time_start TEXT,
      time_end TEXT,
      title TEXT NOT NULL,
      assignee_name TEXT,
      space_id TEXT REFERENCES ap_spaces(id) ON DELETE SET NULL,
      venue_id TEXT REFERENCES ap_venues(id) ON DELETE SET NULL,
      notes TEXT,
      sort_order INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now')),
      synced INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_ap_day_plan_date ON ap_day_plan_items(plan_date);

    CREATE TABLE IF NOT EXISTS ap_day_notes (
      plan_date TEXT PRIMARY KEY,
      note TEXT NOT NULL DEFAULT '',
      updated_at TEXT DEFAULT (datetime('now')),
      synced INTEGER DEFAULT 0
    );
  `);

  const addCol = async (table: string, name: string, defSql: string) => {
    const rows = await database.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
    if (!rows.some(r => r.name === name)) {
      await database.execAsync(`ALTER TABLE ${table} ADD COLUMN ${name} ${defSql}`);
    }
  };

  await addCol('ap_team_members', 'kind', "TEXT NOT NULL DEFAULT 'lieu'");
  await addCol('ap_team_members', 'organization_id', 'TEXT');
  await addCol('ap_team_members', 'role_permanent', 'INTEGER DEFAULT 0');
  await addCol('ap_team_members', 'notes', 'TEXT');
  await addCol('ap_team_members', 'first_name', 'TEXT');
  await addCol('ap_team_members', 'last_name', 'TEXT');
  await addCol('ap_team_members', 'address', 'TEXT');
  await addCol('ap_team_members', 'photo_uri', 'TEXT');
  await addCol('ap_team_members', 'photo_storage_path', 'TEXT');

  await addCol('ap_venues', 'plan_local_uri', 'TEXT');
  await addCol('ap_venues', 'plan_filename', 'TEXT');
  await addCol('ap_venues', 'plan_storage_path', 'TEXT');

  await addCol('ap_event_personnel', 'day_mission', 'TEXT');

  await addCol('ap_events', 'spaces_mode', "TEXT DEFAULT 'all'");
  await addCol('ap_events', 'selected_space_ids_json', "TEXT DEFAULT '[]'");
  await addCol('ap_events', 'space_id', 'TEXT REFERENCES ap_spaces(id) ON DELETE SET NULL');
  await addCol('ap_events', 'readiness_manual_json', "TEXT DEFAULT '{}'");
  await addCol('ap_events', 'feuille_note', 'TEXT');
  await addCol('ap_events', 'feuille_info_json', "TEXT DEFAULT '{}'");

  await addCol('ap_rental_requests', 'space_id', 'TEXT');
  await addCol('ap_rental_requests', 'event_name', 'TEXT');
  await addCol('ap_rental_requests', 'heure_debut', 'TEXT');
  await addCol('ap_rental_requests', 'heure_fin', 'TEXT');
  await addCol('ap_rental_requests', 'motif', 'TEXT');
  await addCol('ap_rental_requests', 'staff_notes', 'TEXT');
  await addCol('ap_rental_requests', 'spaces_mode', "TEXT DEFAULT 'all'");
  await addCol('ap_rental_requests', 'selected_space_ids_json', "TEXT DEFAULT '[]'");
  await addCol('ap_conventions', 'signature_data', 'TEXT');
  await addCol('ap_conventions', 'signed_at', 'TEXT');
  await addCol('ap_conventions', 'signed_by', 'TEXT');
  await addCol('ap_conventions', 'document_local_uri', 'TEXT');
  await addCol('ap_conventions', 'document_storage_path', 'TEXT');
  await addCol('ap_conventions', 'document_filename', 'TEXT');
  await addCol('ap_conventions', 'venue_id', 'TEXT REFERENCES ap_venues(id) ON DELETE SET NULL');
  await addCol('ap_spaces', 'control_points_json', "TEXT DEFAULT '[]'");
  await addCol('ap_organization_documents', 'event_id', 'TEXT');

  /** Bases créées avant l’ajout systématique de updated_at (sync Accueil Pro). */
  for (const table of [
    'ap_venues',
    'ap_spaces',
    'ap_organizations',
    'ap_organization_contacts',
    'ap_organization_documents',
    'ap_rental_requests',
    'ap_events',
    'ap_room_inspections',
    'ap_conventions',
    'ap_team_members',
    'ap_event_personnel',
    'ap_day_plan_items',
    'ap_day_notes',
  ] as const) {
    await addCol(table, 'updated_at', "TEXT DEFAULT (datetime('now'))");
  }
  for (const table of [
    'ap_venues',
    'ap_spaces',
    'ap_organizations',
    'ap_organization_contacts',
    'ap_organization_documents',
    'ap_rental_requests',
    'ap_events',
    'ap_room_inspections',
    'ap_conventions',
    'ap_team_members',
    'ap_event_personnel',
    'ap_day_plan_items',
    'ap_day_notes',
  ] as const) {
    await addCol(table, 'synced', 'INTEGER DEFAULT 0');
  }

  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS ap_activity_log (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id TEXT,
      summary TEXT NOT NULL,
      actor_name TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_ap_activity_created ON ap_activity_log(created_at DESC);
  `);
}

function mapVenueRow(r: any): ApVenue {
  return {
    id: r.id,
    name: r.name,
    address: r.address ?? null,
    cp: r.cp ?? null,
    city: r.city ?? null,
    phone: r.phone ?? null,
    email: r.email ?? null,
    erp_type: r.erp_type ?? null,
    erp_category: r.erp_category ?? null,
    capacity: r.capacity != null ? Number(r.capacity) : null,
    fire_notes: r.fire_notes ?? null,
    safety_rules: r.safety_rules ?? null,
    plan_local_uri: r.plan_local_uri ?? null,
    plan_filename: r.plan_filename ?? null,
    plan_storage_path: r.plan_storage_path ?? null,
    created_at: r.created_at ?? null,
    updated_at: r.updated_at ?? null,
    synced: !!r.synced,
  };
}

function mapSpaceRow(r: any): ApSpace {
  const control_points = parseControlPointsJson(r.control_points_json ?? r.control_points);
  return {
    id: r.id,
    venue_id: r.venue_id ?? null,
    name: r.name,
    type: r.type ?? null,
    capacity: r.capacity != null ? Number(r.capacity) : null,
    description: r.description ?? null,
    control_points: control_points.length ? control_points : null,
    updated_at: r.updated_at ?? null,
    synced: !!r.synced,
  };
}

function mapOrganizationRow(r: any): ApOrganization {
  return {
    id: r.id,
    name: r.name,
    type: r.type ?? null,
    siret: r.siret ?? null,
    address: r.address ?? null,
    cp: r.cp ?? null,
    city: r.city ?? null,
    phone: r.phone ?? null,
    email: r.email ?? null,
    website: r.website ?? null,
    supabase_user_id: r.supabase_user_id ?? null,
    status: (r.status as ApOrganization['status']) ?? 'actif',
    notes_internes: r.notes_internes ?? null,
    created_at: r.created_at ?? null,
    updated_at: r.updated_at ?? null,
    synced: !!r.synced,
  };
}

function mapContactRow(r: any): ApOrganizationContact {
  return {
    id: r.id,
    organization_id: r.organization_id,
    name: r.name,
    role: r.role ?? null,
    phone: r.phone ?? null,
    email: r.email ?? null,
    is_primary: !!r.is_primary,
    updated_at: r.updated_at ?? null,
    synced: !!r.synced,
  };
}

function mapDocRow(r: any): ApOrganizationDocument {
  return {
    id: r.id,
    organization_id: r.organization_id,
    event_id: r.event_id ?? null,
    title: r.title,
    category: r.category ?? null,
    storage_path: r.storage_path ?? r.file_path ?? null,
    public_url: r.public_url ?? null,
    file_size: r.file_size != null ? Number(r.file_size) : null,
    mime_type: r.mime_type ?? null,
    uploaded_by: r.uploaded_by ?? null,
    created_at: r.created_at ?? null,
    local_uri: r.local_uri ?? null,
    synced: !!r.synced,
  };
}

function mapRentalRow(r: any): ApRentalRequest {
  return {
    id: r.id,
    organization_id: r.organization_id,
    venue_id: r.venue_id ?? null,
    space_id: r.space_id ?? null,
    event_name: r.event_name ?? null,
    date_debut: r.date_debut,
    date_fin: r.date_fin ?? null,
    heure_debut: r.heure_debut ?? null,
    heure_fin: r.heure_fin ?? null,
    participants: r.participants != null ? Number(r.participants) : null,
    motif: r.motif ?? null,
    staff_notes: r.staff_notes ?? null,
    spaces_mode: ((r.spaces_mode as ApSpacesMode) ?? 'all') as ApSpacesMode,
    selected_space_ids: parseJson<string[]>(r.selected_space_ids_json, []),
    status: (r.status as ApRentalRequest['status']) ?? 'soumise',
    notes: r.notes ?? null,
    created_at: r.created_at ?? null,
    updated_at: r.updated_at ?? null,
    synced: !!r.synced,
  };
}

function mapEventRow(r: any): ApEvent {
  return {
    id: r.id,
    venue_id: r.venue_id ?? null,
    organization_id: r.organization_id ?? null,
    name: r.name,
    type: r.type ?? null,
    organisateur: r.organisateur ?? null,
    date_debut: r.date_debut,
    date_fin: r.date_fin ?? null,
    heure_debut: r.heure_debut ?? null,
    heure_fin: r.heure_fin ?? null,
    participants: r.participants != null ? Number(r.participants) : null,
    description: r.description ?? null,
    status: (r.status as ApEvent['status']) ?? 'brouillon',
    spaces_mode: ((r.spaces_mode as ApSpacesMode) ?? 'all') as ApSpacesMode,
    selected_space_ids: parseJson<string[]>(r.selected_space_ids_json, []),
    space_id: r.space_id ?? null,
    readiness_manual: parseJson<ApEvent['readiness_manual']>(r.readiness_manual_json, {}),
    feuille_note: r.feuille_note ?? null,
    feuille_info: parseApEventFeuilleInfo(r.feuille_info_json),
    created_at: r.created_at ?? null,
    updated_at: r.updated_at ?? null,
    synced: !!r.synced,
  };
}

function mapConventionRow(r: any): ApConvention {
  return {
    id: r.id,
    event_id: r.event_id ?? null,
    venue_id: r.venue_id ?? null,
    titre: r.titre,
    contenu: r.contenu ?? null,
    status: (r.status as ApConvention['status']) ?? 'brouillon',
    signature_data: r.signature_data ?? null,
    signed_at: r.signed_at ?? null,
    signed_by: r.signed_by ?? null,
    document_local_uri: r.document_local_uri ?? null,
    document_storage_path: r.document_storage_path ?? null,
    document_filename: r.document_filename ?? null,
    created_at: r.created_at ?? null,
    updated_at: r.updated_at ?? null,
    synced: !!r.synced,
  };
}

function mapInspectionRow(r: any): ApRoomInspection {
  return {
    id: r.id,
    event_id: r.event_id ?? null,
    space_id: r.space_id ?? null,
    type: r.type as ApRoomInspection['type'],
    status: r.status as ApRoomInspection['status'],
    inspection_date: r.inspection_date ?? null,
    representant_lieu: r.representant_lieu ?? null,
    representant_orga: r.representant_orga ?? null,
    verifications: parseJson(r.verifications, {} as Record<string, string>),
    commentaire: r.commentaire ?? null,
    photos: parseJson(r.photos, [] as string[]),
    updated_at: r.updated_at ?? null,
    synced: !!r.synced,
  };
}

function mapPersonnelRow(r: any): ApPersonnel {
  const kind = (r.kind as ApPersonnelKind) ?? 'lieu';
  return {
    id: r.id,
    venue_id: r.venue_id,
    name: r.name,
    first_name: r.first_name ?? null,
    last_name: r.last_name ?? null,
    address: r.address ?? null,
    role: r.role ?? null,
    mission: r.mission ?? null,
    phone: r.phone ?? null,
    email: r.email ?? null,
    kind,
    role_permanent: r.role_permanent != null ? !!r.role_permanent : null,
    organization_id: r.organization_id ?? null,
    notes: r.notes ?? null,
    photo_uri: r.photo_uri ?? null,
    photo_storage_path: r.photo_storage_path ?? null,
    updated_at: r.updated_at ?? null,
    synced: !!r.synced,
  };
}

function mapEventPersonnelRow(r: any): ApEventPersonnel {
  const src =
    r.source === 'directory' || r.source === 'adhoc' || r.source === 'jour' ? r.source : 'adhoc';
  return {
    id: r.id,
    event_id: r.event_id,
    source: src,
    name: r.name,
    day_role: r.day_role ?? null,
    day_mission: r.day_mission ?? r.day_role ?? null,
    phone: r.phone ?? null,
    email: r.email ?? null,
    source_personnel_id: r.source_personnel_id ?? null,
    updated_at: r.updated_at ?? null,
    synced: !!r.synced,
  };
}

function mapDayPlanItemRow(r: any): ApDayPlanItem {
  return {
    id: r.id,
    plan_date: r.plan_date,
    event_id: r.event_id ?? null,
    time_start: r.time_start ?? null,
    time_end: r.time_end ?? null,
    title: r.title,
    assignee_name: r.assignee_name ?? null,
    space_id: r.space_id ?? null,
    venue_id: r.venue_id ?? null,
    notes: r.notes ?? null,
    sort_order: r.sort_order != null ? Number(r.sort_order) : null,
    updated_at: r.updated_at ?? null,
    synced: !!r.synced,
  };
}

function mapDayNoteRow(r: any): ApDayNote {
  return {
    plan_date: r.plan_date,
    note: r.note ?? '',
    updated_at: r.updated_at ?? null,
    synced: !!r.synced,
  };
}

async function wipeAccueilProData(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA foreign_keys = OFF;
    DELETE FROM ap_room_inspections;
    DELETE FROM ap_conventions;
    DELETE FROM ap_event_personnel;
    DELETE FROM ap_day_plan_items;
    DELETE FROM ap_day_notes;
    DELETE FROM ap_organization_documents;
    DELETE FROM ap_organization_contacts;
    DELETE FROM ap_rental_requests;
    DELETE FROM ap_events;
    DELETE FROM ap_team_members;
    DELETE FROM ap_spaces;
    DELETE FROM ap_organizations;
    DELETE FROM ap_venues;
    PRAGMA foreign_keys = ON;
  `);
}

function coerceRecords<T extends Record<string, unknown>>(items: unknown): T[] {
  if (!Array.isArray(items)) return [];
  return items.filter(Boolean) as T[];
}

export function pickSnapshotPayload(input: Record<string, unknown>): AccueilProBulkPayload {
  const g = (k: keyof AccueilProBulkPayload | string): unknown =>
    input[k as string] ??
    input[k.replace(/_/g, '')] ??
    undefined;

  return {
    venues: coerceRecords(g('venues') ?? input['ap_venues']),
    spaces: coerceRecords(g('spaces') ?? input['ap_spaces']),
    organizations: coerceRecords(g('organizations') ?? input['ap_organizations']),
    organization_contacts: coerceRecords(
      g('organization_contacts') ?? input['contacts'] ?? input['ap_organization_contacts']
    ),
    organization_documents: coerceRecords(
      g('organization_documents') ?? input['documents'] ?? input['ap_organization_documents']
    ),
    rental_requests: coerceRecords(g('rental_requests') ?? input['ap_rental_requests']),
    events: coerceRecords(g('events') ?? input['ap_events']),
    conventions: coerceRecords(g('conventions') ?? input['ap_conventions']),
    room_inspections: coerceRecords(g('room_inspections') ?? input['ap_room_inspections']),
    team_members: coerceRecords(
      g('team_members') ?? input['personnel'] ?? input['ap_team_members'] ?? input['ap_personnel']
    ),
    event_personnel: coerceRecords(
      g('event_personnel') ?? input['event_team'] ?? input['ap_event_personnel']
    ),
    day_plan_items: coerceRecords(g('day_plan_items') ?? input['ap_day_plan_items']),
    day_notes: coerceRecords(g('day_notes') ?? input['ap_day_notes']),
  };
}

/** Remplace tout le périmètre Accueil Pro local ; les lignes importées sont marquées `synced`. */
export async function applyAccueilProSnapshot(
  snapshot: Record<string, unknown> | AccueilProBulkPayload | null | undefined,
  database?: SQLite.SQLiteDatabase
): Promise<void> {
  const db = await resolveDb(database);
  await ensureAccueilProSchema(db);
  const p = pickSnapshotPayload((snapshot ?? {}) as Record<string, unknown>);

  await db.withTransactionAsync(async () => {
    await wipeAccueilProData(db);
    const now = nowIso();

    for (const row of p.venues ?? []) {
      const r = row as Record<string, unknown>;
      await db.runAsync(
        `INSERT INTO ap_venues (id,name,address,cp,city,phone,email,erp_type,erp_category,capacity,
          fire_notes,safety_rules,plan_local_uri,plan_filename,plan_storage_path,created_at,updated_at,synced)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`,
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
          (r.plan_local_uri as string) ?? null,
          (r.plan_filename as string) ?? null,
          (r.plan_storage_path as string) ?? null,
          (r.created_at as string) ?? now,
          (r.updated_at as string) ?? now,
        ]
      );
    }

    for (const row of p.organizations ?? []) {
      const r = row as Record<string, unknown>;
      await db.runAsync(
        `INSERT INTO ap_organizations (
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
    }

    for (const row of p.spaces ?? []) {
      const r = row as Record<string, unknown>;
      await db.runAsync(
        `INSERT INTO ap_spaces (id,venue_id,name,type,capacity,description,control_points_json,updated_at,synced)
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
    }

    for (const row of p.team_members ?? []) {
      const r = row as Record<string, unknown>;
      await db.runAsync(
        `INSERT INTO ap_team_members (
          id,venue_id,name,first_name,last_name,address,role,mission,phone,email,kind,organization_id,role_permanent,notes,photo_uri,photo_storage_path,updated_at,synced)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`,
        [
          String(r.id),
          String(r.venue_id ?? ''),
          String(r.name ?? ''),
          (r.first_name as string) ?? null,
          (r.last_name as string) ?? null,
          (r.address as string) ?? null,
          (r.role as string) ?? null,
          (r.mission as string) ?? null,
          (r.phone as string) ?? null,
          (r.email as string) ?? null,
          String(r.kind ?? 'lieu'),
          r.organization_id != null ? String(r.organization_id) : null,
          int01(r.role_permanent as boolean | number),
          (r.notes as string) ?? null,
          (r.photo_uri as string) ?? null,
          (r.photo_storage_path as string) ?? null,
          (r.updated_at as string) ?? now,
        ]
      );
    }

    for (const row of p.events ?? []) {
      const r = row as Record<string, unknown>;
      const sel =
        typeof r.selected_space_ids_json === 'string'
          ? (r.selected_space_ids_json as string)
          : JSON.stringify(
              (r.selected_space_ids as string[]) ??
                (Array.isArray(r.space_ids) ? (r.space_ids as string[]) : [])
            );
      await db.runAsync(
        `INSERT INTO ap_events (
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
    }

    for (const row of p.organization_contacts ?? []) {
      const r = row as Record<string, unknown>;
      await db.runAsync(
        `INSERT INTO ap_organization_contacts (id,organization_id,name,role,phone,email,is_primary,updated_at,synced)
         VALUES (?,?,?,?,?,?,?,?,1)`,
        [
          String(r.id),
          String(r.organization_id ?? ''),
          String(r.name ?? ''),
          (r.role as string) ?? null,
          (r.phone as string) ?? null,
          (r.email as string) ?? null,
          int01(r.is_primary as boolean | number),
          (r.updated_at as string) ?? now,
        ]
      );
    }

    for (const row of p.organization_documents ?? []) {
      const r = row as Record<string, unknown>;
      await db.runAsync(
        `INSERT INTO ap_organization_documents (
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
    }

    for (const row of p.rental_requests ?? []) {
      const r = row as Record<string, unknown>;
      const legacySpaceIds =
        Array.isArray(r.space_ids) ? (r.space_ids as string[]) : parseJson<string[]>(r.space_ids_json as string, []);
      const selected =
        Array.isArray(r.selected_space_ids) ?
          (r.selected_space_ids as string[])
        : parseJson<string[]>(String(r.selected_space_ids_json ?? ''), legacySpaceIds);
      await db.runAsync(
        `INSERT INTO ap_rental_requests (
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
          int01(r.all_spaces as boolean | number),
          String(r.status ?? 'soumise'),
          (r.notes as string) ?? null,
          (r.created_at as string) ?? now,
          (r.updated_at as string) ?? now,
        ]
      );
    }

    for (const row of p.conventions ?? []) {
      const r = row as Record<string, unknown>;
      await db.runAsync(
        `INSERT INTO ap_conventions (id,event_id,venue_id,titre,contenu,status,signature_data,signed_at,signed_by,document_storage_path,document_filename,created_at,updated_at,synced)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1)`,
        [
          String(r.id),
          r.event_id != null ? String(r.event_id) : null,
          r.venue_id != null ? String(r.venue_id) : null,
          String(r.titre ?? ''),
          (r.contenu as string) ?? null,
          String(r.status ?? 'brouillon'),
          (r.signature_data as string) ?? null,
          (r.signed_at as string) ?? null,
          (r.signed_by as string) ?? null,
          (r.document_storage_path as string) ?? null,
          (r.document_filename as string) ?? null,
          (r.created_at as string) ?? now,
          (r.updated_at as string) ?? now,
        ]
      );
    }

    for (const row of p.room_inspections ?? []) {
      const r = row as Record<string, unknown>;
      const verifs =
        typeof r.verifications === 'string'
          ? (r.verifications as string)
          : JSON.stringify((r.verifications as Record<string, unknown>) ?? {});
      const photos =
        typeof r.photos === 'string'
          ? (r.photos as string)
          : JSON.stringify((r.photos as string[]) ?? []);
      await db.runAsync(
        `INSERT INTO ap_room_inspections (
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
    }

    for (const row of p.event_personnel ?? []) {
      const r = row as Record<string, unknown>;
      await db.runAsync(
        `INSERT INTO ap_event_personnel (
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
    }

    for (const row of p.day_plan_items ?? []) {
      const r = row as Record<string, unknown>;
      await db.runAsync(
        `INSERT INTO ap_day_plan_items (
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
    }

    for (const row of p.day_notes ?? []) {
      const r = row as Record<string, unknown>;
      await db.runAsync(
        `INSERT INTO ap_day_notes (plan_date,note,updated_at,synced) VALUES (?,?,?,1)`,
        [String(r.plan_date ?? ''), String(r.note ?? ''), (r.updated_at as string) ?? now]
      );
    }
  });
}

export async function listVenues(database?: SQLite.SQLiteDatabase): Promise<ApVenue[]> {
  const db = await resolveDb(database);
  const rows = await db.getAllAsync<any>('SELECT * FROM ap_venues ORDER BY name ASC');
  return rows.map(mapVenueRow);
}

export async function saveVenue(row: ApVenue, database?: SQLite.SQLiteDatabase): Promise<void> {
  const db = await resolveDb(database);
  const n = nowIso();
  const created = row.created_at ?? n;
  const updated = row.updated_at ?? n;
  await db.runAsync(
    `INSERT OR REPLACE INTO ap_venues (
      id,name,address,cp,city,phone,email,erp_type,erp_category,capacity,fire_notes,safety_rules,
      plan_local_uri,plan_filename,plan_storage_path,
      created_at,updated_at,synced)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)`,
    [
      row.id,
      row.name,
      row.address ?? null,
      row.cp ?? null,
      row.city ?? null,
      row.phone ?? null,
      row.email ?? null,
      row.erp_type ?? null,
      row.erp_category ?? null,
      row.capacity ?? 0,
      row.fire_notes ?? null,
      row.safety_rules ?? null,
      row.plan_local_uri ?? null,
      row.plan_filename ?? null,
      row.plan_storage_path ?? null,
      created,
      updated,
    ]
  );
}

export async function deleteVenue(id: string, database?: SQLite.SQLiteDatabase): Promise<void> {
  const db = await resolveDb(database);
  await db.runAsync('DELETE FROM ap_venues WHERE id = ?', [id]);
}

export async function listSpaces(venueId?: string, database?: SQLite.SQLiteDatabase): Promise<ApSpace[]> {
  const db = await resolveDb(database);
  const rows =
    venueId != null
      ? await db.getAllAsync<any>(
          'SELECT * FROM ap_spaces WHERE venue_id = ? ORDER BY name ASC',
          [venueId]
        )
      : await db.getAllAsync<any>('SELECT * FROM ap_spaces ORDER BY name ASC');
  return rows.map(mapSpaceRow);
}

export async function saveSpace(row: ApSpace, database?: SQLite.SQLiteDatabase): Promise<void> {
  const db = await resolveDb(database);
  const n = nowIso();
  if (!row.venue_id) throw new Error('venue_id requis pour un espace');
  await db.runAsync(
    `INSERT OR REPLACE INTO ap_spaces (id,venue_id,name,type,capacity,description,control_points_json,updated_at,synced)
     VALUES (?,?,?,?,?,?,?,?,0)`,
    [
      row.id,
      row.venue_id,
      row.name,
      row.type ?? null,
      row.capacity ?? 0,
      row.description ?? null,
      serializeControlPointsJson(row.control_points ?? []),
      row.updated_at ?? n,
    ]
  );
}

export async function deleteSpace(id: string, database?: SQLite.SQLiteDatabase): Promise<void> {
  const db = await resolveDb(database);
  await db.runAsync('DELETE FROM ap_spaces WHERE id = ?', [id]);
}

export async function listPersonnel(
  venueId?: string,
  database?: SQLite.SQLiteDatabase
): Promise<ApPersonnel[]> {
  const db = await resolveDb(database);
  const rows =
    venueId != null
      ? await db.getAllAsync<any>('SELECT * FROM ap_team_members WHERE venue_id = ? ORDER BY name ASC', [
          venueId,
        ])
      : await db.getAllAsync<any>('SELECT * FROM ap_team_members ORDER BY name ASC');
  return rows.map(mapPersonnelRow);
}

export async function savePersonnel(row: ApPersonnel, database?: SQLite.SQLiteDatabase): Promise<void> {
  const db = await resolveDb(database);
  const n = nowIso();
  await db.runAsync(
    `INSERT OR REPLACE INTO ap_team_members (
      id,venue_id,name,first_name,last_name,address,role,mission,phone,email,
      kind,organization_id,role_permanent,notes,photo_uri,photo_storage_path,
      updated_at,synced)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)`,
    [
      row.id,
      row.venue_id,
      row.name,
      row.first_name ?? null,
      row.last_name ?? null,
      row.address ?? null,
      row.role ?? null,
      row.mission ?? null,
      row.phone ?? null,
      row.email ?? null,
      row.kind ?? 'lieu',
      row.organization_id ?? null,
      int01(row.role_permanent ?? false),
      row.notes ?? null,
      row.photo_uri ?? null,
      row.photo_storage_path ?? null,
      row.updated_at ?? n,
    ]
  );
}

export async function deletePersonnel(id: string, database?: SQLite.SQLiteDatabase): Promise<void> {
  const db = await resolveDb(database);
  await db.runAsync('DELETE FROM ap_team_members WHERE id = ?', [id]);
}

export async function listOrganizations(database?: SQLite.SQLiteDatabase): Promise<ApOrganization[]> {
  const db = await resolveDb(database);
  const rows = await db.getAllAsync<any>('SELECT * FROM ap_organizations ORDER BY name ASC');
  return rows.map(mapOrganizationRow);
}

export async function saveOrganization(row: ApOrganization, database?: SQLite.SQLiteDatabase): Promise<void> {
  const db = await resolveDb(database);
  const n = nowIso();
  const created = row.created_at ?? n;
  const updated = row.updated_at ?? n;
  await db.runAsync(
    `INSERT OR REPLACE INTO ap_organizations (
      id,name,type,siret,address,cp,city,phone,email,website,supabase_user_id,status,notes_internes,created_at,updated_at,synced)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)`,
    [
      row.id,
      row.name,
      row.type ?? null,
      row.siret ?? null,
      row.address ?? null,
      row.cp ?? null,
      row.city ?? null,
      row.phone ?? null,
      row.email ?? null,
      row.website ?? null,
      row.supabase_user_id ?? null,
      row.status,
      row.notes_internes ?? null,
      created,
      updated,
    ]
  );
}

export async function deleteOrganization(id: string, database?: SQLite.SQLiteDatabase): Promise<void> {
  const db = await resolveDb(database);
  await db.runAsync('DELETE FROM ap_organizations WHERE id = ?', [id]);
}

export async function listContacts(
  organizationId?: string,
  database?: SQLite.SQLiteDatabase
): Promise<ApOrganizationContact[]> {
  const db = await resolveDb(database);
  const rows =
    organizationId != null
      ? await db.getAllAsync<any>(
          'SELECT * FROM ap_organization_contacts WHERE organization_id = ? ORDER BY name ASC',
          [organizationId]
        )
      : await db.getAllAsync<any>('SELECT * FROM ap_organization_contacts ORDER BY name ASC');
  return rows.map(mapContactRow);
}

export async function saveContact(row: ApOrganizationContact, database?: SQLite.SQLiteDatabase): Promise<void> {
  const db = await resolveDb(database);
  const n = nowIso();
  await db.runAsync(
    `INSERT OR REPLACE INTO ap_organization_contacts (id,organization_id,name,role,phone,email,is_primary,updated_at,synced)
     VALUES (?,?,?,?,?,?,?,?,0)`,
    [
      row.id,
      row.organization_id,
      row.name,
      row.role ?? null,
      row.phone ?? null,
      row.email ?? null,
      int01(row.is_primary),
      row.updated_at ?? n,
    ]
  );
}

export async function deleteContact(id: string, database?: SQLite.SQLiteDatabase): Promise<void> {
  const db = await resolveDb(database);
  await db.runAsync('DELETE FROM ap_organization_contacts WHERE id = ?', [id]);
}

export async function listDocuments(
  organizationId?: string,
  database?: SQLite.SQLiteDatabase
): Promise<ApOrganizationDocument[]> {
  const db = await resolveDb(database);
  const rows =
    organizationId != null
      ? await db.getAllAsync<any>(
          'SELECT * FROM ap_organization_documents WHERE organization_id = ? ORDER BY created_at DESC',
          [organizationId]
        )
      : await db.getAllAsync<any>('SELECT * FROM ap_organization_documents ORDER BY created_at DESC');
  return rows.map(mapDocRow);
}

export async function saveDocument(row: ApOrganizationDocument, database?: SQLite.SQLiteDatabase): Promise<void> {
  const db = await resolveDb(database);
  const n = nowIso();
  await db.runAsync(
    `INSERT OR REPLACE INTO ap_organization_documents (
      id,organization_id,event_id,title,category,storage_path,public_url,file_size,mime_type,uploaded_by,created_at,local_uri,synced)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0)`,
    [
      row.id,
      row.organization_id,
      row.event_id ?? null,
      row.title,
      row.category ?? null,
      row.storage_path ?? null,
      row.public_url ?? null,
      row.file_size ?? null,
      row.mime_type ?? null,
      row.uploaded_by ?? null,
      row.created_at ?? n,
      row.local_uri ?? null,
    ]
  );
}

export async function deleteDocument(id: string, database?: SQLite.SQLiteDatabase): Promise<void> {
  const db = await resolveDb(database);
  await db.runAsync('DELETE FROM ap_organization_documents WHERE id = ?', [id]);
}

export async function listRentalRequests(
  organizationId?: string,
  database?: SQLite.SQLiteDatabase
): Promise<ApRentalRequest[]> {
  const db = await resolveDb(database);
  const rows =
    organizationId != null
      ? await db.getAllAsync<any>(
          'SELECT * FROM ap_rental_requests WHERE organization_id = ? ORDER BY date_debut DESC',
          [organizationId]
        )
      : await db.getAllAsync<any>('SELECT * FROM ap_rental_requests ORDER BY date_debut DESC');
  return rows.map(mapRentalRow);
}

export async function saveRentalRequest(row: ApRentalRequest, database?: SQLite.SQLiteDatabase): Promise<void> {
  const db = await resolveDb(database);
  const n = nowIso();
  const created = row.created_at ?? n;
  const updated = row.updated_at ?? n;
  const selected = row.selected_space_ids ?? [];
  const mode = row.spaces_mode ?? 'all';
  await db.runAsync(
    `INSERT OR REPLACE INTO ap_rental_requests (
      id,organization_id,venue_id,space_id,event_name,
      space_ids_json,selected_space_ids_json,spaces_mode,
      date_debut,date_fin,heure_debut,heure_fin,
      participants,motif,staff_notes,
      all_spaces,status,notes,created_at,updated_at,synced)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)`,
    [
      row.id,
      row.organization_id,
      row.venue_id ?? null,
      row.space_id ?? null,
      row.event_name ?? null,
      JSON.stringify(selected),
      JSON.stringify(selected),
      mode,
      row.date_debut,
      row.date_fin ?? null,
      row.heure_debut ?? null,
      row.heure_fin ?? null,
      row.participants ?? 0,
      row.motif ?? null,
      row.staff_notes ?? null,
      int01(mode === 'all'),
      row.status,
      row.notes ?? null,
      created,
      updated,
    ]
  );
}

export async function deleteRentalRequest(id: string, database?: SQLite.SQLiteDatabase): Promise<void> {
  const db = await resolveDb(database);
  await db.runAsync('DELETE FROM ap_rental_requests WHERE id = ?', [id]);
}

export async function listEvents(
  opts?: { venueId?: string; organizationId?: string; fromDate?: string },
  database?: SQLite.SQLiteDatabase
): Promise<ApEvent[]> {
  const db = await resolveDb(database);
  let sql = 'SELECT * FROM ap_events WHERE 1=1';
  const params: string[] = [];
  if (opts?.venueId) {
    sql += ' AND venue_id = ?';
    params.push(opts.venueId);
  }
  if (opts?.organizationId) {
    sql += ' AND organization_id = ?';
    params.push(opts.organizationId);
  }
  if (opts?.fromDate) {
    sql += ' AND (date_fin IS NULL OR date_fin >= ? OR date_debut >= ?)';
    params.push(opts.fromDate, opts.fromDate);
  }
  sql += ' ORDER BY date_debut ASC';
  const rows = await db.getAllAsync<any>(sql, params);
  return rows.map(mapEventRow);
}

export async function saveEvent(row: ApEvent, database?: SQLite.SQLiteDatabase): Promise<void> {
  const db = await resolveDb(database);
  const n = nowIso();
  const created = row.created_at ?? n;
  const updated = row.updated_at ?? n;
  const sel = JSON.stringify(row.selected_space_ids ?? []);
  const mode = row.spaces_mode ?? 'all';
  let feuilleNote: string | null = row.feuille_note ?? null;
  if (row.feuille_note === undefined) {
    const prev = await db.getFirstAsync<{ feuille_note: string | null }>(
      'SELECT feuille_note FROM ap_events WHERE id = ?',
      [row.id]
    );
    feuilleNote = prev?.feuille_note ?? null;
  }
  let feuilleInfoJson = serializeApEventFeuilleInfo(row.feuille_info ?? { spaces: {} });
  if (row.feuille_info === undefined) {
    const prevInfo = await db.getFirstAsync<{ feuille_info_json: string | null }>(
      'SELECT feuille_info_json FROM ap_events WHERE id = ?',
      [row.id]
    );
    feuilleInfoJson = prevInfo?.feuille_info_json ?? '{}';
  }
  await db.runAsync(
    `INSERT OR REPLACE INTO ap_events (
      id,venue_id,organization_id,name,type,organisateur,date_debut,date_fin,heure_debut,heure_fin,
      participants,description,status,spaces_mode,selected_space_ids_json,space_id,readiness_manual_json,feuille_note,feuille_info_json,created_at,updated_at,synced)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)`,
    [
      row.id,
      row.venue_id ?? null,
      row.organization_id ?? null,
      row.name,
      row.type ?? null,
      row.organisateur ?? null,
      row.date_debut,
      row.date_fin ?? null,
      row.heure_debut ?? null,
      row.heure_fin ?? null,
      row.participants ?? 0,
      row.description ?? null,
      row.status,
      mode,
      sel,
      row.space_id ?? null,
      JSON.stringify(row.readiness_manual ?? {}),
      feuilleNote,
      feuilleInfoJson,
      created,
      updated,
    ]
  );
}

export async function saveApEventReadinessManual(
  eventId: string,
  manual: import('../types/accueilPro').ApEventReadinessManual,
  database?: SQLite.SQLiteDatabase
): Promise<void> {
  const db = await resolveDb(database);
  await db.runAsync(
    `UPDATE ap_events SET readiness_manual_json = ?, updated_at = ?, synced = 0 WHERE id = ?`,
    [JSON.stringify(manual ?? {}), nowIso(), eventId]
  );
}

export async function saveApEventFeuilleNote(
  eventId: string,
  note: string,
  database?: SQLite.SQLiteDatabase
): Promise<void> {
  const db = await resolveDb(database);
  await db.runAsync(`UPDATE ap_events SET feuille_note = ?, updated_at = ?, synced = 0 WHERE id = ?`, [
    note.trim() || null,
    nowIso(),
    eventId,
  ]);
}

export async function saveApEventFeuilleInfo(
  eventId: string,
  info: ApEventFeuilleInfo,
  database?: SQLite.SQLiteDatabase
): Promise<void> {
  const db = await resolveDb(database);
  await db.runAsync(
    `UPDATE ap_events SET feuille_info_json = ?, updated_at = ?, synced = 0 WHERE id = ?`,
    [serializeApEventFeuilleInfo(info), nowIso(), eventId]
  );
}

export async function deleteEvent(id: string, database?: SQLite.SQLiteDatabase): Promise<void> {
  const db = await resolveDb(database);
  await db.runAsync('DELETE FROM ap_events WHERE id = ?', [id]);
}

export async function listConventions(
  eventIdOrOpts?: string | { eventId?: string; venueId?: string },
  database?: SQLite.SQLiteDatabase
): Promise<ApConvention[]> {
  const db = await resolveDb(database);
  const opts =
    typeof eventIdOrOpts === 'string' ? { eventId: eventIdOrOpts }
    : eventIdOrOpts ?? {};
  let sql = 'SELECT * FROM ap_conventions WHERE 1=1';
  const params: string[] = [];
  if (opts.eventId) {
    sql += ' AND event_id = ?';
    params.push(opts.eventId);
  }
  if (opts.venueId) {
    sql += ' AND venue_id = ?';
    params.push(opts.venueId);
  }
  sql += ' ORDER BY updated_at DESC';
  const rows = await db.getAllAsync<any>(sql, params);
  return rows.map(mapConventionRow);
}

export async function saveConvention(row: ApConvention, database?: SQLite.SQLiteDatabase): Promise<void> {
  const db = await resolveDb(database);
  const n = nowIso();
  const created = row.created_at ?? n;
  const updated = row.updated_at ?? n;
  await db.runAsync(
    `INSERT OR REPLACE INTO ap_conventions (
      id,event_id,venue_id,titre,contenu,status,signature_data,signed_at,signed_by,
      document_local_uri,document_storage_path,document_filename,
      created_at,updated_at,synced)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)`,
    [
      row.id,
      row.event_id ?? null,
      row.venue_id ?? null,
      row.titre,
      row.contenu ?? null,
      row.status,
      row.signature_data ?? null,
      row.signed_at ?? null,
      row.signed_by ?? null,
      row.document_local_uri ?? null,
      row.document_storage_path ?? null,
      row.document_filename ?? null,
      created,
      updated,
    ]
  );
}

export async function deleteConvention(id: string, database?: SQLite.SQLiteDatabase): Promise<void> {
  const db = await resolveDb(database);
  await db.runAsync('DELETE FROM ap_conventions WHERE id = ?', [id]);
}

export async function listInspections(
  opts?: { eventId?: string; spaceId?: string },
  database?: SQLite.SQLiteDatabase
): Promise<ApRoomInspection[]> {
  const db = await resolveDb(database);
  let sql = 'SELECT * FROM ap_room_inspections WHERE 1=1';
  const params: string[] = [];
  if (opts?.eventId) {
    sql += ' AND event_id = ?';
    params.push(opts.eventId);
  }
  if (opts?.spaceId) {
    sql += ' AND space_id = ?';
    params.push(opts.spaceId);
  }
  sql += ' ORDER BY inspection_date DESC, updated_at DESC';
  const rows = await db.getAllAsync<any>(sql, params);
  return rows.map(mapInspectionRow);
}

export async function saveInspection(row: ApRoomInspection, database?: SQLite.SQLiteDatabase): Promise<void> {
  const db = await resolveDb(database);
  const n = nowIso();
  await db.runAsync(
    `INSERT OR REPLACE INTO ap_room_inspections (
      id,event_id,space_id,type,status,inspection_date,representant_lieu,representant_orga,verifications,commentaire,photos,updated_at,synced)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0)`,
    [
      row.id,
      row.event_id ?? null,
      row.space_id ?? null,
      row.type,
      row.status,
      row.inspection_date ?? null,
      row.representant_lieu ?? null,
      row.representant_orga ?? null,
      JSON.stringify(row.verifications ?? {}),
      row.commentaire ?? null,
      JSON.stringify(row.photos ?? []),
      row.updated_at ?? n,
    ]
  );
}

export async function deleteInspection(id: string, database?: SQLite.SQLiteDatabase): Promise<void> {
  const db = await resolveDb(database);
  await db.runAsync('DELETE FROM ap_room_inspections WHERE id = ?', [id]);
}

function stripSynced<T extends Record<string, unknown>>(row: T): Record<string, unknown> {
  const { synced: _s, ...rest } = row;
  return rest;
}

/** Agrège les lignes non synchronisées pour `POST /api/accueilpro/bulk`. */
export async function listUnsyncedAccueilProRows(database?: SQLite.SQLiteDatabase): Promise<AccueilProBulkPayload> {
  const db = await resolveDb(database);
  const [
    venueRows,
    spaceRows,
    orgRows,
    contactRows,
    docRows,
    rentalRows,
    eventRows,
    conventionRows,
    inspectionRows,
    memberRows,
    eventPersRows,
    dayPlanRows,
    dayNoteRows,
  ] = await Promise.all([
    db.getAllAsync<any>('SELECT * FROM ap_venues WHERE synced = 0'),
    db.getAllAsync<any>('SELECT * FROM ap_spaces WHERE synced = 0'),
    db.getAllAsync<any>('SELECT * FROM ap_organizations WHERE synced = 0'),
    db.getAllAsync<any>('SELECT * FROM ap_organization_contacts WHERE synced = 0'),
    db.getAllAsync<any>('SELECT * FROM ap_organization_documents WHERE synced = 0'),
    db.getAllAsync<any>('SELECT * FROM ap_rental_requests WHERE synced = 0'),
    db.getAllAsync<any>('SELECT * FROM ap_events WHERE synced = 0'),
    db.getAllAsync<any>('SELECT * FROM ap_conventions WHERE synced = 0'),
    db.getAllAsync<any>('SELECT * FROM ap_room_inspections WHERE synced = 0'),
    db.getAllAsync<any>('SELECT * FROM ap_team_members WHERE synced = 0'),
    db.getAllAsync<any>('SELECT * FROM ap_event_personnel WHERE synced = 0'),
    db.getAllAsync<any>('SELECT * FROM ap_day_plan_items WHERE synced = 0'),
    db.getAllAsync<any>('SELECT * FROM ap_day_notes WHERE synced = 0'),
  ]);

  const out: AccueilProBulkPayload = {};
  if (venueRows.length) out.venues = venueRows.map(r => stripSynced(mapVenueRow(r) as unknown as Record<string, unknown>));
  if (spaceRows.length)
    out.spaces = spaceRows.map(r => {
      const mapped = mapSpaceRow(r);
      return stripSynced({
        ...mapped,
        control_points_json: serializeControlPointsJson(mapped.control_points ?? []),
      } as Record<string, unknown>);
    });
  if (orgRows.length)
    out.organizations = orgRows.map(r => stripSynced(mapOrganizationRow(r) as unknown as Record<string, unknown>));
  if (contactRows.length)
    out.organization_contacts = contactRows.map(r => stripSynced(mapContactRow(r) as unknown as Record<string, unknown>));
  if (docRows.length)
    out.organization_documents = docRows.map(r => stripSynced(mapDocRow(r) as unknown as Record<string, unknown>));
  if (rentalRows.length)
    out.rental_requests = rentalRows.map(r => stripSynced(mapRentalRow(r) as unknown as Record<string, unknown>));
  if (eventRows.length)
    out.events = eventRows.map(r => stripSynced(mapEventRow(r) as unknown as Record<string, unknown>));
  if (conventionRows.length)
    out.conventions = conventionRows.map(r => stripSynced(mapConventionRow(r) as unknown as Record<string, unknown>));
  if (inspectionRows.length)
    out.room_inspections = inspectionRows.map(r =>
      stripSynced(mapInspectionRow(r) as unknown as Record<string, unknown>)
    );
  if (memberRows.length)
    out.team_members = memberRows.map(r => stripSynced(mapPersonnelRow(r) as unknown as Record<string, unknown>));
  if (eventPersRows.length)
    out.event_personnel = eventPersRows.map(r =>
      stripSynced(mapEventPersonnelRow(r) as unknown as Record<string, unknown>)
    );
  if (dayPlanRows.length)
    out.day_plan_items = dayPlanRows.map(r => stripSynced(mapDayPlanItemRow(r) as unknown as Record<string, unknown>));
  if (dayNoteRows.length)
    out.day_notes = dayNoteRows.map(r => {
      const mapped = mapDayNoteRow(r);
      return stripSynced({ ...mapped, id: mapped.plan_date } as Record<string, unknown>);
    });
  return out;
}

/** Marque `synced=1` uniquement pour les ids confirmés par le serveur après bulk. */
export async function markAccueilProRowsSyncedFromAppliedIds(
  appliedIds: {
    venues?: string[];
    spaces?: string[];
    organizations?: string[];
    organization_contacts?: string[];
    organization_documents?: string[];
    rental_requests?: string[];
    events?: string[];
    conventions?: string[];
    room_inspections?: string[];
    team_members?: string[];
    event_personnel?: string[];
    day_plan_items?: string[];
    day_notes?: string[];
  },
  database?: SQLite.SQLiteDatabase
): Promise<void> {
  const db = await resolveDb(database);
  await db.withTransactionAsync(async () => {
    const mark = async (table: string, ids: string[] | undefined) => {
      if (!ids?.length) return;
      const ph = ids.map(() => '?').join(', ');
      await db.runAsync(`UPDATE ${table} SET synced = 1 WHERE id IN (${ph})`, ids);
    };
    await mark('ap_venues', appliedIds.venues);
    await mark('ap_spaces', appliedIds.spaces);
    await mark('ap_organizations', appliedIds.organizations);
    await mark('ap_organization_contacts', appliedIds.organization_contacts);
    await mark('ap_organization_documents', appliedIds.organization_documents);
    await mark('ap_rental_requests', appliedIds.rental_requests);
    await mark('ap_events', appliedIds.events);
    await mark('ap_conventions', appliedIds.conventions);
    await mark('ap_room_inspections', appliedIds.room_inspections);
    await mark('ap_team_members', appliedIds.team_members);
    await mark('ap_event_personnel', appliedIds.event_personnel);
    await mark('ap_day_plan_items', appliedIds.day_plan_items);
    if (appliedIds.day_notes?.length) {
      const ph = appliedIds.day_notes.map(() => '?').join(', ');
      await db.runAsync(`UPDATE ap_day_notes SET synced = 1 WHERE plan_date IN (${ph})`, appliedIds.day_notes);
    }
  });
}

/** Marque `synced=1` pour les lignes listées comme dans le dernier corps bulk (ou équivalent minimal). */
export async function markAccueilProRowsSynced(payload: AccueilProBulkPayload, database?: SQLite.SQLiteDatabase): Promise<void> {
  const db = await resolveDb(database);
  await db.withTransactionAsync(async () => {
    const mark = async (table: string, ids: string[]) => {
      if (!ids.length) return;
      const ph = ids.map(() => '?').join(', ');
      await db.runAsync(`UPDATE ${table} SET synced = 1 WHERE id IN (${ph})`, ids);
    };
    await mark(
      'ap_venues',
      (payload.venues ?? []).map(r => String((r as { id: unknown }).id))
    );
    await mark(
      'ap_spaces',
      (payload.spaces ?? []).map(r => String((r as { id: unknown }).id))
    );
    await mark(
      'ap_organizations',
      (payload.organizations ?? []).map(r => String((r as { id: unknown }).id))
    );
    await mark(
      'ap_organization_contacts',
      (payload.organization_contacts ?? []).map(r => String((r as { id: unknown }).id))
    );
    await mark(
      'ap_organization_documents',
      (payload.organization_documents ?? []).map(r => String((r as { id: unknown }).id))
    );
    await mark(
      'ap_rental_requests',
      (payload.rental_requests ?? []).map(r => String((r as { id: unknown }).id))
    );
    await mark('ap_events', (payload.events ?? []).map(r => String((r as { id: unknown }).id)));
    await mark(
      'ap_conventions',
      (payload.conventions ?? []).map(r => String((r as { id: unknown }).id))
    );
    await mark(
      'ap_room_inspections',
      (payload.room_inspections ?? []).map(r => String((r as { id: unknown }).id))
    );
    await mark(
      'ap_team_members',
      (payload.team_members ?? []).map(r => String((r as { id: unknown }).id))
    );
    await mark(
      'ap_event_personnel',
      (payload.event_personnel ?? []).map(r => String((r as { id: unknown }).id))
    );
    await mark(
      'ap_day_plan_items',
      (payload.day_plan_items ?? []).map(r => String((r as { id: unknown }).id))
    );
    if (payload.day_notes?.length) {
      const dates = payload.day_notes.map(r => String((r as { plan_date: unknown }).plan_date));
      const ph = dates.map(() => '?').join(', ');
      await db.runAsync(`UPDATE ap_day_notes SET synced = 1 WHERE plan_date IN (${ph})`, dates);
    }
  });
}

/** Compte lieux configurés hors ligne. */
export async function countVenues(database?: SQLite.SQLiteDatabase): Promise<number> {
  const db = await resolveDb(database);
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) as n FROM ap_venues');
  return row?.n ?? 0;
}

/** Événements avec date de fin après aujourd’hui ou statut terminal exclu, tri futur rapproché. */
export async function upcomingEvents(
  opts?: { limit?: number },
  database?: SQLite.SQLiteDatabase
): Promise<ApEvent[]> {
  const db = await resolveDb(database);
  const limit = opts?.limit ?? 20;
  const today = new Date().toISOString().slice(0, 10);
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM ap_events
     WHERE status NOT IN ('annulé','terminé')
       AND (date_fin IS NULL OR date_fin >= ? OR date_debut >= ?)
     ORDER BY date_debut ASC
     LIMIT ?`,
    [today, today, limit]
  );
  return rows.map(mapEventRow);
}

/** États des lieux les plus récents. */
export async function recentInspections(
  opts?: { limit?: number },
  database?: SQLite.SQLiteDatabase
): Promise<ApRoomInspection[]> {
  const db = await resolveDb(database);
  const limit = opts?.limit ?? 15;
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM ap_room_inspections
     ORDER BY COALESCE(inspection_date, updated_at) DESC, updated_at DESC
     LIMIT ?`,
    [limit]
  );
  return rows.map(mapInspectionRow);
}

// ── Alias & helpers pour les écrans Accueil Pro ────────────────────────────

export const listApVenues = listVenues;
export const listApSpaces = listSpaces;
export const listApOrganizations = listOrganizations;
export const listApEvents = listEvents;

export async function listApEventsByOrganization(
  organizationId: string,
  database?: SQLite.SQLiteDatabase
): Promise<ApEvent[]> {
  return listEvents({ organizationId }, database);
}
export async function listApPersonnel(
  venueIdOrOpts?: string | { kind?: ApPersonnelKind; venueId?: string; organizationId?: string },
  database?: SQLite.SQLiteDatabase
): Promise<ApPersonnel[]> {
  const opts =
    typeof venueIdOrOpts === 'string' || venueIdOrOpts === undefined ?
      venueIdOrOpts ?
        { venueId: venueIdOrOpts }
      : {}
    : venueIdOrOpts;
  const db = await resolveDb(database);
  let sql = 'SELECT * FROM ap_team_members WHERE 1=1';
  const params: string[] = [];
  if (opts.kind) {
    sql += ' AND kind = ?';
    params.push(opts.kind);
  }
  if (opts.venueId) {
    sql += ' AND venue_id = ?';
    params.push(opts.venueId);
  }
  if (opts.organizationId) {
    sql += ' AND organization_id = ?';
    params.push(opts.organizationId);
  }
  sql += ' ORDER BY name ASC';
  const rows = await db.getAllAsync<any>(sql, params);
  return rows.map(mapPersonnelRow);
}
export const listApRentalRequests = listRentalRequests;
export const listApConventions = listConventions;
export const listApInspections = listInspections;

export async function countConventions(database?: SQLite.SQLiteDatabase): Promise<number> {
  const db = await resolveDb(database);
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) as n FROM ap_conventions');
  return row?.n ?? 0;
}

export async function countUpcomingEvents(database?: SQLite.SQLiteDatabase): Promise<number> {
  const db = await resolveDb(database);
  const today = new Date().toISOString().slice(0, 10);
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) as n FROM ap_events
     WHERE status NOT IN ('annulé','terminé')
       AND (date_fin IS NULL OR date_fin >= ? OR date_debut >= ?)`,
    [today, today]
  );
  return row?.n ?? 0;
}

export async function countInspections(database?: SQLite.SQLiteDatabase): Promise<number> {
  const db = await resolveDb(database);
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) as n FROM ap_room_inspections');
  return row?.n ?? 0;
}

export async function listApOrganizationDocuments(
  organizationId: string,
  database?: SQLite.SQLiteDatabase
): Promise<ApOrganizationDocument[]> {
  const db = await resolveDb(database);
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM ap_organization_documents
     WHERE organization_id = ? AND (event_id IS NULL OR event_id = '')
     ORDER BY created_at DESC`,
    [organizationId]
  );
  return rows.map(mapDocRow);
}

export async function listApOrganizationDocumentsByEvent(
  eventId: string,
  database?: SQLite.SQLiteDatabase
): Promise<ApOrganizationDocument[]> {
  const db = await resolveDb(database);
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM ap_organization_documents WHERE event_id = ? ORDER BY created_at DESC',
    [eventId]
  );
  return rows.map(mapDocRow);
}

export async function countApEventDocumentsByEventIds(
  eventIds: string[],
  database?: SQLite.SQLiteDatabase
): Promise<Record<string, number>> {
  if (eventIds.length === 0) return {};
  const db = await resolveDb(database);
  const placeholders = eventIds.map(() => '?').join(',');
  const rows = await db.getAllAsync<{ event_id: string; n: number }>(
    `SELECT event_id, COUNT(*) as n FROM ap_organization_documents
     WHERE event_id IN (${placeholders}) GROUP BY event_id`,
    eventIds
  );
  return Object.fromEntries(rows.map(r => [r.event_id, r.n]));
}

export async function listApContactsByOrganization(
  organizationId: string,
  database?: SQLite.SQLiteDatabase
): Promise<ApOrganizationContact[]> {
  return listContacts(organizationId, database);
}

export const saveApConvention = saveConvention;
export const saveApEvent = saveEvent;
export const saveApVenue = saveVenue;
export const saveApSpace = saveSpace;
export const saveApPersonnel = savePersonnel;
export const saveApRentalRequest = saveRentalRequest;
export const saveApOrganizationContact = saveContact;

export async function listApConventionsByEvent(
  eventId: string,
  database?: SQLite.SQLiteDatabase
): Promise<ApConvention[]> {
  return listConventions({ eventId }, database);
}

export async function listApConventionsByVenue(
  venueId: string,
  database?: SQLite.SQLiteDatabase
): Promise<ApConvention[]> {
  return listConventions({ venueId }, database);
}

export async function getApVenue(id: string, database?: SQLite.SQLiteDatabase): Promise<ApVenue | null> {
  const db = await resolveDb(database);
  const row = await db.getFirstAsync<any>('SELECT * FROM ap_venues WHERE id = ?', [id]);
  return row ? mapVenueRow(row) : null;
}

export async function getApSpace(id: string, database?: SQLite.SQLiteDatabase): Promise<ApSpace | null> {
  const db = await resolveDb(database);
  const row = await db.getFirstAsync<any>('SELECT * FROM ap_spaces WHERE id = ?', [id]);
  return row ? mapSpaceRow(row) : null;
}

export async function getApOrganization(id: string, database?: SQLite.SQLiteDatabase): Promise<ApOrganization | null> {
  const db = await resolveDb(database);
  const row = await db.getFirstAsync<any>('SELECT * FROM ap_organizations WHERE id = ?', [id]);
  return row ? mapOrganizationRow(row) : null;
}

export async function getApEvent(id: string, database?: SQLite.SQLiteDatabase): Promise<ApEvent | null> {
  const db = await resolveDb(database);
  const row = await db.getFirstAsync<any>('SELECT * FROM ap_events WHERE id = ?', [id]);
  return row ? mapEventRow(row) : null;
}

export async function getApConvention(id: string, database?: SQLite.SQLiteDatabase): Promise<ApConvention | null> {
  const db = await resolveDb(database);
  const row = await db.getFirstAsync<any>('SELECT * FROM ap_conventions WHERE id = ?', [id]);
  return row ? mapConventionRow(row) : null;
}

export async function getApRoomInspection(id: string, database?: SQLite.SQLiteDatabase): Promise<ApRoomInspection | null> {
  const db = await resolveDb(database);
  const row = await db.getFirstAsync<any>('SELECT * FROM ap_room_inspections WHERE id = ?', [id]);
  return row ? mapInspectionRow(row) : null;
}

export async function getApPersonnel(id: string, database?: SQLite.SQLiteDatabase): Promise<ApPersonnel | null> {
  const db = await resolveDb(database);
  const row = await db.getFirstAsync<any>('SELECT * FROM ap_team_members WHERE id = ?', [id]);
  return row ? mapPersonnelRow(row) : null;
}

export async function getApRentalRequest(id: string, database?: SQLite.SQLiteDatabase): Promise<ApRentalRequest | null> {
  const db = await resolveDb(database);
  const row = await db.getFirstAsync<any>('SELECT * FROM ap_rental_requests WHERE id = ?', [id]);
  return row ? mapRentalRow(row) : null;
}

export async function findApRoomInspection(
  eventId: string,
  spaceId: string,
  inspectionType: ApRoomInspection['type'],
  database?: SQLite.SQLiteDatabase
): Promise<ApRoomInspection | null> {
  const db = await resolveDb(database);
  const row = await db.getFirstAsync<any>(
    `SELECT * FROM ap_room_inspections
      WHERE event_id = ? AND space_id = ? AND type = ?
      ORDER BY datetime(updated_at) DESC LIMIT 1`,
    [eventId, spaceId, inspectionType]
  );
  return row ? mapInspectionRow(row) : null;
}

export async function listEventSpaceIds(eventId: string, database?: SQLite.SQLiteDatabase): Promise<string[]> {
  const ev = await getApEvent(eventId, database);
  return [...(ev?.selected_space_ids ?? [])];
}

export async function setEventSpaces(
  eventId: string,
  spaceIds: string[],
  spacesMode: ApSpacesMode | null | undefined,
  database?: SQLite.SQLiteDatabase
): Promise<void> {
  const ev = await getApEvent(eventId, database);
  if (!ev) return;
  await saveEvent(
    {
      ...ev,
      spaces_mode: spacesMode ?? (spaceIds.length ? 'specific' : 'all'),
      selected_space_ids: spaceIds,
    },
    database
  );
}

export async function listRentalRequestSpaceIds(
  rentalId: string,
  database?: SQLite.SQLiteDatabase
): Promise<string[]> {
  const r = await getApRentalRequest(rentalId, database);
  return [...(r?.selected_space_ids ?? [])];
}

export async function setRentalRequestSpaces(
  rentalId: string,
  spaceIds: string[],
  spacesMode?: ApSpacesMode | null,
  database?: SQLite.SQLiteDatabase
): Promise<void> {
  const row = await getApRentalRequest(rentalId, database);
  if (!row) return;
  const mode = spacesMode ?? (spaceIds.length === 0 ? row.spaces_mode ?? 'all' : 'specific');
  await saveRentalRequest({ ...row, spaces_mode: mode, selected_space_ids: spaceIds }, database);
}

export async function resolveSpacesForEvent(
  evOrId: Pick<ApEvent, 'venue_id' | 'spaces_mode' | 'selected_space_ids'> | string,
  database?: SQLite.SQLiteDatabase
): Promise<ApSpace[]> {
  const ev =
    typeof evOrId === 'string'
      ? ((await getApEvent(evOrId, database)) as ApEvent | null)
      : evOrId;
  if (!ev || !ev.venue_id) return [];
  const all = await listSpaces(ev.venue_id, database);
  const mode = ev.spaces_mode ?? 'all';
  if (mode === 'all') return all;
  const ids = new Set(ev.selected_space_ids ?? []);
  return all.filter(s => ids.has(s.id));
}

export async function listApEventPersonnel(
  eventId: string,
  database?: SQLite.SQLiteDatabase
): Promise<ApEventPersonnel[]> {
  const db = await resolveDb(database);
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM ap_event_personnel WHERE event_id = ? ORDER BY name ASC',
    [eventId]
  );
  return rows.map(mapEventPersonnelRow);
}

export async function saveApEventPersonnel(
  row: Omit<ApEventPersonnel, 'id' | 'synced'> & { id?: string },
  database?: SQLite.SQLiteDatabase
): Promise<string> {
  const db = await resolveDb(database);
  const id = row.id ?? generateApId();
  const n = nowIso();
  await db.runAsync(
    `INSERT OR REPLACE INTO ap_event_personnel (
      id,event_id,source,name,day_role,day_mission,phone,email,source_personnel_id,updated_at,synced)
     VALUES (?,?,?,?,?,?,?,?,?,?,0)`,
    [
      id,
      row.event_id,
      row.source,
      row.name,
      row.day_role ?? null,
      row.day_mission ?? row.day_role ?? null,
      row.phone ?? null,
      row.email ?? null,
      row.source_personnel_id ?? null,
      row.updated_at ?? n,
    ]
  );
  return id;
}

export async function addPersonnelToEventFromDirectory(
  eventId: string,
  personnelDirectoryId: string,
  dayRole: string | null | undefined,
  database?: SQLite.SQLiteDatabase
): Promise<void> {
  const dir = await getApPersonnel(personnelDirectoryId, database);
  if (!dir) return;
  await saveApEventPersonnel(
    {
      event_id: eventId,
      source: 'directory',
      source_personnel_id: dir.id,
      name: personnelDisplayName(dir),
      day_role: dayRole?.trim() || null,
      day_mission: dayRole?.trim() || null,
      phone: dir.phone ?? null,
      email: dir.email ?? null,
    },
    database
  );
}

/** Crée une fiche annuaire + l’ajoute à l’équipe de l’événement. */
export async function createDirectoryPersonnelForEvent(
  input: {
    eventId: string;
    venueId: string;
    first_name: string;
    last_name: string;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    role?: string | null;
    day_role?: string | null;
  },
  database?: SQLite.SQLiteDatabase
): Promise<string> {
  const personnelId = generateApId();
  const displayName = buildPersonnelDisplayName({
    first_name: input.first_name,
    last_name: input.last_name,
  });
  await savePersonnel(
    {
      id: personnelId,
      venue_id: input.venueId,
      name: displayName,
      first_name: input.first_name.trim() || null,
      last_name: input.last_name.trim() || null,
      address: input.address?.trim() || null,
      role: input.role?.trim() || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      kind: 'externe',
    },
    database
  );
  await saveApEventPersonnel(
    {
      event_id: input.eventId,
      source: 'directory',
      source_personnel_id: personnelId,
      name: displayName,
      day_role: input.day_role?.trim() || input.role?.trim() || null,
      day_mission: input.day_role?.trim() || input.role?.trim() || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
    },
    database
  );
  return personnelId;
}

export async function confirmRentalAsEvent(rentalId: string, database?: SQLite.SQLiteDatabase): Promise<string | null> {
  const r = await getApRentalRequest(rentalId, database);
  if (!r) return null;
  const eventId = generateApId();
  const ids = await listRentalRequestSpaceIds(rentalId, database);
  const mode = r.spaces_mode ?? 'all';
  await saveEvent(
    {
      id: eventId,
      venue_id: r.venue_id ?? null,
      organization_id: r.organization_id,
      name: r.event_name?.trim() || 'Événement',
      date_debut: r.date_debut,
      date_fin: r.date_fin ?? null,
      heure_debut: r.heure_debut ?? null,
      heure_fin: r.heure_fin ?? null,
      participants: r.participants ?? 0,
      description: [r.motif, r.notes].filter(Boolean).join('\n') || '',
      status: 'confirmé',
      spaces_mode: mode,
      selected_space_ids: ids,
      space_id: r.space_id ?? (ids[0] ?? null),
    },
    database
  );
  await saveRentalRequest({ ...r, status: 'validée', id: rentalId }, database);
  return eventId;
}

export async function findOrCreateOrganizationForAssociation(
  profile: AssociationPortalProfile,
  database?: SQLite.SQLiteDatabase
): Promise<string | null> {
  const nom = profile.name?.trim();
  if (!nom) return null;
  const dbConn = await resolveDb(database);
  await ensureAccueilProSchema(dbConn);
  const orgs = await listOrganizations(dbConn);
  const key = nom.toLowerCase();
  const found = orgs.find(o => o.name.trim().toLowerCase() === key);
  if (found) {
    await saveOrganization(
      {
        ...found,
        type: profile.type?.trim() || found.type || null,
        siret: profile.siret?.trim() || found.siret || null,
        address: profile.address?.trim() || found.address || null,
        cp: profile.cp?.trim() || found.cp || null,
        city: profile.city?.trim() || found.city || null,
        phone: profile.phone?.trim() || found.phone || null,
        email: profile.email?.trim() || found.email || null,
        website: profile.website?.trim() || found.website || null,
        notes_internes: profile.notes?.trim() || found.notes_internes || null,
      },
      dbConn
    );
    const primaryName = profile.contactName?.trim();
    if (primaryName) {
      const contacts = await listContacts(found.id, dbConn);
      const existingPrimary = contacts.find(c => c.is_primary);
      if (!existingPrimary) {
        await saveContact(
          {
            id: generateApId(),
            organization_id: found.id,
            name: primaryName,
            role: null,
            phone: profile.phone?.trim() ?? null,
            email: profile.email?.trim() ?? null,
            is_primary: true,
          },
          dbConn
        );
      }
    }
    return found.id;
  }

  const id = generateApId();
  await saveOrganization(
    {
      id,
      name: nom,
      type: profile.type?.trim() || null,
      siret: profile.siret?.trim() || null,
      address: profile.address?.trim() || null,
      cp: profile.cp?.trim() || null,
      city: profile.city?.trim() || null,
      phone: profile.phone?.trim() || null,
      email: profile.email?.trim() || null,
      website: profile.website?.trim() || null,
      notes_internes: profile.notes?.trim() ?? null,
      status: 'actif',
      supabase_user_id: null,
      created_at: undefined,
      updated_at: undefined,
    },
    dbConn
  );
  const pname = profile.contactName?.trim();
  if (pname) {
    await saveContact(
      {
        id: generateApId(),
        organization_id: id,
        name: pname,
        role: null,
        phone: profile.phone ?? null,
        email: profile.email ?? null,
        is_primary: true,
      },
      dbConn
    );
  }
  return id;
}

export async function importAssociationProfileAsOrganization(
  profile: AssociationPortalProfile,
  database?: SQLite.SQLiteDatabase
): Promise<string> {
  const id = await findOrCreateOrganizationForAssociation(profile, database);
  if (!id) throw new Error('association: nom organisation requis');
  return id;
}

export async function appendApActivityLog(
  entry: Omit<ApActivityLogEntry, 'id' | 'created_at'> & { id?: string; created_at?: string },
  database?: SQLite.SQLiteDatabase
): Promise<string> {
  const db = await resolveDb(database);
  await ensureAccueilProSchema(db);
  const id = entry.id ?? generateApId();
  const created = entry.created_at ?? nowIso();
  await db.runAsync(
    `INSERT INTO ap_activity_log (id, action, entity, entity_id, summary, actor_name, created_at)
     VALUES (?,?,?,?,?,?,?)`,
    [
      id,
      entry.action,
      entry.entity,
      entry.entity_id ?? null,
      entry.summary,
      entry.actor_name ?? null,
      created,
    ]
  );
  return id;
}

export async function listApActivityLogs(
  opts?: { limit?: number },
  database?: SQLite.SQLiteDatabase
): Promise<ApActivityLogEntry[]> {
  const db = await resolveDb(database);
  await ensureAccueilProSchema(db);
  const limit = Math.min(500, Math.max(1, opts?.limit ?? 120));
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM ap_activity_log ORDER BY datetime(created_at) DESC LIMIT ?`,
    [limit]
  );
  return rows.map(r => ({
    id: r.id,
    action: r.action,
    entity: r.entity,
    entity_id: r.entity_id ?? null,
    summary: r.summary,
    actor_name: r.actor_name ?? null,
    created_at: r.created_at ?? null,
  }));
}

export async function countApActivityLogs(database?: SQLite.SQLiteDatabase): Promise<number> {
  const db = await resolveDb(database);
  await ensureAccueilProSchema(db);
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) as n FROM ap_activity_log');
  return row?.n ?? 0;
}

export async function listApDayPlanItems(
  planDate: string,
  database?: SQLite.SQLiteDatabase
): Promise<ApDayPlanItem[]> {
  const db = await resolveDb(database);
  await ensureAccueilProSchema(db);
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM ap_day_plan_items WHERE plan_date = ? ORDER BY COALESCE(time_start, '99:99'), sort_order, title`,
    [planDate]
  );
  return rows.map(mapDayPlanItemRow);
}

export async function listApDayPlanItemsForEvent(
  eventId: string,
  planDate?: string,
  database?: SQLite.SQLiteDatabase
): Promise<ApDayPlanItem[]> {
  const db = await resolveDb(database);
  await ensureAccueilProSchema(db);
  let date = planDate?.trim();
  if (!date) {
    const ev = await getApEvent(eventId, db);
    date = (ev?.date_debut ?? '').slice(0, 10);
  }
  if (!date) return [];
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM ap_day_plan_items WHERE event_id = ? AND plan_date = ?
     ORDER BY COALESCE(time_start, '99:99'), sort_order, title`,
    [eventId, date]
  );
  return rows.map(mapDayPlanItemRow);
}

/** Crée une première ligne de planning à partir des horaires de l’événement (si vide). */
export async function seedApDayPlanFromSingleEvent(
  eventId: string,
  database?: SQLite.SQLiteDatabase
): Promise<number> {
  const db = await resolveDb(database);
  const ev = await getApEvent(eventId, db);
  if (!ev?.date_debut) return 0;
  const planDate = ev.date_debut.slice(0, 10);
  const existing = await listApDayPlanItemsForEvent(eventId, planDate, db);
  if (existing.length > 0) return 0;
  const team = await listApEventPersonnel(eventId, db);
  const spaces = await resolveSpacesForEvent(ev, db);
  await saveApDayPlanItem(
    {
      plan_date: planDate,
      event_id: ev.id,
      time_start: ev.heure_debut ?? null,
      time_end: ev.heure_fin ?? null,
      title: ev.name,
      assignee_name: team.map(p => p.name).join(', ') || null,
      space_id: spaces[0]?.id ?? ev.space_id ?? null,
      venue_id: ev.venue_id ?? null,
      notes: null,
      sort_order: 0,
    },
    db
  );
  return 1;
}

export async function getApDayPlanItem(
  id: string,
  database?: SQLite.SQLiteDatabase
): Promise<ApDayPlanItem | null> {
  const db = await resolveDb(database);
  const row = await db.getFirstAsync<any>('SELECT * FROM ap_day_plan_items WHERE id = ?', [id]);
  return row ? mapDayPlanItemRow(row) : null;
}

export async function saveApDayPlanItem(
  row: Omit<ApDayPlanItem, 'id' | 'synced'> & { id?: string },
  database?: SQLite.SQLiteDatabase
): Promise<string> {
  const db = await resolveDb(database);
  await ensureAccueilProSchema(db);
  const id = row.id ?? generateApId();
  const n = nowIso();
  await db.runAsync(
    `INSERT OR REPLACE INTO ap_day_plan_items (
      id,plan_date,event_id,time_start,time_end,title,assignee_name,space_id,venue_id,notes,sort_order,updated_at,synced)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0)`,
    [
      id,
      row.plan_date,
      row.event_id ?? null,
      row.time_start?.trim() || null,
      row.time_end?.trim() || null,
      row.title.trim(),
      row.assignee_name?.trim() || null,
      row.space_id ?? null,
      row.venue_id ?? null,
      row.notes?.trim() || null,
      row.sort_order ?? 0,
      row.updated_at ?? n,
    ]
  );
  return id;
}

export async function deleteApDayPlanItem(id: string, database?: SQLite.SQLiteDatabase): Promise<void> {
  const db = await resolveDb(database);
  await db.runAsync('DELETE FROM ap_day_plan_items WHERE id = ?', [id]);
}

export async function getApDayNote(
  planDate: string,
  database?: SQLite.SQLiteDatabase
): Promise<ApDayNote | null> {
  const db = await resolveDb(database);
  await ensureAccueilProSchema(db);
  const row = await db.getFirstAsync<any>('SELECT * FROM ap_day_notes WHERE plan_date = ?', [planDate]);
  return row ? mapDayNoteRow(row) : null;
}

export async function saveApDayNote(
  planDate: string,
  note: string,
  database?: SQLite.SQLiteDatabase
): Promise<void> {
  const db = await resolveDb(database);
  await ensureAccueilProSchema(db);
  const n = nowIso();
  await db.runAsync(
    `INSERT OR REPLACE INTO ap_day_notes (plan_date,note,updated_at,synced) VALUES (?,?,?,0)`,
    [planDate, note, n]
  );
}

/** Pré-remplit le planning du jour à partir des événements confirmés (une ligne par événement). */
export async function seedApDayPlanFromEvents(
  planDate: string,
  database?: SQLite.SQLiteDatabase
): Promise<number> {
  const db = await resolveDb(database);
  const existing = await listApDayPlanItems(planDate, db);
  if (existing.length > 0) return 0;
  const allEvents = await listApEvents(undefined, db);
  const dayEvents = allEvents.filter(
    e => (e.date_debut ?? '') <= planDate && (e.date_fin ?? e.date_debut ?? '') >= planDate && e.status !== 'annulé'
  );
  let n = 0;
  for (const ev of dayEvents) {
    const team = await listApEventPersonnel(ev.id, db);
    const spaces = await resolveSpacesForEvent(ev, db);
    await saveApDayPlanItem(
      {
        plan_date: planDate,
        event_id: ev.id,
        time_start: ev.heure_debut ?? null,
        time_end: ev.heure_fin ?? null,
        title: ev.name,
        assignee_name: team.map(p => p.name).join(', ') || null,
        space_id: spaces[0]?.id ?? ev.space_id ?? null,
        venue_id: ev.venue_id ?? null,
        sort_order: n,
      },
      db
    );
    n += 1;
  }
  return n;
}

import type { ActivityLog, Assignment, Tour, TourDocument, TourFlightcase, TourLocation } from '../types';
import { generateId, getDB } from './database';
import * as FileSystem from 'expo-file-system/legacy';

function mapTourRow(r: any): Tour {
  return {
    id: r.id,
    name: r.name,
    status: r.status,
    startDate: r.start_date,
    endDate: r.end_date ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    synced: !!r.synced,
  };
}

function mapLocationRow(r: any): TourLocation {
  return {
    id: r.id,
    name: r.name,
    address: r.address ?? null,
    dateStart: r.date_start ?? null,
    dateEnd: r.date_end ?? null,
    tourId: r.tour_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    synced: !!r.synced,
  };
}

function mapAssignmentRow(r: any): Assignment {
  return {
    id: r.id,
    materialId: r.material_id,
    tourId: r.tour_id,
    locationId: r.location_id ?? null,
    flightcaseId: r.flightcase_id ?? null,
    packagingPhotoLocal: r.packaging_photo_local ?? null,
    quantity: Number(r.quantity ?? 0),
    status: r.status,
    assignedAt: r.assigned_at,
    returnedAt: r.returned_at ?? null,
    assignedTo: r.assigned_to ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    synced: !!r.synced,
  };
}

function mapFlightcaseRow(r: any): TourFlightcase {
  return {
    id: r.id,
    tourId: r.tour_id,
    caseNumber: Number(r.case_number ?? 0),
    totalCases: Number(r.total_cases ?? 0),
    label: r.label,
    qrCode: r.qr_code,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    synced: !!r.synced,
  };
}

function mapLogRow(r: any): ActivityLog {
  return {
    id: r.id,
    type: r.type,
    materialId: r.material_id,
    tourId: r.tour_id ?? null,
    locationId: r.location_id ?? null,
    userId: r.user_id ?? null,
    timestamp: r.timestamp,
    note: r.note ?? null,
    createdAt: r.created_at,
    synced: !!r.synced,
    materialName: r.material_name ?? null,
    tourName: r.tour_name ?? null,
    locationName: r.location_name ?? null,
  };
}

function mapTourDocumentRow(r: any): TourDocument {
  return {
    id: r.id,
    tourId: r.tour_id,
    title: r.title,
    fileName: r.file_name,
    mimeType: r.mime_type ?? null,
    fileSize: r.file_size ?? null,
    localUri: r.local_uri,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    synced: !!r.synced,
  };
}

export async function listTours(): Promise<Tour[]> {
  const database = await getDB();
  const rows = await database.getAllAsync<any>('SELECT * FROM tours ORDER BY start_date DESC, created_at DESC');
  return rows.map(mapTourRow);
}

export async function getTourById(id: string): Promise<Tour | null> {
  const database = await getDB();
  const row = await database.getFirstAsync<any>('SELECT * FROM tours WHERE id = ?', [id]);
  return row ? mapTourRow(row) : null;
}

export async function updateTour(input: {
  id: string;
  name?: string;
  status?: Tour['status'];
  endDate?: string | null;
}): Promise<Tour> {
  const database = await getDB();
  const existing = await getTourById(input.id);
  if (!existing) throw new Error('Tournée introuvable.');
  const now = new Date().toISOString();
  const name = input.name !== undefined ? input.name.trim() : existing.name;
  if (!name) throw new Error('Le nom ne peut pas être vide.');
  const status = input.status ?? existing.status;
  const endDate = input.endDate !== undefined ? input.endDate : existing.endDate;
  await database.runAsync(
    `UPDATE tours SET name = ?, status = ?, end_date = ?, updated_at = ?, synced = 0 WHERE id = ?`,
    [name, status, endDate ?? null, now, input.id]
  );
  const row = await database.getFirstAsync<any>('SELECT * FROM tours WHERE id = ?', [input.id]);
  return mapTourRow(row);
}

/**
 * Supprime une tournée et ses dépendances (lieux, affectations, logs, documents SQL via FK cascade),
 * puis efface aussi les fichiers locaux des documents pour éviter les orphelins sur l'appareil.
 */
export async function deleteTour(tourId: string): Promise<void> {
  const database = await getDB();
  const docs = await database.getAllAsync<{ local_uri: string | null }>(
    'SELECT local_uri FROM tour_documents WHERE tour_id = ?',
    [tourId]
  );
  await database.runAsync('DELETE FROM tours WHERE id = ?', [tourId]);

  for (const d of docs) {
    const uri = d?.local_uri?.trim();
    if (!uri || !uri.startsWith('file://')) continue;
    try {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    } catch {
      // ignore cleanup failures
    }
  }
}

export async function createTour(input: {
  name: string;
  status?: Tour['status'];
  startDate: string;
  endDate?: string | null;
}): Promise<Tour> {
  const database = await getDB();
  const now = new Date().toISOString();
  const id = generateId();
  await database.runAsync(
    `INSERT INTO tours (id, name, status, start_date, end_date, created_at, updated_at, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
    [id, input.name.trim(), input.status ?? 'planned', input.startDate, input.endDate ?? null, now, now]
  );
  const row = await database.getFirstAsync<any>('SELECT * FROM tours WHERE id = ?', [id]);
  return mapTourRow(row);
}

export async function listTourLocations(tourId: string): Promise<TourLocation[]> {
  const database = await getDB();
  const rows = await database.getAllAsync<any>(
    'SELECT * FROM tour_locations WHERE tour_id = ? ORDER BY date_start ASC, created_at ASC',
    [tourId]
  );
  return rows.map(mapLocationRow);
}

export async function listTourDocuments(tourId: string): Promise<TourDocument[]> {
  const database = await getDB();
  const rows = await database.getAllAsync<any>(
    'SELECT * FROM tour_documents WHERE tour_id = ? ORDER BY created_at DESC',
    [tourId]
  );
  return rows.map(mapTourDocumentRow);
}

export async function addTourDocument(input: {
  tourId: string;
  title: string;
  fileName: string;
  mimeType?: string | null;
  fileSize?: number | null;
  localUri: string;
}): Promise<TourDocument> {
  const database = await getDB();
  const now = new Date().toISOString();
  const id = generateId();
  await database.runAsync(
    `INSERT INTO tour_documents
     (id, tour_id, title, file_name, mime_type, file_size, local_uri, created_at, updated_at, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      id,
      input.tourId,
      input.title.trim(),
      input.fileName.trim(),
      input.mimeType ?? null,
      input.fileSize ?? null,
      input.localUri,
      now,
      now,
    ]
  );
  const row = await database.getFirstAsync<any>('SELECT * FROM tour_documents WHERE id = ?', [id]);
  return mapTourDocumentRow(row);
}

export async function deleteTourDocument(documentId: string): Promise<TourDocument | null> {
  const database = await getDB();
  const row = await database.getFirstAsync<any>('SELECT * FROM tour_documents WHERE id = ?', [documentId]);
  if (!row) return null;
  await database.runAsync('DELETE FROM tour_documents WHERE id = ?', [documentId]);
  return mapTourDocumentRow(row);
}

export async function updateTourDocumentTitle(documentId: string, title: string): Promise<TourDocument | null> {
  const database = await getDB();
  const clean = title.trim();
  if (!clean) return null;
  const now = new Date().toISOString();
  await database.runAsync(
    'UPDATE tour_documents SET title = ?, updated_at = ?, synced = 0 WHERE id = ?',
    [clean, now, documentId]
  );
  const row = await database.getFirstAsync<any>('SELECT * FROM tour_documents WHERE id = ?', [documentId]);
  return row ? mapTourDocumentRow(row) : null;
}

export async function listTourFlightcases(tourId: string): Promise<TourFlightcase[]> {
  const database = await getDB();
  const rows = await database.getAllAsync<any>(
    'SELECT * FROM tour_flightcases WHERE tour_id = ? ORDER BY case_number ASC, created_at ASC',
    [tourId]
  );
  return rows.map(mapFlightcaseRow);
}

export async function createTourFlightcases(input: {
  tourId: string;
  totalCases: number;
}): Promise<TourFlightcase[]> {
  const database = await getDB();
  const total = Math.max(1, Math.floor(Number(input.totalCases) || 0));
  const now = new Date().toISOString();
  const out: TourFlightcase[] = [];
  for (let i = 1; i <= total; i += 1) {
    const id = generateId();
    const label = `${i}/${total}`;
    const qrCode = `STAGESTOCK-FC:${input.tourId}:${i}:${total}:${id}`;
    await database.runAsync(
      `INSERT INTO tour_flightcases (id, tour_id, case_number, total_cases, label, qr_code, created_at, updated_at, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [id, input.tourId, i, total, label, qrCode, now, now]
    );
    const row = await database.getFirstAsync<any>('SELECT * FROM tour_flightcases WHERE id = ?', [id]);
    if (row) out.push(mapFlightcaseRow(row));
  }
  return out;
}

export async function findTourFlightcaseByScan(scanRaw: string): Promise<TourFlightcase | null> {
  const database = await getDB();
  const code = scanRaw.trim();
  if (!code) return null;
  const row = await database.getFirstAsync<any>(
    `SELECT * FROM tour_flightcases WHERE qr_code = ? OR id = ? LIMIT 1`,
    [code, code]
  );
  return row ? mapFlightcaseRow(row) : null;
}

export async function createTourLocation(input: {
  name: string;
  address?: string | null;
  dateStart?: string | null;
  dateEnd?: string | null;
  tourId: string;
}): Promise<TourLocation> {
  const database = await getDB();
  const now = new Date().toISOString();
  const id = generateId();
  await database.runAsync(
    `INSERT INTO tour_locations (id, name, address, date_start, date_end, tour_id, created_at, updated_at, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [id, input.name.trim(), input.address ?? null, input.dateStart ?? null, input.dateEnd ?? null, input.tourId, now, now]
  );
  const row = await database.getFirstAsync<any>('SELECT * FROM tour_locations WHERE id = ?', [id]);
  return mapLocationRow(row);
}

export async function listAssignmentsByTour(tourId: string): Promise<Assignment[]> {
  const database = await getDB();
  const rows = await database.getAllAsync<any>(
    'SELECT * FROM material_assignments WHERE tour_id = ? ORDER BY assigned_at DESC',
    [tourId]
  );
  return rows.map(mapAssignmentRow);
}

export async function listAssignmentsByMaterial(materialId: string): Promise<Assignment[]> {
  const database = await getDB();
  const rows = await database.getAllAsync<any>(
    'SELECT * FROM material_assignments WHERE material_id = ? ORDER BY assigned_at DESC',
    [materialId]
  );
  return rows.map(mapAssignmentRow);
}

export async function getAssignmentById(assignmentId: string): Promise<Assignment | null> {
  const database = await getDB();
  const row = await database.getFirstAsync<any>(
    'SELECT * FROM material_assignments WHERE id = ?',
    [assignmentId]
  );
  return row ? mapAssignmentRow(row) : null;
}

/** Somme des quantités encore en suivi actif (hors retourné / perdu / abîmé). */
export async function sumActiveAssignmentQuantityForMaterial(materialId: string): Promise<number> {
  const database = await getDB();
  const row = await database.getFirstAsync<{ s: number | null }>(
    `SELECT COALESCE(SUM(quantity), 0) AS s FROM material_assignments
     WHERE material_id = ? AND status IN ('assigned', 'in_use')`,
    [materialId]
  );
  const n = Number(row?.s ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export async function createAssignment(input: {
  materialId: string;
  tourId: string;
  locationId?: string | null;
  flightcaseId?: string | null;
  packagingPhotoLocal?: string | null;
  quantity: number;
  status?: Assignment['status'];
  assignedAt: string;
  assignedTo?: string | null;
}): Promise<Assignment> {
  const database = await getDB();
  const now = new Date().toISOString();
  const id = generateId();
  const tourRow = await database.getFirstAsync<{ name: string }>('SELECT name FROM tours WHERE id = ?', [
    input.tourId,
  ]);
  const tourName = (tourRow?.name ?? '').trim();
  await database.runAsync(
    `INSERT INTO material_assignments (
      id, material_id, tour_id, location_id, flightcase_id, packaging_photo_local, quantity, status, assigned_at, assigned_to, created_at, updated_at, synced
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      id,
      input.materialId,
      input.tourId,
      input.locationId ?? null,
      input.flightcaseId ?? null,
      input.packagingPhotoLocal ?? null,
      input.quantity,
      input.status ?? 'assigned',
      input.assignedAt,
      input.assignedTo ?? null,
      now,
      now,
    ]
  );
  await database.runAsync(
    `UPDATE materiels
     SET tracking_state = 'in_tour', statut = 'en tournée',
         maintenance_last_comment = ?, current_tour_id = ?, current_location_id = ?, updated_at = ?, synced = 0
     WHERE id = ?`,
    [tourName ? `On tour: ${tourName}` : 'On tour', input.tourId, input.locationId ?? null, now, input.materialId]
  );
  const row = await database.getFirstAsync<any>('SELECT * FROM material_assignments WHERE id = ?', [id]);
  return mapAssignmentRow(row);
}

export async function updateAssignmentPackagingPhoto(assignmentId: string, photoUri: string | null): Promise<void> {
  const database = await getDB();
  const now = new Date().toISOString();
  await database.runAsync(
    `UPDATE material_assignments
     SET packaging_photo_local = ?, updated_at = ?, synced = 0
     WHERE id = ?`,
    [photoUri ?? null, now, assignmentId]
  );
}

export async function updateAssignmentStatus(
  assignmentId: string,
  input: { status: Assignment['status']; returnedAt?: string | null; locationId?: string | null }
): Promise<void> {
  const database = await getDB();
  const now = new Date().toISOString();
  await database.runAsync(
    `UPDATE material_assignments
     SET status = ?, returned_at = COALESCE(?, returned_at), location_id = COALESCE(?, location_id), updated_at = ?, synced = 0
     WHERE id = ?`,
    [input.status, input.returnedAt ?? null, input.locationId ?? null, now, assignmentId]
  );
  const row = await database.getFirstAsync<any>('SELECT * FROM material_assignments WHERE id = ?', [assignmentId]);
  if (!row) return;
  const trackingState =
    input.status === 'returned'
      ? 'available'
      : input.status === 'lost'
        ? 'lost'
        : input.status === 'damaged'
          ? 'damaged'
          : 'in_tour';
  await database.runAsync(
    `UPDATE materiels
     SET tracking_state = ?, statut = ?, maintenance_last_comment = ?,
         current_tour_id = ?, current_location_id = ?, updated_at = ?, synced = 0
     WHERE id = ?`,
    [
      trackingState,
      input.status === 'returned'
        ? 'en stock'
        : input.status === 'lost'
          ? 'perdu'
          : input.status === 'damaged'
            ? 'en réparation'
            : 'en tournée',
      input.status === 'returned'
        ? null
        : input.status === 'lost'
          ? 'Matériel signalé perdu en tournée'
          : input.status === 'damaged'
            ? 'Matériel signalé abîmé en tournée'
            : 'On tour',
      trackingState === 'available' ? null : row.tour_id,
      input.status === 'returned' ? null : input.locationId ?? row.location_id ?? null,
      now,
      row.material_id,
    ]
  );
}

export async function moveAssignment(assignmentId: string, locationId: string): Promise<void> {
  const database = await getDB();
  const now = new Date().toISOString();
  await database.runAsync(
    `UPDATE material_assignments SET location_id = ?, updated_at = ?, synced = 0 WHERE id = ?`,
    [locationId, now, assignmentId]
  );
  const row = await database.getFirstAsync<any>('SELECT material_id FROM material_assignments WHERE id = ?', [assignmentId]);
  if (row?.material_id) {
    await database.runAsync(
      `UPDATE materiels SET current_location_id = ?, updated_at = ?, synced = 0 WHERE id = ?`,
      [locationId, now, row.material_id]
    );
  }
}

export async function logActivity(input: {
  type: ActivityLog['type'];
  materialId: string;
  tourId?: string | null;
  locationId?: string | null;
  userId?: string | null;
  timestamp: string;
  note?: string | null;
}): Promise<ActivityLog> {
  const database = await getDB();
  const id = generateId();
  const now = new Date().toISOString();
  await database.runAsync(
    `INSERT INTO activity_logs (
      id, type, material_id, tour_id, location_id, user_id, timestamp, note, created_at, synced
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      id,
      input.type,
      input.materialId,
      input.tourId ?? null,
      input.locationId ?? null,
      input.userId ?? null,
      input.timestamp,
      input.note ?? null,
      now,
    ]
  );
  const row = await database.getFirstAsync<any>('SELECT * FROM activity_logs WHERE id = ?', [id]);
  return mapLogRow(row);
}

export async function listActivityLogs(filters?: {
  materialId?: string;
  tourId?: string;
}): Promise<ActivityLog[]> {
  const database = await getDB();
  let sql = `
    SELECT
      al.id, al.type, al.material_id, al.tour_id, al.location_id, al.user_id, al.timestamp, al.note, al.created_at, al.synced,
      m.nom AS material_name,
      t.name AS tour_name,
      tl.name AS location_name
    FROM activity_logs al
    LEFT JOIN materiels m ON m.id = al.material_id
    LEFT JOIN tours t ON t.id = al.tour_id
    LEFT JOIN tour_locations tl ON tl.id = al.location_id
    WHERE 1=1`;
  const params: string[] = [];
  if (filters?.materialId) {
    sql += ' AND al.material_id = ?';
    params.push(filters.materialId);
  }
  if (filters?.tourId) {
    sql += ' AND al.tour_id = ?';
    params.push(filters.tourId);
  }
  sql += ' ORDER BY al.timestamp DESC, al.created_at DESC LIMIT 500';
  const rows = await database.getAllAsync<any>(sql, params);
  return rows.map(mapLogRow);
}

export async function getTrackingSnapshot(statusFilter?: string | null): Promise<
  Array<{
    materialId: string;
    materialName: string;
    assignmentQuantity: number;
    assignmentStatus: string;
    tourName: string | null;
    locationName: string | null;
    assignedTo: string | null;
    assignedAt: string;
  }>
> {
  const database = await getDB();
  const f = statusFilter?.trim();
  const useAll = !f || f === 'all';
  const base = `SELECT
      a.material_id as materialId,
      m.nom as materialName,
      a.quantity as assignmentQuantity,
      a.status as assignmentStatus,
      t.name as tourName,
      l.name as locationName,
      a.assigned_to as assignedTo,
      a.assigned_at as assignedAt
     FROM material_assignments a
     JOIN materiels m ON m.id = a.material_id
     LEFT JOIN tours t ON t.id = a.tour_id
     LEFT JOIN tour_locations l ON l.id = a.location_id`;
  if (useAll) {
    return database.getAllAsync<any>(
      `${base}
     WHERE a.status IN ('assigned', 'in_use', 'returned', 'lost', 'damaged')
     ORDER BY a.assigned_at DESC
     LIMIT 400`
    );
  }
  return database.getAllAsync<any>(
    `${base}
     WHERE a.status = ?
     ORDER BY a.assigned_at DESC
     LIMIT 400`,
    [f]
  );
}

export async function listUnsyncedTourEntities(): Promise<{
  tours: Tour[];
  locations: TourLocation[];
  assignments: Assignment[];
  logs: ActivityLog[];
}> {
  const database = await getDB();
  const [toursRows, locRows, asgRows, logRows] = await Promise.all([
    database.getAllAsync<any>('SELECT * FROM tours WHERE synced = 0'),
    database.getAllAsync<any>('SELECT * FROM tour_locations WHERE synced = 0'),
    database.getAllAsync<any>('SELECT * FROM material_assignments WHERE synced = 0'),
    database.getAllAsync<any>('SELECT * FROM activity_logs WHERE synced = 0'),
  ]);
  return {
    tours: toursRows.map(mapTourRow),
    locations: locRows.map(mapLocationRow),
    assignments: asgRows.map(mapAssignmentRow),
    logs: logRows.map(mapLogRow),
  };
}

export async function markTourEntitiesSynced(input: {
  tourIds?: string[];
  locationIds?: string[];
  assignmentIds?: string[];
  logIds?: string[];
}): Promise<void> {
  const database = await getDB();
  const mark = async (table: string, ids: string[]) => {
    if (!ids.length) return;
    const placeholders = ids.map(() => '?').join(', ');
    await database.runAsync(`UPDATE ${table} SET synced = 1 WHERE id IN (${placeholders})`, ids);
  };
  await mark('tours', input.tourIds ?? []);
  await mark('tour_locations', input.locationIds ?? []);
  await mark('material_assignments', input.assignmentIds ?? []);
  await mark('activity_logs', input.logIds ?? []);
}

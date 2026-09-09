import type * as SQLite from 'expo-sqlite';
import type {
  ApPersonnelBudgetLine,
  ApPersonnelBudgetStatus,
  ApShoppingCategory,
  ApShoppingListItem,
} from '../types/accueilPro';
import { ensureAccueilProSchema, generateApId } from './accueilProDb';
import { getDB } from './coreDb';

async function resolveDb(database?: SQLite.SQLiteDatabase) {
  const db = database ?? (await getDB());
  await ensureAccueilProSchema(db);
  return db;
}

function nowIso() {
  return new Date().toISOString();
}

function mapBudget(r: any): ApPersonnelBudgetLine {
  return {
    id: r.id,
    event_id: r.event_id,
    role: r.role,
    quantity: Number(r.quantity) || 1,
    hours: Number(r.hours) || 0,
    rate_eur: Number(r.rate_eur) || 0,
    notes: r.notes ?? null,
    status: (r.status as ApPersonnelBudgetStatus) || 'proposed',
    source: r.source ?? null,
    updated_at: r.updated_at ?? null,
    synced: !!r.synced,
  };
}

function mapShop(r: any): ApShoppingListItem {
  return {
    id: r.id,
    event_id: r.event_id,
    label: r.label,
    quantity: Number(r.quantity) || 1,
    unit: r.unit ?? null,
    category: (r.category as ApShoppingCategory) || 'autre',
    notes: r.notes ?? null,
    checked: !!r.checked,
    source: r.source ?? null,
    updated_at: r.updated_at ?? null,
    synced: !!r.synced,
  };
}

export async function listPersonnelBudgetLines(
  eventId: string,
  database?: SQLite.SQLiteDatabase
): Promise<ApPersonnelBudgetLine[]> {
  const db = await resolveDb(database);
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM ap_personnel_budget_lines WHERE event_id = ? ORDER BY role ASC, id ASC`,
    [eventId]
  );
  return rows.map(mapBudget);
}

export async function savePersonnelBudgetLine(
  row: Omit<ApPersonnelBudgetLine, 'updated_at' | 'synced'> & { updated_at?: string; synced?: boolean },
  database?: SQLite.SQLiteDatabase
): Promise<void> {
  const db = await resolveDb(database);
  await db.runAsync(
    `INSERT OR REPLACE INTO ap_personnel_budget_lines
      (id, event_id, role, quantity, hours, rate_eur, notes, status, source, updated_at, synced)
     VALUES (?,?,?,?,?,?,?,?,?,?,0)`,
    [
      row.id,
      row.event_id,
      row.role,
      row.quantity,
      row.hours,
      row.rate_eur,
      row.notes ?? null,
      row.status,
      row.source ?? null,
      row.updated_at ?? nowIso(),
    ]
  );
}

export async function deletePersonnelBudgetLine(id: string, database?: SQLite.SQLiteDatabase): Promise<void> {
  const db = await resolveDb(database);
  await db.runAsync(`DELETE FROM ap_personnel_budget_lines WHERE id = ?`, [id]);
}

export async function replacePersonnelBudgetFromProposal(
  eventId: string,
  lines: Array<{
    role: string;
    quantity: number;
    hours: number;
    rate_eur: number;
    notes?: string;
  }>,
  database?: SQLite.SQLiteDatabase
): Promise<void> {
  const db = await resolveDb(database);
  await db.runAsync(`DELETE FROM ap_personnel_budget_lines WHERE event_id = ? AND status = 'proposed'`, [
    eventId,
  ]);
  for (const line of lines) {
    await savePersonnelBudgetLine(
      {
        id: generateApId(),
        event_id: eventId,
        role: line.role,
        quantity: line.quantity,
        hours: line.hours,
        rate_eur: line.rate_eur,
        notes: line.notes ?? null,
        status: 'proposed',
        source: 'ai',
      },
      db
    );
  }
}

export async function listShoppingListItems(
  eventId: string,
  database?: SQLite.SQLiteDatabase
): Promise<ApShoppingListItem[]> {
  const db = await resolveDb(database);
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM ap_shopping_list_items WHERE event_id = ?
     ORDER BY category ASC, checked ASC, label ASC`,
    [eventId]
  );
  return rows.map(mapShop);
}

export async function saveShoppingListItem(
  row: Omit<ApShoppingListItem, 'updated_at' | 'synced'> & { updated_at?: string; synced?: boolean },
  database?: SQLite.SQLiteDatabase
): Promise<void> {
  const db = await resolveDb(database);
  await db.runAsync(
    `INSERT OR REPLACE INTO ap_shopping_list_items
      (id, event_id, label, quantity, unit, category, notes, checked, source, updated_at, synced)
     VALUES (?,?,?,?,?,?,?,?,?,?,0)`,
    [
      row.id,
      row.event_id,
      row.label,
      row.quantity,
      row.unit ?? null,
      row.category,
      row.notes ?? null,
      row.checked ? 1 : 0,
      row.source ?? null,
      row.updated_at ?? nowIso(),
    ]
  );
}

export async function deleteShoppingListItem(id: string, database?: SQLite.SQLiteDatabase): Promise<void> {
  const db = await resolveDb(database);
  await db.runAsync(`DELETE FROM ap_shopping_list_items WHERE id = ?`, [id]);
}

export async function mergeShoppingListFromProposal(
  eventId: string,
  items: Array<{
    label: string;
    quantity: number;
    unit?: string;
    category: ApShoppingCategory;
    notes?: string;
  }>,
  database?: SQLite.SQLiteDatabase
): Promise<number> {
  const db = await resolveDb(database);
  const existing = await listShoppingListItems(eventId, db);
  const existingKeys = new Set(existing.map(e => e.label.trim().toLowerCase()));
  let added = 0;
  for (const item of items) {
    const key = item.label.trim().toLowerCase();
    if (!key || existingKeys.has(key)) continue;
    await saveShoppingListItem(
      {
        id: generateApId(),
        event_id: eventId,
        label: item.label.trim(),
        quantity: item.quantity,
        unit: item.unit ?? 'u',
        category: item.category,
        notes: item.notes ?? null,
        checked: false,
        source: 'ai',
      },
      db
    );
    existingKeys.add(key);
    added += 1;
  }
  return added;
}

export function budgetLineTotal(line: ApPersonnelBudgetLine): number {
  return Math.round(line.quantity * line.hours * line.rate_eur * 100) / 100;
}

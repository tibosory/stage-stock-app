/**
 * SqliteSyncStorage — S2.2
 *
 * Adapters SQLite réels pour le moteur `@caractere/sync-engine` :
 *   - `SqliteOutboxStorage`  → table `sync_outbox`
 *   - `SqliteCursorStore`    → table `sync_cursor`
 *   - `SqliteLogSink`        → table `sync_log`
 *
 * Ces tables sont déjà créées au boot (cf. `src/db/database.ts:158-196`).
 * Ce module est INERTE en production : aucun call-site ne l’utilise tant que
 * S2.4 n’est pas livré. Permet de tester unitairement le contrat sans risque.
 *
 * Stratégie de typage : on définit ici des interfaces miroir des types publics
 * `@caractere/types` / `@caractere/sync-engine`. Ce dédoublement temporaire
 * disparaît en S2.4 quand le mobile dépendra réellement du package
 * (`file:../packages/sync-engine`). Cf. §13bis / §14 de docs/SYNC_ENGINE_ARCHITECTURE.md.
 */

// ─── Façade DB minimale (sous-ensemble de l’API expo-sqlite) ─────────────────
//
// On évite d’importer `expo-sqlite` ici pour pouvoir tester ces adapters en
// pur Node (jamais bundlé par Expo dans les specs). Toute base qui expose ces
// 3 méthodes est compatible (expo-sqlite l’expose nativement).

export interface DbHandle {
  runAsync(sql: string, params?: ReadonlyArray<DbValue>): Promise<unknown>;
  getFirstAsync<T>(sql: string, params?: ReadonlyArray<DbValue>): Promise<T | null>;
  getAllAsync<T>(sql: string, params?: ReadonlyArray<DbValue>): Promise<T[]>;
}

export type DbValue = string | number | null;

// ─── Types miroir (à remplacer par `@caractere/types` en S2.4) ───────────────

export type SyncEntity =
  | 'materiel'
  | 'pret'
  | 'pret_materiel'
  | 'consommable'
  | 'consommable_mouvement'
  | 'categorie'
  | 'localisation'
  | 'alerte_email'
  | 'app_user'
  | 'mouvement_stock';

export type SyncMutationKind = 'create' | 'update' | 'delete';
export type SyncOutboxStatus = 'pending' | 'inflight' | 'failed' | 'done';

export interface SyncOutboxEntry {
  id: string;
  entity: SyncEntity;
  entity_id: string;
  kind: SyncMutationKind;
  payload: Record<string, unknown>;
  base_version: string | null;
  created_at: string;
  attempts: number;
  last_error: string | null;
  next_attempt_at: string | null;
  status: SyncOutboxStatus;
}

export interface SyncCursor {
  entity: SyncEntity;
  last_pulled_at: string | null;
  etag: string | null;
  record_count: number;
  updated_at: string;
}

export type SyncLogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface SyncLogEntry {
  ts: string;
  level: SyncLogLevel;
  event: string;
  entity?: SyncEntity;
  entity_id?: string;
  detail?: Record<string, unknown>;
}

export interface OutboxStorageListFilter {
  status?: SyncOutboxStatus | SyncOutboxStatus[];
  dueAtOrBefore?: string;
  limit?: number;
}

export interface OutboxStorage {
  list(filter: OutboxStorageListFilter): Promise<SyncOutboxEntry[]>;
  upsert(entries: SyncOutboxEntry[]): Promise<void>;
  remove(ids: string[]): Promise<void>;
  count(filter: OutboxStorageListFilter): Promise<number>;
}

export interface CursorStore {
  get(entity: SyncEntity): Promise<SyncCursor | null>;
  set(cursor: SyncCursor): Promise<void>;
}

export interface LogSink {
  write(entry: SyncLogEntry): void;
}

// ─── Helpers JSON (defensive) ────────────────────────────────────────────────

function serializeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return '{}';
  }
}

function parseJson<T = Record<string, unknown>>(text: string | null): T {
  if (!text) return {} as T;
  try {
    const v = JSON.parse(text);
    return (v && typeof v === 'object' ? v : ({} as T)) as T;
  } catch {
    return {} as T;
  }
}

// ─── SqliteOutboxStorage ─────────────────────────────────────────────────────

interface OutboxRow {
  id: string;
  entity: string;
  entity_id: string;
  kind: string;
  payload: string;
  base_version: string | null;
  created_at: string;
  attempts: number;
  last_error: string | null;
  next_attempt_at: string | null;
  status: string;
}

export class SqliteOutboxStorage implements OutboxStorage {
  constructor(private readonly db: DbHandle) {}

  async list(filter: OutboxStorageListFilter): Promise<SyncOutboxEntry[]> {
    const where: string[] = [];
    const params: DbValue[] = [];

    if (filter.status !== undefined) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      if (statuses.length === 0) return [];
      const placeholders = statuses.map(() => '?').join(',');
      where.push(`status IN (${placeholders})`);
      for (const s of statuses) params.push(s);
    }

    if (filter.dueAtOrBefore !== undefined) {
      where.push('(next_attempt_at IS NULL OR next_attempt_at <= ?)');
      params.push(filter.dueAtOrBefore);
    }

    let sql = 'SELECT id, entity, entity_id, kind, payload, base_version, created_at, attempts, last_error, next_attempt_at, status FROM sync_outbox';
    if (where.length > 0) sql += ` WHERE ${where.join(' AND ')}`;
    sql += ' ORDER BY created_at ASC, id ASC';
    if (typeof filter.limit === 'number' && filter.limit > 0) {
      sql += ' LIMIT ?';
      params.push(filter.limit);
    }

    const rows = await this.db.getAllAsync<OutboxRow>(sql, params);
    return rows.map(rowToEntry);
  }

  async upsert(entries: SyncOutboxEntry[]): Promise<void> {
    if (entries.length === 0) return;
    /** UPSERT individuel : SQLite supporte ON CONFLICT, mais on peut aussi
     *  utiliser INSERT OR REPLACE qui est plus simple et tout aussi atomique
     *  par ligne. Le bouclage série évite d’ouvrir une transaction (le moteur
     *  appelant la gère via son scheduler). */
    for (const e of entries) {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO sync_outbox
         (id, entity, entity_id, kind, payload, base_version, created_at, attempts, last_error, next_attempt_at, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          e.id,
          e.entity,
          e.entity_id,
          e.kind,
          serializeJson(e.payload),
          e.base_version,
          e.created_at,
          e.attempts,
          e.last_error,
          e.next_attempt_at,
          e.status,
        ],
      );
    }
  }

  async remove(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    await this.db.runAsync(
      `DELETE FROM sync_outbox WHERE id IN (${placeholders})`,
      ids as DbValue[],
    );
  }

  async count(filter: OutboxStorageListFilter): Promise<number> {
    const where: string[] = [];
    const params: DbValue[] = [];
    if (filter.status !== undefined) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      if (statuses.length === 0) return 0;
      const placeholders = statuses.map(() => '?').join(',');
      where.push(`status IN (${placeholders})`);
      for (const s of statuses) params.push(s);
    }
    if (filter.dueAtOrBefore !== undefined) {
      where.push('(next_attempt_at IS NULL OR next_attempt_at <= ?)');
      params.push(filter.dueAtOrBefore);
    }
    let sql = 'SELECT COUNT(*) AS n FROM sync_outbox';
    if (where.length > 0) sql += ` WHERE ${where.join(' AND ')}`;
    const row = await this.db.getFirstAsync<{ n: number }>(sql, params);
    return row?.n ?? 0;
  }
}

function rowToEntry(row: OutboxRow): SyncOutboxEntry {
  return {
    id: row.id,
    entity: row.entity as SyncEntity,
    entity_id: row.entity_id,
    kind: row.kind as SyncMutationKind,
    payload: parseJson<Record<string, unknown>>(row.payload),
    base_version: row.base_version,
    created_at: row.created_at,
    attempts: row.attempts,
    last_error: row.last_error,
    next_attempt_at: row.next_attempt_at,
    status: row.status as SyncOutboxStatus,
  };
}

// ─── SqliteCursorStore ───────────────────────────────────────────────────────

interface CursorRow {
  entity: string;
  last_pulled_at: string | null;
  etag: string | null;
  record_count: number;
  updated_at: string;
}

export class SqliteCursorStore implements CursorStore {
  constructor(private readonly db: DbHandle) {}

  async get(entity: SyncEntity): Promise<SyncCursor | null> {
    const row = await this.db.getFirstAsync<CursorRow>(
      `SELECT entity, last_pulled_at, etag, record_count, updated_at FROM sync_cursor WHERE entity = ?`,
      [entity],
    );
    if (!row) return null;
    return {
      entity: row.entity as SyncEntity,
      last_pulled_at: row.last_pulled_at,
      etag: row.etag,
      record_count: row.record_count,
      updated_at: row.updated_at,
    };
  }

  async set(cursor: SyncCursor): Promise<void> {
    await this.db.runAsync(
      `INSERT OR REPLACE INTO sync_cursor
       (entity, last_pulled_at, etag, record_count, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [
        cursor.entity,
        cursor.last_pulled_at,
        cursor.etag,
        cursor.record_count,
        cursor.updated_at,
      ],
    );
  }
}

// ─── SqliteLogSink ───────────────────────────────────────────────────────────
//
// Implémentation `LogSink` qui persiste les events warn/error en SQLite.
// Les niveaux debug/info restent en mémoire (RingBufferLogSink en amont).
// Ce sink est `write` synchrone côté contrat — l’écriture DB part en fire-and-forget
// pour ne pas bloquer le moteur de sync. Les erreurs SQL sont silencieuses
// (le sink ne doit jamais casser un flux upstream, cf. CompositeLogSink).

export interface SqliteLogSinkOptions {
  /** Seuils écrits en DB. Défaut : `warn` et `error`. */
  persistLevels?: ReadonlyArray<SyncLogLevel>;
  /** Capacité max (lignes). Au-delà : trim FIFO ; défaut 5000. */
  maxRows?: number;
  /** Fenêtre de trim minimum (anti-flap) ; défaut une fois sur 50 écritures. */
  trimEveryNWrites?: number;
  /** Hook erreur pour observability tests. */
  onError?: (e: unknown) => void;
}

export class SqliteLogSink implements LogSink {
  private readonly persistLevels: Set<SyncLogLevel>;
  private readonly maxRows: number;
  private readonly trimEveryN: number;
  private writeCounter = 0;
  /**
   * Sérialise insertions et trims dans l’ordre d’appel via une chaîne de
   * promesses. Garantit que :
   *   - tous les inserts sont vus dans l’ordre d’invocation par le moteur SQL ;
   *   - chaque trim ne s’exécute qu’après l’insert qui l’a déclenché ;
   *   - le DERNIER trim a une vue complète de l’état final (pas de course).
   */
  private chain: Promise<void> = Promise.resolve();

  constructor(
    private readonly db: DbHandle,
    private readonly opts: SqliteLogSinkOptions = {},
  ) {
    const levels = opts.persistLevels ?? ['warn', 'error'];
    this.persistLevels = new Set(levels);
    /** Plancher 1 pour rester testable ; en prod, garder >= 1000 idéalement. */
    this.maxRows = Math.max(1, opts.maxRows ?? 5000);
    this.trimEveryN = Math.max(1, opts.trimEveryNWrites ?? 50);
  }

  write(entry: SyncLogEntry): void {
    if (!this.persistLevels.has(entry.level)) return;
    /** Chaîne fire-and-forget : `LogSink.write` est synchrone par contrat. */
    this.chain = this.chain.then(() => this.insertOne(entry)).then(() => this.maybeTrim());
  }

  private async insertOne(entry: SyncLogEntry): Promise<void> {
    try {
      await this.db.runAsync(
        `INSERT INTO sync_log (ts, level, event, entity, entity_id, detail) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          entry.ts,
          entry.level,
          entry.event,
          entry.entity ?? null,
          entry.entity_id ?? null,
          entry.detail ? serializeJson(entry.detail) : null,
        ],
      );
    } catch (e) {
      this.opts.onError?.(e);
    }
  }

  private async maybeTrim(): Promise<void> {
    this.writeCounter++;
    if (this.writeCounter % this.trimEveryN !== 0) return;
    await this.trimNow();
  }

  private async trimNow(): Promise<void> {
    try {
      const row = await this.db.getFirstAsync<{ n: number }>(
        `SELECT COUNT(*) AS n FROM sync_log`,
      );
      const total = row?.n ?? 0;
      const excess = total - this.maxRows;
      if (excess <= 0) return;
      /** Supprime les `excess` plus anciens (id auto-incrémenté = ordre d’insertion). */
      await this.db.runAsync(
        `DELETE FROM sync_log WHERE id IN (SELECT id FROM sync_log ORDER BY id ASC LIMIT ?)`,
        [excess],
      );
    } catch (e) {
      this.opts.onError?.(e);
    }
  }

  /**
   * Attend que toutes les écritures (et trims) déclenchés jusqu’à présent soient
   * persistés. Utile pour les tests et pour l’écran Diagnostic qui voudrait
   * forcer un flush avant lecture.
   */
  async flush(): Promise<void> {
    await this.chain;
  }
}

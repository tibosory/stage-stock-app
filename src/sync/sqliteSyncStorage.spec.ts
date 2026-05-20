import assert from 'node:assert/strict';
import {
  SqliteOutboxStorage,
  SqliteCursorStore,
  SqliteLogSink,
  type DbHandle,
  type DbValue,
  type SyncOutboxEntry,
  type SyncCursor,
} from './sqliteSyncStorage';

/**
 * Tests d’intégration S2.2 — adapters SQLite du moteur de sync.
 *
 * Stratégie : FakeSqlite minimaliste qui interprète les SQL spécifiques
 * générés par les 3 adapters. C’est un test de **contrat** : le moteur
 * `@caractere/sync-engine` exige des invariants (FIFO, idempotence, ordre)
 * que les adapters doivent respecter quelle que soit la base SQLite réelle
 * sous-jacente. Pattern miroir de FakeLoanDb (loan-db.integration.spec.ts).
 */

// ─── FakeSqlite ──────────────────────────────────────────────────────────────

type Row = Record<string, DbValue>;

class FakeSqlite implements DbHandle {
  outbox: Map<string, Row> = new Map();
  cursor: Map<string, Row> = new Map();
  log: Row[] = [];
  logIdSeq = 0;

  /** Capture pour assertions sur les SQL générés. */
  calls: Array<{ sql: string; params: ReadonlyArray<DbValue> }> = [];

  async runAsync(sql: string, params: ReadonlyArray<DbValue> = []): Promise<unknown> {
    this.calls.push({ sql, params });
    const normalized = sql.replace(/\s+/g, ' ').trim();

    if (normalized.startsWith('INSERT OR REPLACE INTO sync_outbox')) {
      const [id, entity, entity_id, kind, payload, base_version, created_at, attempts, last_error, next_attempt_at, status] = params;
      this.outbox.set(String(id), {
        id, entity, entity_id, kind, payload, base_version, created_at, attempts, last_error, next_attempt_at, status,
      });
      return;
    }

    if (normalized.startsWith('DELETE FROM sync_outbox WHERE id IN')) {
      for (const p of params) this.outbox.delete(String(p));
      return;
    }

    if (normalized.startsWith('INSERT OR REPLACE INTO sync_cursor')) {
      const [entity, last_pulled_at, etag, record_count, updated_at] = params;
      this.cursor.set(String(entity), { entity, last_pulled_at, etag, record_count, updated_at });
      return;
    }

    if (normalized.startsWith('INSERT INTO sync_log')) {
      const [ts, level, event, entity, entity_id, detail] = params;
      this.logIdSeq++;
      this.log.push({ id: this.logIdSeq, ts, level, event, entity, entity_id, detail });
      return;
    }

    if (normalized.startsWith('DELETE FROM sync_log WHERE id IN')) {
      /** Notre adapter génère `id IN (SELECT id FROM sync_log ORDER BY id ASC LIMIT ?)`.
       *  On simule : prend les N plus anciens et les supprime. */
      const limit = Number(params[0] ?? 0);
      this.log.sort((a, b) => Number(a.id) - Number(b.id));
      const toRemove = new Set(this.log.slice(0, limit).map((r) => r.id));
      this.log = this.log.filter((r) => !toRemove.has(r.id));
      return;
    }

    throw new Error(`FakeSqlite.runAsync: SQL non géré → ${normalized}`);
  }

  async getFirstAsync<T>(sql: string, params: ReadonlyArray<DbValue> = []): Promise<T | null> {
    this.calls.push({ sql, params });
    const normalized = sql.replace(/\s+/g, ' ').trim();

    if (normalized.startsWith('SELECT entity, last_pulled_at, etag, record_count, updated_at FROM sync_cursor')) {
      const row = this.cursor.get(String(params[0]));
      return (row ?? null) as T | null;
    }

    if (normalized.startsWith('SELECT COUNT(*) AS n FROM sync_outbox')) {
      const rows = this.selectOutbox(normalized, params);
      return { n: rows.length } as unknown as T;
    }

    if (normalized.startsWith('SELECT COUNT(*) AS n FROM sync_log')) {
      return { n: this.log.length } as unknown as T;
    }

    throw new Error(`FakeSqlite.getFirstAsync: SQL non géré → ${normalized}`);
  }

  async getAllAsync<T>(sql: string, params: ReadonlyArray<DbValue> = []): Promise<T[]> {
    this.calls.push({ sql, params });
    const normalized = sql.replace(/\s+/g, ' ').trim();
    if (normalized.startsWith('SELECT id, entity, entity_id, kind, payload')) {
      return this.selectOutbox(normalized, params) as unknown as T[];
    }
    throw new Error(`FakeSqlite.getAllAsync: SQL non géré → ${normalized}`);
  }

  /** Interprète les WHERE / ORDER BY / LIMIT que produit SqliteOutboxStorage. */
  private selectOutbox(normalized: string, params: ReadonlyArray<DbValue>): Row[] {
    let rows = [...this.outbox.values()];
    /** WHERE status IN (?, ?, ...) [ AND (next_attempt_at IS NULL OR next_attempt_at <= ?) ] */
    let pIdx = 0;
    const statusInMatch = normalized.match(/status IN \(([?,\s]+)\)/);
    if (statusInMatch) {
      const placeholders = statusInMatch[1]!.split(',').map((s) => s.trim()).filter((s) => s === '?');
      const wanted = new Set<string>();
      for (let i = 0; i < placeholders.length; i++) {
        wanted.add(String(params[pIdx++]));
      }
      rows = rows.filter((r) => wanted.has(String(r.status)));
    }
    if (normalized.includes('next_attempt_at IS NULL OR next_attempt_at <= ?')) {
      const due = String(params[pIdx++]);
      rows = rows.filter((r) => r.next_attempt_at === null || String(r.next_attempt_at) <= due);
    }
    /** ORDER BY created_at ASC, id ASC */
    if (normalized.includes('ORDER BY created_at ASC')) {
      rows.sort((a, b) => {
        const ca = String(a.created_at);
        const cb = String(b.created_at);
        if (ca !== cb) return ca < cb ? -1 : 1;
        return String(a.id) < String(b.id) ? -1 : 1;
      });
    }
    /** LIMIT ? */
    if (normalized.includes('LIMIT ?')) {
      const limit = Number(params[pIdx++] ?? 0);
      if (limit > 0) rows = rows.slice(0, limit);
    }
    return rows;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<SyncOutboxEntry> = {}): SyncOutboxEntry {
  return {
    id: 'op-1',
    entity: 'materiel',
    entity_id: 'mat-1',
    kind: 'update',
    payload: { nom: 'Test' },
    base_version: null,
    created_at: '2026-05-11T10:00:00.000Z',
    attempts: 0,
    last_error: null,
    next_attempt_at: null,
    status: 'pending',
    ...overrides,
  };
}

// ─── OutboxStorage tests ─────────────────────────────────────────────────────

async function case_outbox_upsertAndList() {
  const db = new FakeSqlite();
  const storage = new SqliteOutboxStorage(db);
  await storage.upsert([
    makeEntry({ id: 'a', created_at: '2026-05-11T10:00:00.000Z' }),
    makeEntry({ id: 'b', created_at: '2026-05-11T10:01:00.000Z', entity: 'pret' }),
  ]);
  const rows = await storage.list({});
  assert.equal(rows.length, 2);
  assert.equal(rows[0]!.id, 'a');
  assert.equal(rows[1]!.id, 'b');
  console.log('  ✓ upsert + list : 2 lignes persistées');
}

async function case_outbox_listOrderFIFO_byCreatedAt() {
  const db = new FakeSqlite();
  const storage = new SqliteOutboxStorage(db);
  /** Insertion désordonnée mais lecture FIFO par created_at. */
  await storage.upsert([
    makeEntry({ id: 'z', created_at: '2026-05-11T10:05:00.000Z' }),
    makeEntry({ id: 'a', created_at: '2026-05-11T10:01:00.000Z' }),
    makeEntry({ id: 'm', created_at: '2026-05-11T10:03:00.000Z' }),
  ]);
  const rows = await storage.list({});
  assert.deepEqual(
    rows.map((r) => r.id),
    ['a', 'm', 'z'],
    'ordre FIFO par created_at',
  );
  console.log('  ✓ list FIFO par created_at (ASC)');
}

async function case_outbox_listFilterStatusSingle() {
  const db = new FakeSqlite();
  const storage = new SqliteOutboxStorage(db);
  await storage.upsert([
    makeEntry({ id: 'a', status: 'pending' }),
    makeEntry({ id: 'b', status: 'inflight' }),
    makeEntry({ id: 'c', status: 'pending' }),
  ]);
  const pending = await storage.list({ status: 'pending' });
  assert.equal(pending.length, 2);
  assert.ok(pending.every((r) => r.status === 'pending'));
  console.log('  ✓ list filtré status="pending" → 2 lignes');
}

async function case_outbox_listFilterStatusArray() {
  const db = new FakeSqlite();
  const storage = new SqliteOutboxStorage(db);
  await storage.upsert([
    makeEntry({ id: 'a', status: 'pending' }),
    makeEntry({ id: 'b', status: 'inflight' }),
    makeEntry({ id: 'c', status: 'failed' }),
    makeEntry({ id: 'd', status: 'done' }),
  ]);
  const eligible = await storage.list({ status: ['pending', 'failed'] });
  assert.equal(eligible.length, 2);
  assert.deepEqual(eligible.map((r) => r.id).sort(), ['a', 'c']);
  console.log('  ✓ list filtré status=[pending,failed] → 2 lignes');
}

async function case_outbox_listFilterDueAt() {
  const db = new FakeSqlite();
  const storage = new SqliteOutboxStorage(db);
  await storage.upsert([
    makeEntry({ id: 'now', next_attempt_at: null }),
    makeEntry({ id: 'past', next_attempt_at: '2026-05-11T10:00:00.000Z' }),
    makeEntry({ id: 'future', next_attempt_at: '2026-05-11T12:00:00.000Z' }),
  ]);
  const due = await storage.list({ dueAtOrBefore: '2026-05-11T10:30:00.000Z' });
  /** `now` (null) et `past` éligibles ; `future` non. */
  assert.equal(due.length, 2);
  assert.deepEqual(due.map((r) => r.id).sort(), ['now', 'past']);
  console.log('  ✓ list filtré dueAtOrBefore → null OR <=now');
}

async function case_outbox_listLimit() {
  const db = new FakeSqlite();
  const storage = new SqliteOutboxStorage(db);
  for (let i = 0; i < 10; i++) {
    await storage.upsert([
      makeEntry({ id: `e${i}`, created_at: `2026-05-11T10:0${i}:00.000Z` }),
    ]);
  }
  const top3 = await storage.list({ limit: 3 });
  assert.equal(top3.length, 3);
  assert.deepEqual(top3.map((r) => r.id), ['e0', 'e1', 'e2']);
  console.log('  ✓ list limit=3 → 3 plus anciens');
}

async function case_outbox_upsertIsIdempotent() {
  const db = new FakeSqlite();
  const storage = new SqliteOutboxStorage(db);
  await storage.upsert([makeEntry({ id: 'op', status: 'pending' })]);
  await storage.upsert([makeEntry({ id: 'op', status: 'inflight', attempts: 1 })]);
  const rows = await storage.list({});
  assert.equal(rows.length, 1, 'pas de duplication sur même id');
  assert.equal(rows[0]!.status, 'inflight');
  assert.equal(rows[0]!.attempts, 1);
  console.log('  ✓ upsert idempotent : même id → update en place');
}

async function case_outbox_payloadRoundtripJSON() {
  const db = new FakeSqlite();
  const storage = new SqliteOutboxStorage(db);
  const payload = { nom: 'Régie 1', categorie: 'son', tags: ['a', 'b'], qty: 3 };
  await storage.upsert([makeEntry({ id: 'json', payload })]);
  const rows = await storage.list({});
  assert.deepEqual(rows[0]!.payload, payload, 'payload round-trip JSON');
  console.log('  ✓ payload sérialisé puis désérialisé fidèlement');
}

async function case_outbox_remove() {
  const db = new FakeSqlite();
  const storage = new SqliteOutboxStorage(db);
  await storage.upsert([
    makeEntry({ id: 'a' }),
    makeEntry({ id: 'b' }),
    makeEntry({ id: 'c' }),
  ]);
  await storage.remove(['a', 'c']);
  const rows = await storage.list({});
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.id, 'b');
  console.log('  ✓ remove([a,c]) → ne reste que b');
}

async function case_outbox_removeEmptyArray_noop() {
  const db = new FakeSqlite();
  const storage = new SqliteOutboxStorage(db);
  await storage.upsert([makeEntry({ id: 'a' })]);
  const callsBefore = db.calls.length;
  await storage.remove([]);
  assert.equal(db.calls.length, callsBefore, 'remove([]) → aucun SQL');
  console.log('  ✓ remove([]) no-op : pas de SQL inutile');
}

async function case_outbox_upsertEmptyArray_noop() {
  const db = new FakeSqlite();
  const storage = new SqliteOutboxStorage(db);
  await storage.upsert([]);
  assert.equal(db.calls.length, 0, 'upsert([]) → aucun SQL');
  console.log('  ✓ upsert([]) no-op : pas de SQL inutile');
}

async function case_outbox_count() {
  const db = new FakeSqlite();
  const storage = new SqliteOutboxStorage(db);
  await storage.upsert([
    makeEntry({ id: 'a', status: 'pending' }),
    makeEntry({ id: 'b', status: 'pending' }),
    makeEntry({ id: 'c', status: 'inflight' }),
  ]);
  assert.equal(await storage.count({}), 3);
  assert.equal(await storage.count({ status: 'pending' }), 2);
  assert.equal(await storage.count({ status: ['pending', 'inflight'] }), 3);
  console.log('  ✓ count : total + filtré');
}

async function case_outbox_baseVersionPreserved() {
  const db = new FakeSqlite();
  const storage = new SqliteOutboxStorage(db);
  await storage.upsert([makeEntry({ id: 'a', base_version: '2026-05-10T09:00:00.000Z' })]);
  const rows = await storage.list({});
  assert.equal(rows[0]!.base_version, '2026-05-10T09:00:00.000Z');
  console.log('  ✓ base_version persiste (conflit optimiste OK)');
}

// ─── CursorStore tests ───────────────────────────────────────────────────────

async function case_cursor_getMissing_null() {
  const db = new FakeSqlite();
  const store = new SqliteCursorStore(db);
  assert.equal(await store.get('materiel'), null);
  console.log('  ✓ cursor.get sur entité inconnue → null');
}

async function case_cursor_setAndGet() {
  const db = new FakeSqlite();
  const store = new SqliteCursorStore(db);
  const cursor: SyncCursor = {
    entity: 'materiel',
    last_pulled_at: '2026-05-11T09:00:00.000Z',
    etag: 'W/"abc123"',
    record_count: 42,
    updated_at: '2026-05-11T09:01:00.000Z',
  };
  await store.set(cursor);
  const out = await store.get('materiel');
  assert.deepEqual(out, cursor);
  console.log('  ✓ cursor.set puis get → fidèle');
}

async function case_cursor_overwrite() {
  const db = new FakeSqlite();
  const store = new SqliteCursorStore(db);
  await store.set({
    entity: 'pret',
    last_pulled_at: '2026-05-11T08:00:00.000Z',
    etag: 'v1',
    record_count: 1,
    updated_at: '2026-05-11T08:00:00.000Z',
  });
  await store.set({
    entity: 'pret',
    last_pulled_at: '2026-05-11T09:00:00.000Z',
    etag: 'v2',
    record_count: 5,
    updated_at: '2026-05-11T09:00:00.000Z',
  });
  const c = await store.get('pret');
  assert.equal(c?.etag, 'v2');
  assert.equal(c?.record_count, 5);
  console.log('  ✓ cursor.set deuxième fois → upsert en place');
}

// ─── LogSink tests ───────────────────────────────────────────────────────────

async function case_log_persistsWarnAndErrorByDefault() {
  const db = new FakeSqlite();
  const sink = new SqliteLogSink(db);
  sink.write({ ts: '2026-05-11T10:00:00.000Z', level: 'debug', event: 'noise' });
  sink.write({ ts: '2026-05-11T10:00:01.000Z', level: 'info', event: 'noise' });
  sink.write({ ts: '2026-05-11T10:00:02.000Z', level: 'warn', event: 'attention' });
  sink.write({ ts: '2026-05-11T10:00:03.000Z', level: 'error', event: 'boom' });
  await sink.flush();
  assert.equal(db.log.length, 2, 'seuls warn et error persistés');
  assert.deepEqual(db.log.map((r) => r.event), ['attention', 'boom']);
  console.log('  ✓ log : par défaut, seuls warn+error en DB');
}

async function case_log_customLevels() {
  const db = new FakeSqlite();
  const sink = new SqliteLogSink(db, { persistLevels: ['error'] });
  sink.write({ ts: 't', level: 'warn', event: 'skipped' });
  sink.write({ ts: 't', level: 'error', event: 'kept' });
  await sink.flush();
  assert.equal(db.log.length, 1);
  assert.equal(db.log[0]!.event, 'kept');
  console.log('  ✓ log : persistLevels custom respecté');
}

async function case_log_detailJsonRoundtrip() {
  const db = new FakeSqlite();
  const sink = new SqliteLogSink(db);
  sink.write({
    ts: '2026-05-11T10:00:00.000Z',
    level: 'error',
    event: 'push.failed',
    entity: 'materiel',
    entity_id: 'mat-42',
    detail: { reason: 'stale_base_version', attempts: 3 },
  });
  await sink.flush();
  assert.equal(db.log.length, 1);
  const row = db.log[0]!;
  assert.equal(row.entity, 'materiel');
  assert.equal(row.entity_id, 'mat-42');
  const parsed = JSON.parse(String(row.detail));
  assert.deepEqual(parsed, { reason: 'stale_base_version', attempts: 3 });
  console.log('  ✓ log : detail sérialisé en JSON fidèle');
}

async function case_log_trimExcessOldest() {
  const db = new FakeSqlite();
  const sink = new SqliteLogSink(db, { maxRows: 5, trimEveryNWrites: 1 });
  for (let i = 0; i < 12; i++) {
    sink.write({ ts: `2026-05-11T10:00:${String(i).padStart(2, '0')}Z`, level: 'warn', event: `e${i}` });
  }
  await sink.flush();
  assert.equal(db.log.length, 5, `trim doit borner à maxRows (actuel=${db.log.length})`);
  const events = db.log.map((r) => r.event);
  assert.ok(events.includes('e11'), 'le plus récent doit survivre');
  assert.ok(!events.includes('e0'), 'le plus ancien doit être supprimé');
  console.log('  ✓ log : trim FIFO quand maxRows dépassé');
}

async function case_log_serializedInsertionOrder() {
  /** Important : les inserts doivent être sérialisés, sinon le trim FIFO casse. */
  const db = new FakeSqlite();
  const sink = new SqliteLogSink(db);
  for (let i = 0; i < 5; i++) {
    sink.write({ ts: `t${i}`, level: 'warn', event: `e${i}` });
  }
  await sink.flush();
  assert.deepEqual(
    db.log.map((r) => r.event),
    ['e0', 'e1', 'e2', 'e3', 'e4'],
    'ordre d’insertion préservé',
  );
  console.log('  ✓ log : ordre d’insertion sérialisé (write1 < write2 < …)');
}

async function case_log_errorHookInvokedOnFailure() {
  const errors: unknown[] = [];
  const db: DbHandle = {
    async runAsync() {
      throw new Error('DB down');
    },
    async getFirstAsync() {
      return null;
    },
    async getAllAsync() {
      return [];
    },
  };
  const sink = new SqliteLogSink(db, { onError: (e) => errors.push(e) });
  sink.write({ ts: 't', level: 'error', event: 'critical' });
  await sink.flush();
  assert.equal(errors.length, 1, 'onError appelé exactement 1 fois');
  console.log('  ✓ log : DB qui jette → onError invoqué, pas de crash');
}

// ─── Runner ──────────────────────────────────────────────────────────────────

async function run() {
  console.log('sqlite-sync-storage.spec — S2.2');
  await case_outbox_upsertAndList();
  await case_outbox_listOrderFIFO_byCreatedAt();
  await case_outbox_listFilterStatusSingle();
  await case_outbox_listFilterStatusArray();
  await case_outbox_listFilterDueAt();
  await case_outbox_listLimit();
  await case_outbox_upsertIsIdempotent();
  await case_outbox_payloadRoundtripJSON();
  await case_outbox_remove();
  await case_outbox_removeEmptyArray_noop();
  await case_outbox_upsertEmptyArray_noop();
  await case_outbox_count();
  await case_outbox_baseVersionPreserved();
  await case_cursor_getMissing_null();
  await case_cursor_setAndGet();
  await case_cursor_overwrite();
  await case_log_persistsWarnAndErrorByDefault();
  await case_log_customLevels();
  await case_log_detailJsonRoundtrip();
  await case_log_trimExcessOldest();
  await case_log_serializedInsertionOrder();
  await case_log_errorHookInvokedOnFailure();
  console.log('sqlite-sync-storage.spec: OK (22/22)');
}

run().catch((e) => {
  console.error('sqlite-sync-storage.spec: FAIL', e);
  process.exit(1);
});

import * as Crypto from 'expo-crypto';
import { getDB } from './coreDb';
import {
  buildStockFlightcaseQrFromId,
  normalizeFlightcaseName,
  type ParsedStockFlightcaseQr,
  type StockFlightcaseKey,
} from '../lib/stockFlightcase';

type StockFlightcaseRow = {
  id: string;
  localisation_id: string | null;
  label: string;
  label_norm: string;
  qr_code: string;
  synced: number;
};

function rowToRecord(row: StockFlightcaseRow): StockFlightcaseRecord {
  return {
    id: row.id,
    localisation_id: row.localisation_id,
    label: row.label,
    label_norm: row.label_norm,
    qr_code: row.qr_code,
    synced: !!row.synced,
  };
}

type Db = Awaited<ReturnType<typeof getDB>>;

export type StockFlightcaseRecord = {
  id: string;
  localisation_id: string | null;
  label: string;
  label_norm: string;
  qr_code: string;
  synced: boolean;
};

async function computeStockFlightcaseId(
  localisationId: string | null,
  flightcase: string
): Promise<string> {
  const payload = `${localisationId?.trim() || '_'}|${normalizeFlightcaseName(flightcase)}`;
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, payload);
  return `fc_${hash.slice(0, 16)}`;
}

export async function ensureStockFlightcase(
  localisationId: string | null,
  flightcase: string,
  database?: Db
): Promise<StockFlightcaseRecord> {
  const db = database ?? (await getDB());
  const label = flightcase.trim();
  if (!label) throw new Error('Flightcase requis');
  const labelNorm = normalizeFlightcaseName(label);
  const loc = localisationId?.trim() || null;
  const id = await computeStockFlightcaseId(loc, label);
  const qr_code = buildStockFlightcaseQrFromId(id);

  const existing = await db.getFirstAsync<StockFlightcaseRow>(
    'SELECT * FROM stock_flightcases WHERE id = ?',
    [id]
  );
  if (existing) {
    if (existing.label !== label || (existing.localisation_id ?? null) !== loc) {
      await db.runAsync(
        `UPDATE stock_flightcases SET label = ?, label_norm = ?, localisation_id = ?, qr_code = ?, synced = 0
         WHERE id = ?`,
        [label, labelNorm, loc, qr_code, id]
      );
    }
    return { ...rowToRecord(existing), label, label_norm: labelNorm, localisation_id: loc, qr_code };
  }

  await db.runAsync(
    `INSERT INTO stock_flightcases (id, localisation_id, label, label_norm, qr_code, synced)
     VALUES (?, ?, ?, ?, ?, 0)`,
    [id, loc, label, labelNorm, qr_code]
  );
  return { id, localisation_id: loc, label, label_norm: labelNorm, qr_code, synced: false };
}

export async function ensureStockFlightcaseQr(
  key: StockFlightcaseKey,
  database?: Db
): Promise<string> {
  const row = await ensureStockFlightcase(key.localisationId, key.flightcase, database);
  return row.qr_code;
}

export async function getStockFlightcaseById(
  id: string,
  database?: Db
): Promise<StockFlightcaseRecord | null> {
  const db = database ?? (await getDB());
  const row = await db.getFirstAsync<StockFlightcaseRow>(
    'SELECT * FROM stock_flightcases WHERE id = ?',
    [id.trim()]
  );
  return row ? rowToRecord(row) : null;
}

export async function resolveStockFlightcaseScan(
  parsed: ParsedStockFlightcaseQr,
  database?: Db
): Promise<StockFlightcaseKey & { id: string; qrCode: string } | null> {
  if (parsed.kind === 'legacy') {
    const row = await ensureStockFlightcase(parsed.localisationId, parsed.flightcase, database);
    return {
      id: row.id,
      localisationId: row.localisation_id,
      flightcase: row.label,
      qrCode: row.qr_code,
    };
  }
  const row = await getStockFlightcaseById(parsed.id, database);
  if (row) {
    return {
      id: row.id,
      localisationId: row.localisation_id,
      flightcase: row.label,
      qrCode: row.qr_code,
    };
  }
  return null;
}

/** Crée les entrées flightcase pour les fiches matériel déjà renseignées. */
export async function backfillStockFlightcasesFromMateriels(database?: Db): Promise<void> {
  const db = database ?? (await getDB());
  const rows = await db.getAllAsync<{ localisation_id: string | null; flightcase: string }>(`
    SELECT DISTINCT localisation_id, flightcase FROM materiels
    WHERE flightcase IS NOT NULL AND trim(flightcase) != ''
  `);
  for (const r of rows) {
    await ensureStockFlightcase(r.localisation_id, r.flightcase, db);
  }
}

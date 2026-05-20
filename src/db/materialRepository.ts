import { getConsommables, getMateriel } from './database';
import { localCache } from './localCache';
import type { Consommable, Materiel } from '../types';

export type InventorySnapshot = {
  materiels: Materiel[];
  consommables: Consommable[];
  fetchedAt: number;
};

const SNAPSHOT_CACHE_KEY = 'inventory_snapshot_v1';
/** Évite lectures SQLite doubles entre écrans ; invalidé après chaque écriture. */
const SNAPSHOT_TTL_MS = 15_000;

/**
 * Source de vérité côté app pour la recherche locale.
 * Offline-first: lecture SQLite + cache mémoire court.
 */
export async function getInventorySnapshot(force = false): Promise<InventorySnapshot> {
  if (!force) {
    const cached = localCache.get<InventorySnapshot>(SNAPSHOT_CACHE_KEY);
    if (cached) return cached;
  }
  const [materiels, consommables] = await Promise.all([getMateriel(), getConsommables()]);
  const value: InventorySnapshot = { materiels, consommables, fetchedAt: Date.now() };
  localCache.set(SNAPSHOT_CACHE_KEY, value, SNAPSHOT_TTL_MS);
  return value;
}

export function invalidateInventorySnapshotCache(): void {
  localCache.invalidate(SNAPSHOT_CACHE_KEY);
}

export async function getMaterielsCached(force = false): Promise<Materiel[]> {
  const snap = await getInventorySnapshot(force);
  return snap.materiels;
}

export async function getConsommablesCached(force = false): Promise<Consommable[]> {
  const snap = await getInventorySnapshot(force);
  return snap.consommables;
}

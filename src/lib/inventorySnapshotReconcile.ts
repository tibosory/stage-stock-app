/**
 * Réconciliation inventaire après pull snapshot (sans dépendance React Native).
 */
export type InventorySnapshotSlice = {
  materiels?: Record<string, unknown>[];
  consommables?: Record<string, unknown>[];
};

export type InventoryReconcileDb = {
  runAsync(sql: string, params?: readonly unknown[]): Promise<unknown>;
  getAllAsync<T>(sql: string, params?: readonly unknown[]): Promise<T[]>;
};

async function loadUnsyncedLocalIds(
  database: InventoryReconcileDb,
  table: 'materiels' | 'consommables'
): Promise<Set<string>> {
  const rows = await database.getAllAsync<{ id: string }>(`SELECT id FROM ${table} WHERE synced = 0`);
  return new Set(rows.map(r => String(r.id)));
}

/** Supprime les dépendances SQLite avant DELETE materiel (évite FOREIGN KEY constraint failed). */
async function deleteMaterielDependents(database: InventoryReconcileDb, materielId: string): Promise<void> {
  await database.runAsync('DELETE FROM pret_materiels WHERE materiel_id = ?', [materielId]);
  await database.runAsync('DELETE FROM materiel_emprunt_historique WHERE materiel_id = ?', [materielId]);
  await database.runAsync('DELETE FROM material_assignments WHERE material_id = ?', [materielId]);
  await database.runAsync('DELETE FROM activity_logs WHERE material_id = ?', [materielId]);
  await database.runAsync('UPDATE positions SET materiel_id = NULL WHERE materiel_id = ?', [materielId]);
}

/** Supprime localement le stock déjà synchronisé absent du snapshot serveur (sauf lignes locales non envoyées). */
export async function reconcileInventoryFromSnapshot(
  database: InventoryReconcileDb,
  snap: InventorySnapshotSlice
): Promise<void> {
  const remoteMatList = (snap.materiels ?? []).filter((m): m is Record<string, unknown> => Boolean(m?.id));
  const remoteConsoList = (snap.consommables ?? []).filter((c): c is Record<string, unknown> => Boolean(c?.id));

  /**
   * Snapshot serveur vide (ex. reset vierge) : ne pas effacer l’inventaire téléphone.
   * L’utilisateur doit d’abord Envoyer ↑ pour remplir le PC.
   */
  if (remoteMatList.length === 0 && remoteConsoList.length === 0) {
    return;
  }

  const remoteMatIds = new Set(remoteMatList.map(m => String(m.id)));
  const remoteConsoIds = new Set(remoteConsoList.map(c => String(c.id)));
  const unsyncedMats = await loadUnsyncedLocalIds(database, 'materiels');
  const unsyncedConsos = await loadUnsyncedLocalIds(database, 'consommables');

  const localMats = await database.getAllAsync<{ id: string; synced: number }>(
    'SELECT id, synced FROM materiels'
  );
  for (const row of localMats) {
    const rowId = String(row.id);
    if (unsyncedMats.has(rowId)) continue;
    if (remoteMatIds.has(rowId)) continue;
    if ((row.synced ?? 0) === 0) continue;
    await deleteMaterielDependents(database, rowId);
    await database.runAsync('DELETE FROM materiels WHERE id = ?', [rowId]);
  }

  const localConsos = await database.getAllAsync<{ id: string; synced: number }>(
    'SELECT id, synced FROM consommables'
  );
  for (const row of localConsos) {
    const rowId = String(row.id);
    if (unsyncedConsos.has(rowId)) continue;
    if (remoteConsoIds.has(rowId)) continue;
    if ((row.synced ?? 0) === 0) continue;
    await database.runAsync('DELETE FROM mouvements_stock WHERE consommable_id = ?', [rowId]);
    await database.runAsync('DELETE FROM consommables WHERE id = ?', [rowId]);
  }
}

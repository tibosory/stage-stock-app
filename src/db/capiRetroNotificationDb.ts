export type CapiRetroNotification = {
  id: string;
  capiActionId: string;
  spectacleId: string;
  spectacleTitre: string;
  actionLibelle: string;
  dateEcheance: string | null;
  joursRestants: number | null;
  niveau: 'retard' | 'urgent' | 'proche' | string;
  pole: string | null;
  saisonLibelle: string | null;
};

function mapRow(r: Record<string, unknown>): CapiRetroNotification {
  return {
    id: String(r.id),
    capiActionId: String(r.capi_action_id ?? r.id),
    spectacleId: String(r.spectacle_id),
    spectacleTitre: String(r.spectacle_titre ?? ''),
    actionLibelle: String(r.action_libelle),
    dateEcheance: r.date_echeance != null ? String(r.date_echeance) : null,
    joursRestants:
      r.jours_restants != null && r.jours_restants !== ''
        ? Number(r.jours_restants)
        : null,
    niveau: String(r.niveau),
    pole: r.pole != null ? String(r.pole) : null,
    saisonLibelle: r.saison_libelle != null ? String(r.saison_libelle) : null,
  };
}

function niveauOrder(n: string): number {
  if (n === 'retard') return 0;
  if (n === 'urgent') return 1;
  if (n === 'proche') return 2;
  return 3;
}

export async function listCapiRetroNotifications(): Promise<CapiRetroNotification[]> {
  const { getDB } = await import('./database');
  const db = await getDB();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM capi_retro_notifications',
  );
  return rows
    .map(mapRow)
    .sort((a, b) => {
      const o = niveauOrder(a.niveau) - niveauOrder(b.niveau);
      if (o !== 0) return o;
      return (a.dateEcheance ?? '9999').localeCompare(b.dateEcheance ?? '9999');
    });
}

export async function replaceCapiRetroNotifications(
  rows: Record<string, unknown>[],
): Promise<void> {
  const { getDB } = await import('./database');
  const db = await getDB();
  await db.runAsync('DELETE FROM capi_retro_notifications');
  const nowIso = new Date().toISOString();
  for (const r of rows) {
    const id = String(r.id ?? r.capi_action_id ?? '');
    if (!id || !r.spectacle_id || !r.action_libelle || !r.niveau) continue;
    await db.runAsync(
      `INSERT OR REPLACE INTO capi_retro_notifications (
        id, capi_action_id, spectacle_id, spectacle_titre, action_libelle,
        date_echeance, jours_restants, niveau, pole, saison_libelle, created_at, updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id,
        String(r.capi_action_id ?? id),
        String(r.spectacle_id),
        r.spectacle_titre != null ? String(r.spectacle_titre) : null,
        String(r.action_libelle),
        r.date_echeance != null ? String(r.date_echeance) : null,
        r.jours_restants != null && r.jours_restants !== '' ? Number(r.jours_restants) : null,
        String(r.niveau),
        r.pole != null ? String(r.pole) : null,
        r.saison_libelle != null ? String(r.saison_libelle) : null,
        r.created_at != null ? String(r.created_at) : nowIso,
        r.updated_at != null ? String(r.updated_at) : nowIso,
      ],
    );
  }
}

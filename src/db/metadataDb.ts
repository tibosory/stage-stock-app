import type { AlerteEmail, Beneficiaire } from '../types';
import { generateId, getDB } from './database';
import { applyBeneficiairePatch, coerceDashboardStats, normalizeOptionalText } from './metadataDbQuery';

export async function getBeneficiaires(): Promise<Beneficiaire[]> {
  const database = await getDB();
  return database.getAllAsync<Beneficiaire>(
    'SELECT * FROM beneficiaires ORDER BY nom COLLATE NOCASE ASC'
  );
}

export async function insertBeneficiaire(data: {
  nom: string;
  organisation?: string | null;
  telephone?: string | null;
  email?: string | null;
}): Promise<string> {
  const database = await getDB();
  const id = generateId();
  const now = new Date().toISOString();
  await database.runAsync(
    `INSERT INTO beneficiaires (id, nom, organisation, telephone, email, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.nom.trim(),
      normalizeOptionalText(data.organisation),
      normalizeOptionalText(data.telephone),
      normalizeOptionalText(data.email),
      now,
      now,
    ]
  );
  return id;
}

export async function updateBeneficiaire(
  id: string,
  patch: { nom?: string; organisation?: string | null; telephone?: string | null; email?: string | null }
): Promise<void> {
  const database = await getDB();
  const row = await database.getFirstAsync<Beneficiaire>('SELECT * FROM beneficiaires WHERE id = ?', [id]);
  if (!row) throw new Error('Bénéficiaire introuvable');
  const merged = applyBeneficiairePatch(row, patch);
  const now = new Date().toISOString();
  await database.runAsync(
    `UPDATE beneficiaires SET nom = ?, organisation = ?, telephone = ?, email = ?, updated_at = ? WHERE id = ?`,
    [merged.nom, merged.organisation ?? null, merged.telephone ?? null, merged.email ?? null, now, id]
  );
}

export async function deleteBeneficiaire(id: string): Promise<void> {
  const database = await getDB();
  await database.runAsync('DELETE FROM beneficiaires WHERE id = ?', [id]);
}

export async function getAlertesEmail(): Promise<AlerteEmail[]> {
  const database = await getDB();
  return database.getAllAsync<AlerteEmail>('SELECT * FROM alertes_email ORDER BY email ASC');
}

export async function insertAlerteEmail(data: { nom?: string; email: string; role?: string }): Promise<string> {
  const database = await getDB();
  const id = generateId();
  await database.runAsync(
    'INSERT OR REPLACE INTO alertes_email (id, nom, email, role) VALUES (?, ?, ?, ?)',
    [id, data.nom ?? null, data.email, data.role ?? null]
  );
  return id;
}

export async function deleteAlerteEmail(id: string): Promise<void> {
  const database = await getDB();
  await database.runAsync('DELETE FROM alertes_email WHERE id = ?', [id]);
}

export async function getStats(): Promise<{
  totalMateriels: number;
  enPret: number;
  pretsEnCours: number;
  alertesConsommables: number;
}> {
  const database = await getDB();
  const totalMat = await database.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM materiels');
  const enPret = await database.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM materiels WHERE statut = 'en prêt'");
  const pretsCours = await database.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM prets WHERE statut = 'en cours'");
  const alertesConso = await database.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM consommables WHERE stock_actuel <= seuil_minimum');

  return coerceDashboardStats({
    totalMateriels: totalMat?.count ?? 0,
    enPret: enPret?.count ?? 0,
    pretsEnCours: pretsCours?.count ?? 0,
    alertesConsommables: alertesConso?.count ?? 0,
  });
}

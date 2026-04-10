import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { getMateriel, getConsommables, getPrets, getDB, generateId } from '../db/database';

function csvEscape(cell: string | number | null | undefined): string {
  const s = cell == null ? '' : String(cell);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows: Record<string, unknown>[], headers: string[]): string {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map(h => csvEscape(row[h] as any)).join(','));
  }
  return lines.join('\n');
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur = '';
  let row: string[] = [];
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = false;
      } else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') {
        row.push(cur);
        cur = '';
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cur);
        if (row.some(x => x.length)) rows.push(row);
        row = [];
        cur = '';
      } else cur += c;
    }
  }
  row.push(cur);
  if (row.some(x => x.length)) rows.push(row);
  return rows;
}

function cachePath(name: string): string {
  const base = FileSystem.cacheDirectory;
  if (!base) throw new Error('Répertoire cache indisponible');
  return `${base}${name}`;
}

export async function exportMaterielsCsv(): Promise<void> {
  const mats = await getMateriel();
  const headers = [
    'id', 'nom', 'type', 'marque', 'numero_serie', 'etat', 'statut',
    'date_achat', 'date_validite', 'prochain_controle', 'intervalle_controle_jours',
    'qr_code', 'technicien', 'categorie_id', 'localisation_id',
  ];
  const csv = toCsv(mats as any, headers);
  const path = cachePath('materiels_export.csv');
  await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path, { mimeType: 'text/csv' });
}

export async function exportConsommablesCsv(): Promise<void> {
  const items = await getConsommables();
  const headers = [
    'id', 'nom', 'reference', 'unite', 'stock_actuel', 'seuil_minimum',
    'fournisseur', 'qr_code', 'categorie_id', 'localisation_id',
  ];
  const csv = toCsv(items as any, headers);
  const path = cachePath('consommables_export.csv');
  await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path, { mimeType: 'text/csv' });
}

export async function exportPretsCsv(): Promise<void> {
  const prets = await getPrets();
  const headers = [
    'id', 'numero_feuille', 'statut', 'emprunteur', 'organisation', 'telephone', 'email',
    'date_depart', 'retour_prevu', 'retour_reel', 'valeur_estimee', 'commentaire',
  ];
  const csv = toCsv(prets as any, headers);
  const path = cachePath('prets_export.csv');
  await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path, { mimeType: 'text/csv' });
}

export async function importMaterielsFromCsv(): Promise<{ ok: number; err: string | null }> {
  const pick = await DocumentPicker.getDocumentAsync({
    type: ['text/*', 'text/csv', 'text/comma-separated-values'],
    copyToCacheDirectory: true,
  });
  const uri =
    'canceled' in pick && pick.canceled
      ? null
      : (pick as { assets?: { uri: string }[] }).assets?.[0]?.uri ?? (pick as { uri?: string }).uri;
  if (!uri) return { ok: 0, err: 'Annulé' };
  const text = await FileSystem.readAsStringAsync(uri);
  const table = parseCsv(text.trim());
  if (table.length < 2) return { ok: 0, err: 'Fichier vide' };
  const header = table[0].map(h => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const database = await getDB();
  let ok = 0;
  for (let r = 1; r < table.length; r++) {
    const row = table[r];
    if (!row.length) continue;
    const g = (n: string) => row[idx(n)] ?? '';
    try {
      const id = g('id') || generateId();
      const now = new Date().toISOString();
      await database.runAsync(
        `INSERT OR REPLACE INTO materiels (
          id, nom, type, marque, numero_serie, poids_kg, categorie_id, localisation_id,
          etat, statut, date_achat, date_validite, prochain_controle, intervalle_controle_jours,
          technicien, qr_code, nfc_tag_id, photo_url, photo_local, created_at, updated_at, synced
        ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?, 0)`,
        [
          id,
          g('nom') || 'Sans nom',
          g('type') || null,
          g('marque') || null,
          g('numero_serie') || null,
          g('categorie_id') || null,
          g('localisation_id') || null,
          (g('etat') as any) || 'bon',
          (g('statut') as any) || 'en stock',
          g('date_achat') || null,
          g('date_validite') || null,
          g('prochain_controle') || null,
          g('intervalle_controle_jours') ? parseInt(g('intervalle_controle_jours'), 10) : null,
          g('technicien') || null,
          g('qr_code') || null,
          now,
          now,
        ]
      );
      ok++;
    } catch {
      /* ligne ignorée */
    }
  }
  return { ok, err: null };
}

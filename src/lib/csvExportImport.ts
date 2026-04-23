import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as XLSX from '@e965/xlsx';
import { parseISO, addDays, isValid, format, startOfDay } from 'date-fns';
import { getMateriel, getConsommables, getPrets, getDB, generateId } from '../db/database';
import type { Pret } from '../types';

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

function parseCsvBool(raw: string): boolean {
  const s = raw.trim().toLowerCase();
  if (!s) return false;
  if (s === '0' || s === 'false' || s === 'non' || s === 'no' || s === 'n') return false;
  return s === '1' || s === 'true' || s === 'oui' || s === 'yes' || s === 'o';
}

function parseOptionalInt(raw: string): number | null {
  if (!raw.trim()) return null;
  const n = parseInt(raw.trim(), 10);
  return Number.isFinite(n) ? n : null;
}

function parseOptionalFloat(raw: string): number | null {
  if (!raw.trim()) return null;
  const n = parseFloat(raw.trim().replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function hasCsvColumn(header: string[], name: string): boolean {
  return header.indexOf(name) >= 0;
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

/** Noms de feuille Excel : max 31 car., caractères interdits \ / ? * [ ] : */
function sanitizeSheetName(raw: string): string {
  let s = raw.replace(/[\[\]\\\/\?\*:]/g, '-').trim();
  if (!s) s = 'Feuille';
  return s.slice(0, 31);
}

function nextUniqueSheetName(base: string, used: Set<string>): string {
  let name = sanitizeSheetName(base);
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  let n = 2;
  while (n < 1000) {
    const suffix = ` (${n})`;
    const truncated = name.slice(0, Math.max(1, 31 - suffix.length)) + suffix;
    const candidate = truncated.slice(0, 31);
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
    n++;
  }
  const fallback = `S${Date.now()}`.slice(0, 31);
  used.add(fallback);
  return fallback;
}

function categoryLabel(item: { categorie_nom?: string | null }): string {
  const n = item.categorie_nom;
  if (n != null && String(n).trim()) return String(n).trim();
  return 'Sans catégorie';
}

function groupByCategory<T extends { categorie_nom?: string | null }>(
  items: T[]
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = categoryLabel(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return map;
}

function sortCategoryKeys(keys: string[]): string[] {
  const rest = keys.filter(k => k !== 'Sans catégorie').sort((a, b) => a.localeCompare(b, 'fr'));
  if (keys.includes('Sans catégorie')) rest.push('Sans catégorie');
  return rest;
}

function sheetFromObjects(headers: string[], rows: Record<string, unknown>[]): XLSX.WorkSheet {
  const aoa = [headers, ...rows.map(r => headers.map(h => r[h] ?? ''))];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  decorateWorksheet(ws, headers, rows, {
    numericColumns: new Set(['stock_actuel', 'seuil_minimum', 'poids_kg', 'intervalle_controle_jours', 'vgp_periodicite_jours']),
    currencyColumns: new Set(['prix_unitaire', 'valeur_estimee']),
  });
  return ws;
}

function toDisplayHeader(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\bid\b/gi, 'ID')
    .replace(/\bvgp\b/gi, 'VGP')
    .replace(/\bqr\b/gi, 'QR')
    .replace(/\bnfc\b/gi, 'NFC')
    .replace(/\bpdf\b/gi, 'PDF')
    .replace(/\burl\b/gi, 'URL')
    .replace(/(^|\s)\S/g, s => s.toUpperCase());
}

function estimateColumnWidth(header: string, rows: Record<string, unknown>[]): number {
  let max = toDisplayHeader(header).length;
  for (const r of rows.slice(0, 200)) {
    const v = r[header];
    const l = String(v ?? '').length;
    if (l > max) max = l;
  }
  return Math.max(10, Math.min(42, max + 2));
}

function setCellStyle(
  ws: XLSX.WorkSheet,
  r: number,
  c: number,
  style: Record<string, unknown>
): void {
  const addr = XLSX.utils.encode_cell({ r, c });
  const cell = ws[addr] as (XLSX.CellObject & { s?: Record<string, unknown> }) | undefined;
  if (!cell) return;
  cell.s = style;
}

function setCellFormat(
  ws: XLSX.WorkSheet,
  r: number,
  c: number,
  format: string
): void {
  const addr = XLSX.utils.encode_cell({ r, c });
  const cell = ws[addr] as XLSX.CellObject | undefined;
  if (!cell) return;
  (cell as XLSX.CellObject & { z?: string }).z = format;
}

function decorateWorksheet(
  ws: XLSX.WorkSheet,
  headers: string[],
  rows: Record<string, unknown>[],
  opts: { numericColumns: Set<string>; currencyColumns: Set<string> }
): void {
  const lastCol = Math.max(0, headers.length - 1);
  const lastRow = rows.length;
  const ref = `A1:${XLSX.utils.encode_cell({ r: lastRow, c: lastCol })}`;
  ws['!ref'] = ref;
  ws['!autofilter'] = { ref };
  ws['!cols'] = headers.map(h => ({ wch: estimateColumnWidth(h, rows) }));
  ws['!rows'] = [{ hpt: 22 }];
  (ws as XLSX.WorkSheet & { '!freeze'?: { xSplit: number; ySplit: number } })['!freeze'] = { xSplit: 0, ySplit: 1 };

  const headerStyle = {
    font: { bold: true, color: { rgb: '1F2937' } },
    fill: { patternType: 'solid', fgColor: { rgb: '9CA3AF' } },
    border: {
      top: { style: 'thin', color: { rgb: '6B7280' } },
      bottom: { style: 'thin', color: { rgb: '6B7280' } },
      left: { style: 'thin', color: { rgb: '6B7280' } },
      right: { style: 'thin', color: { rgb: '6B7280' } },
    },
    alignment: { vertical: 'center', horizontal: 'left', wrapText: true },
  };
  const rowOddStyle = {
    fill: { patternType: 'solid', fgColor: { rgb: 'FFFFFF' } },
    border: {
      top: { style: 'thin', color: { rgb: '9CA3AF' } },
      bottom: { style: 'thin', color: { rgb: '9CA3AF' } },
      left: { style: 'thin', color: { rgb: '9CA3AF' } },
      right: { style: 'thin', color: { rgb: '9CA3AF' } },
    },
    alignment: { vertical: 'top', horizontal: 'left', wrapText: true },
  };
  const rowEvenStyle = {
    ...rowOddStyle,
    fill: { patternType: 'solid', fgColor: { rgb: 'E5E7EB' } },
  };

  headers.forEach((h, c) => {
    const headAddr = XLSX.utils.encode_cell({ r: 0, c });
    const cell = ws[headAddr] as XLSX.CellObject | undefined;
    if (cell) cell.v = toDisplayHeader(h);
    setCellStyle(ws, 0, c, headerStyle);
  });

  for (let r = 1; r <= lastRow; r++) {
    const style = r % 2 === 0 ? rowEvenStyle : rowOddStyle;
    for (let c = 0; c <= lastCol; c++) {
      setCellStyle(ws, r, c, style);
      const key = headers[c];
      if (opts.currencyColumns.has(key)) {
        setCellFormat(ws, r, c, '#,##0.00 [$€-fr-FR]');
      } else if (opts.numericColumns.has(key)) {
        setCellFormat(ws, r, c, '#,##0.00');
      }
    }
  }
}

async function shareXlsx(wb: XLSX.WorkBook, filename: string): Promise<void> {
  const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  const path = cachePath(filename);
  await FileSystem.writeAsStringAsync(path, wbout, { encoding: FileSystem.EncodingType.Base64 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  }
}

/** Export Excel : une feuille par catéorie de matériel */
export async function exportMaterielsExcel(): Promise<void> {
  const mats = await getMateriel();
  const headers = [
    'id',
    'nom',
    'type',
    'marque',
    'numero_serie',
    'poids_kg',
    'etat',
    'statut',
    'date_achat',
    'date_validite',
    'prochain_controle',
    'intervalle_controle_jours',
    'qr_code',
    'nfc_tag_id',
    'technicien',
    'categorie_id',
    'categorie_nom',
    'localisation_id',
    'localisation_nom',
    'photo_url',
    'photo_local',
    'notice_pdf_local',
    'notice_photo_local',
    'notice_pdf_url',
    'notice_photo_url',
    'vgp_actif',
    'vgp_periodicite_jours',
    'vgp_derniere_visite',
    'vgp_libelle',
    'vgp_epi',
    'gel_brand',
    'gel_code',
    'gel_instead_of_photo',
  ];
  const wb = XLSX.utils.book_new();
  const usedNames = new Set<string>();
  const groups = groupByCategory(mats as any[]);
  const keys = sortCategoryKeys([...groups.keys()]);
  if (keys.length === 0) {
    const ws = sheetFromObjects(headers, []);
    XLSX.utils.book_append_sheet(wb, ws, nextUniqueSheetName('Matériels', usedNames));
  } else {
    for (const cat of keys) {
      const rows = groups.get(cat) ?? [];
      const data = rows.map(r => {
        const o: Record<string, unknown> = {};
        for (const h of headers) o[h] = (r as any)[h] ?? '';
        return o;
      });
      const ws = sheetFromObjects(headers, data);
      const sheetName = nextUniqueSheetName(cat, usedNames);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }
  }
  await shareXlsx(wb, 'materiels_export.xlsx');
}

/** Export Excel : une feuille par catégorie de consommable */
export async function exportConsommablesExcel(): Promise<void> {
  const items = await getConsommables();
  const headers = [
    'id',
    'nom',
    'reference',
    'unite',
    'stock_actuel',
    'seuil_minimum',
    'fournisseur',
    'prix_unitaire',
    'qr_code',
    'categorie_id',
    'categorie_nom',
    'localisation_id',
    'localisation_nom',
    'photo_local',
    'photo_url',
    'gel_brand',
    'gel_code',
    'gel_instead_of_photo',
  ];
  const wb = XLSX.utils.book_new();
  const usedNames = new Set<string>();
  const groups = groupByCategory(items as any[]);
  const keys = sortCategoryKeys([...groups.keys()]);
  if (keys.length === 0) {
    const ws = sheetFromObjects(headers, []);
    XLSX.utils.book_append_sheet(wb, ws, nextUniqueSheetName('Consommables', usedNames));
  } else {
    for (const cat of keys) {
      const rows = groups.get(cat) ?? [];
      const data = rows.map(r => {
        const o: Record<string, unknown> = {};
        for (const h of headers) o[h] = (r as any)[h] ?? '';
        return o;
      });
      const ws = sheetFromObjects(headers, data);
      XLSX.utils.book_append_sheet(wb, ws, nextUniqueSheetName(cat, usedNames));
    }
  }
  await shareXlsx(wb, 'consommables_export.xlsx');
}

function icsEscapeText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\n|\r/g, '\\n');
}

function foldIcsLine(line: string): string {
  if (line.length <= 72) return line;
  let out = line.slice(0, 72);
  let rest = line.slice(72);
  while (rest.length) {
    out += `\r\n ${rest.slice(0, 71)}`;
    rest = rest.slice(71);
  }
  return out;
}

/** Jour calendaire (sans décalage fuseau) pour date_depart / retour_prevu stockées en ISO ou YYYY-MM-DD. */
function parsePretDateLocal(s: string | undefined): Date | null {
  if (!s) return null;
  const d = s.includes('T') ? parseISO(s) : parseISO(`${s}T12:00:00`);
  return isValid(d) ? startOfDay(d) : null;
}

/** DTSTART (inclus) et DTEND (exclus) au format VALUE=DATE pour Google / Outlook. */
function pretAllDayRange(p: Pret): { start: string; endExclusive: string } {
  const dep = parsePretDateLocal(p.date_depart);
  const s0 = dep ?? startOfDay(new Date());
  let lastInclusive = p.retour_prevu ? parsePretDateLocal(p.retour_prevu) : null;
  if (!lastInclusive) lastInclusive = s0;
  if (lastInclusive.getTime() < s0.getTime()) lastInclusive = s0;
  return {
    start: format(s0, 'yyyyMMdd'),
    endExclusive: format(addDays(lastInclusive, 1), 'yyyyMMdd'),
  };
}

/** Export calendrier (.ics) pour Outlook / Google Calendar — une entrée par prêt (hors annulés). */
export async function exportPretsIcs(): Promise<void> {
  const prets = await getPrets();
  const included = prets.filter(p => p.statut !== 'annulé');
  if (!included.length) {
    throw new Error('Aucun prêt à exporter (tous annulés ou liste vide).');
  }
  const now = new Date();
  const stamp = format(now, "yyyyMMdd'T'HHmmss'Z'");
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//StageStock//Prets//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscapeText('Stage Stock — Prêts')}`,
  ];
  for (const p of included) {
    const { start, endExclusive } = pretAllDayRange(p);
    const title = `Prêt ${p.numero_feuille ? `#${p.numero_feuille}` : ''} — ${p.emprunteur}`.trim();
    const descParts = [
      `Statut: ${p.statut}`,
      p.organisation ? `Organisation: ${p.organisation}` : '',
      p.telephone ? `Tél: ${p.telephone}` : '',
      p.email ? `Email: ${p.email}` : '',
      p.commentaire ? `Commentaire: ${p.commentaire}` : '',
    ].filter(Boolean);
    const uid = `${p.id}@stage-stock.local`;
    lines.push('BEGIN:VEVENT');
    lines.push(foldIcsLine(`UID:${uid}`));
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART;VALUE=DATE:${start}`);
    lines.push(`DTEND;VALUE=DATE:${endExclusive}`);
    lines.push(foldIcsLine(`SUMMARY:${icsEscapeText(title)}`));
    lines.push(foldIcsLine(`DESCRIPTION:${icsEscapeText(descParts.join('\\n'))}`));
    if (p.organisation) lines.push(foldIcsLine(`LOCATION:${icsEscapeText(p.organisation)}`));
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  const ics = lines.join('\r\n') + '\r\n';
  const path = cachePath('prets_stagestock.ics');
  await FileSystem.writeAsStringAsync(path, ics, { encoding: FileSystem.EncodingType.UTF8 });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(path, {
      mimeType: 'text/calendar',
      UTI: 'public.calendar-event',
      dialogTitle: 'Exporter les prêts (.ics)',
    });
  }
}

export async function exportMaterielsCsv(): Promise<void> {
  const mats = await getMateriel();
  const headers = [
    'id',
    'nom',
    'type',
    'marque',
    'numero_serie',
    'poids_kg',
    'etat',
    'statut',
    'date_achat',
    'date_validite',
    'prochain_controle',
    'intervalle_controle_jours',
    'qr_code',
    'nfc_tag_id',
    'technicien',
    'categorie_id',
    'localisation_id',
    'photo_url',
    'photo_local',
    'notice_pdf_local',
    'notice_photo_local',
    'notice_pdf_url',
    'notice_photo_url',
    'vgp_actif',
    'vgp_periodicite_jours',
    'vgp_derniere_visite',
    'vgp_libelle',
    'vgp_epi',
    'gel_brand',
    'gel_code',
    'gel_instead_of_photo',
  ];
  const csv = toCsv(mats as any, headers);
  const path = cachePath('materiels_export.csv');
  await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path, { mimeType: 'text/csv' });
}

export async function exportConsommablesCsv(): Promise<void> {
  const items = await getConsommables();
  const headers = [
    'id',
    'nom',
    'reference',
    'unite',
    'stock_actuel',
    'seuil_minimum',
    'fournisseur',
    'qr_code',
    'categorie_id',
    'localisation_id',
    'photo_local',
    'photo_url',
    'gel_brand',
    'gel_code',
    'gel_instead_of_photo',
  ];
  const csv = toCsv(items as any, headers);
  const path = cachePath('consommables_export.csv');
  await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path, { mimeType: 'text/csv' });
}

export async function exportPretsCsv(): Promise<void> {
  const prets = await getPrets();
  const headers = [
    'id',
    'numero_feuille',
    'statut',
    'emprunteur',
    'organisation',
    'telephone',
    'email',
    'date_depart',
    'retour_prevu',
    'retour_reel',
    'valeur_estimee',
    'commentaire',
    'rappel_jours_avant',
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
  const has = (n: string) => hasCsvColumn(header, n);
  const database = await getDB();
  let ok = 0;
  for (let r = 1; r < table.length; r++) {
    const row = table[r];
    if (!row.length) continue;
    const g = (n: string) => (idx(n) >= 0 ? row[idx(n)] ?? '' : '');
    try {
      const id = g('id') || generateId();
      const now = new Date().toISOString();
      const existing = await database.getFirstAsync<any>(
        `SELECT created_at, poids_kg, nfc_tag_id, photo_url, photo_local,
          notice_pdf_local, notice_photo_local, notice_pdf_url, notice_photo_url,
          vgp_actif, vgp_periodicite_jours, vgp_derniere_visite, vgp_libelle, vgp_epi,
          gel_brand, gel_code, gel_instead_of_photo,
          prochain_controle, intervalle_controle_jours
         FROM materiels WHERE id = ?`,
        [id]
      );
      const emptyToNull = (s: string) => (s.trim() ? s.trim() : null);
      const poids_kg = has('poids_kg')
        ? parseOptionalFloat(g('poids_kg'))
        : (existing?.poids_kg ?? null);
      const nfc_tag_id = has('nfc_tag_id') ? emptyToNull(g('nfc_tag_id')) : (existing?.nfc_tag_id ?? null);
      const photo_url = has('photo_url') ? emptyToNull(g('photo_url')) : (existing?.photo_url ?? null);
      const photo_local = has('photo_local') ? emptyToNull(g('photo_local')) : (existing?.photo_local ?? null);
      const notice_pdf_local = has('notice_pdf_local')
        ? emptyToNull(g('notice_pdf_local'))
        : (existing?.notice_pdf_local ?? null);
      const notice_photo_local = has('notice_photo_local')
        ? emptyToNull(g('notice_photo_local'))
        : (existing?.notice_photo_local ?? null);
      const notice_pdf_url = has('notice_pdf_url')
        ? emptyToNull(g('notice_pdf_url'))
        : (existing?.notice_pdf_url ?? null);
      const notice_photo_url = has('notice_photo_url')
        ? emptyToNull(g('notice_photo_url'))
        : (existing?.notice_photo_url ?? null);
      const vgp_actif = has('vgp_actif')
        ? (parseCsvBool(g('vgp_actif')) ? 1 : 0)
        : (existing?.vgp_actif ? 1 : 0);
      const vgp_periodicite_jours = has('vgp_periodicite_jours')
        ? parseOptionalInt(g('vgp_periodicite_jours'))
        : (existing?.vgp_periodicite_jours ?? null);
      const vgp_derniere_visite = has('vgp_derniere_visite')
        ? emptyToNull(g('vgp_derniere_visite'))
        : (existing?.vgp_derniere_visite ?? null);
      const vgp_libelle = has('vgp_libelle') ? emptyToNull(g('vgp_libelle')) : (existing?.vgp_libelle ?? null);
      const vgp_epi = has('vgp_epi')
        ? (parseCsvBool(g('vgp_epi')) ? 1 : 0)
        : (existing?.vgp_epi ? 1 : 0);
      const gel_brand = has('gel_brand') ? emptyToNull(g('gel_brand')) : (existing?.gel_brand ?? null);
      const gel_code = has('gel_code') ? emptyToNull(g('gel_code')) : (existing?.gel_code ?? null);
      const gel_instead_of_photo = has('gel_instead_of_photo')
        ? (parseCsvBool(g('gel_instead_of_photo')) ? 1 : 0)
        : (existing?.gel_instead_of_photo ? 1 : 0);
      const prochain_controle = has('prochain_controle')
        ? emptyToNull(g('prochain_controle'))
        : (existing?.prochain_controle ?? null);
      const intervalle_controle_jours = has('intervalle_controle_jours')
        ? parseOptionalInt(g('intervalle_controle_jours'))
        : (existing?.intervalle_controle_jours ?? null);
      const created_at = existing?.created_at ?? now;

      await database.runAsync(
        `INSERT OR REPLACE INTO materiels (
          id, nom, type, marque, numero_serie, poids_kg, categorie_id, localisation_id,
          etat, statut, date_achat, date_validite, prochain_controle, intervalle_controle_jours,
          technicien, qr_code, nfc_tag_id, photo_url, photo_local,
          notice_pdf_local, notice_photo_local, notice_pdf_url, notice_photo_url,
          vgp_actif, vgp_periodicite_jours, vgp_derniere_visite, vgp_libelle, vgp_epi,
          gel_brand, gel_code, gel_instead_of_photo,
          created_at, updated_at, synced
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [
          id,
          g('nom') || 'Sans nom',
          g('type') || null,
          g('marque') || null,
          g('numero_serie') || null,
          poids_kg,
          g('categorie_id') || null,
          g('localisation_id') || null,
          (g('etat') as any) || 'bon',
          (g('statut') as any) || 'en stock',
          g('date_achat') || null,
          g('date_validite') || null,
          prochain_controle,
          intervalle_controle_jours,
          g('technicien') || null,
          g('qr_code') || null,
          nfc_tag_id,
          photo_url,
          photo_local,
          notice_pdf_local,
          notice_photo_local,
          notice_pdf_url,
          notice_photo_url,
          vgp_actif,
          vgp_periodicite_jours,
          vgp_derniere_visite,
          vgp_libelle,
          vgp_epi,
          gel_brand,
          gel_code,
          gel_instead_of_photo,
          created_at,
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

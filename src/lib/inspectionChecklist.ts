/**
 * Checklists et listes fermées Accueil Pro — champs utilisés aussi par les écrans EDL (OK/KO/NA).
 */
import type { ApInspectionControlPoint, ApInspectionPointKind, InspectionVerifications } from '../types/accueilPro';

export type VerifItem = { key: string; label: string };

/** Points de contrôle checklist — clés snake_case comme en JSON persisté (aligné ROOM_INSPECTION_CHECKS). */
export const VERIF_ITEMS: readonly VerifItem[] = [
  { key: 'proprete', label: 'Propreté générale' },
  { key: 'sols', label: 'État des sols' },
  { key: 'murs', label: 'Murs et équipements muraux' },
  { key: 'plafonds', label: 'Plafonds et éclairages encastrés' },
  { key: 'eclairage', label: 'Éclairage d’ensemble (secours inclus)' },
  { key: 'prises', label: 'Prises électriques et départs câbles' },
  { key: 'issues_secours', label: 'Issues de secours dégagées' },
  { key: 'extincteurs', label: 'Équipements incendie visibles et accessibles' },
  { key: 'porte_coupe_feu', label: 'Portes coupe-feu / fermetures' },
  { key: 'sanitaires', label: 'Parties sanitaires et réseaux' },
  { key: 'stockage', label: 'Zones de stockage / charges' },
  { key: 'acces_pmr', label: 'Chemins PMR utilisés' },
  { key: 'securite_generale', label: 'Remarques sécurité / chantier résiduel' },
] as const;

export type RoomInspectionCheckDefinition = {
  id: string;
  label: string;
  /** Sous-texte d’aide courte (optionnel). */
  description: string;
  kind?: ApInspectionPointKind;
};

export type { ApInspectionControlPoint, ApInspectionPointKind };

export const ROOM_INSPECTION_CHECKS: readonly RoomInspectionCheckDefinition[] = VERIF_ITEMS.map(it => ({
  id: it.key,
  label: it.label,
  description: '',
  kind: 'control' as const,
}));

function slugifyCheckId(label: string): string {
  const base = label
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return base || `point_${Date.now()}`;
}

export function parseControlPointsJson(raw: unknown): ApInspectionControlPoint[] {
  const arr = parseJson<unknown[]>(raw, []);
  if (!Array.isArray(arr)) return [];
  const out: ApInspectionControlPoint[] = [];
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const label = String(r.label ?? '').trim();
    if (!label) continue;
    const kind = r.kind === 'vigilance' ? 'vigilance' : 'control';
    const id = String(r.id ?? slugifyCheckId(label)).trim() || slugifyCheckId(label);
    out.push({
      id,
      label,
      description: r.description != null ? String(r.description) : null,
      kind,
    });
  }
  return out;
}

export function serializeControlPointsJson(points: ApInspectionControlPoint[]): string {
  return JSON.stringify(points ?? []);
}

/** Checklist effective pour un EDL : points de l’espace, sinon modèle standard. */
export function resolveInspectionChecksForSpace(
  space: { control_points?: ApInspectionControlPoint[] | null } | null | undefined
): RoomInspectionCheckDefinition[] {
  const custom = space?.control_points ?? [];
  if (custom.length > 0) {
    return custom.map(p => ({
      id: p.id,
      label: p.label,
      description: p.description?.trim() ?? '',
      kind: p.kind,
    }));
  }
  return [...ROOM_INSPECTION_CHECKS];
}

export function defaultControlPointsFromStandard(): ApInspectionControlPoint[] {
  return ROOM_INSPECTION_CHECKS.map(c => ({
    id: c.id,
    label: c.label,
    description: c.description || null,
    kind: 'control' as const,
  }));
}

export function makeControlPointId(label: string, existing: ApInspectionControlPoint[]): string {
  let id = slugifyCheckId(label);
  const used = new Set(existing.map(p => p.id));
  let n = 2;
  while (used.has(id)) {
    id = `${slugifyCheckId(label)}_${n}`;
    n += 1;
  }
  return id;
}

function parseJson<T>(raw: unknown, fb: T): T {
  if (raw == null) return fb;
  if (typeof raw === 'object') return raw as T;
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    return fb;
  }
}

export function serializeVerifications(v: InspectionVerifications): string {
  return JSON.stringify(v ?? {});
}

export function parseVerificationsJson(raw: unknown): InspectionVerifications {
  const o = parseJson<Record<string, string>>(raw, {});
  const out: InspectionVerifications = {};
  for (const [k, val] of Object.entries(o)) {
    if (val === 'ok' || val === 'ko' || val === 'na') out[k] = val;
  }
  return out;
}

export function serializePhotos(paths: string[]): string {
  return JSON.stringify(paths ?? []);
}

export function parsePhotosJson(raw: unknown): string[] {
  return parseJson<string[]>(raw, []);
}

/** Types ERP (affichage fiche lieu). */
export const ERP_TYPES = [
  { value: 'type_l', label: 'ERP — Type L (spectacles)' },
  { value: 'type_n', label: 'ERP — Type N (restauration)' },
  { value: 'type_o', label: 'ERP — Type O (hôtellerie)' },
  { value: 'type_m', label: 'ERP — Type M (commerce / foires)' },
  { value: 'type_r', label: 'ERP — Type R (enseignement, culte)' },
  { value: 'type_v', label: 'ERP — Type V (expositions, musées)' },
  { value: 'type_w', label: 'ERP — Type W (administration, santé)' },
  { value: 'type_u', label: 'ERP — Type U (autres usages)' },
  { value: 'igh', label: 'IGH — Immeuble de grande hauteur' },
  { value: 'autre', label: 'Autre / non défini' },
] as const;

export const ERP_CATS = [
  { value: '1ere', label: '1re catégorie' },
  { value: '2eme', label: '2e catégorie' },
  { value: '3eme', label: '3e catégorie' },
  { value: '4eme', label: '4e catégorie' },
  { value: '5eme', label: '5e catégorie' },
  { value: 'non_classe', label: 'Non classé sur la fiche' },
] as const;

export const EVENT_TYPES = [
  'spectacle',
  'réunion',
  'tournée',
  'installation',
  'location',
  'atelier',
  'autre',
] as const;
export type ApEventCategory = (typeof EVENT_TYPES)[number];

export const ESPACE_TYPES = [
  'salle_polyvalente',
  'plateau_scene',
  'foyer_public',
  'loge',
  'salle_repetition',
  'espace_circulation',
  'stockage_technique',
  'sanitaires_reserve',
  'coursive',
  'exterieur',
  'autre',
] as const;
export type ApSpaceCategory = (typeof ESPACE_TYPES)[number];

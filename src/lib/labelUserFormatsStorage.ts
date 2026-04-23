import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'stagestock_user_label_formats_v1';

export type LabelFormatKind = 'qr' | 'shelf';

export type UserLabelFormat = {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  /** 0 = marge minimale, 100 = marge max (10 % de la largeur max) */
  marginPercent: number;
  /** Identifiant parmi `LABEL_FONT_CHOICES` */
  fontId: string;
  /** Couleur texte #RRGGBB */
  textColor: string;
  bold: boolean;
  kind: LabelFormatKind;
};

function newId(): string {
  return `ulf_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function clamp(n: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, n));
}

export const LABEL_DIM_LIMITS = {
  minW: 12,
  maxW: 500,
  minH: 8,
  maxH: 500,
} as const;

export function normalizeUserLabelFormat(
  f: UserLabelFormat
): UserLabelFormat {
  return {
    ...f,
    name: f.name.trim().slice(0, 60) || 'Sans nom',
    widthMm: clamp(f.widthMm, LABEL_DIM_LIMITS.minW, LABEL_DIM_LIMITS.maxW),
    heightMm: clamp(f.heightMm, LABEL_DIM_LIMITS.minH, LABEL_DIM_LIMITS.maxH),
    marginPercent: clamp(f.marginPercent, 0, 100),
    textColor: normalizeHex(f.textColor) ?? '#111111',
  };
}

function normalizeHex(s: string): string | null {
  const t = s.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(t)) return t;
  if (/^[0-9A-Fa-f]{6}$/.test(t)) return `#${t}`;
  return null;
}

function parseStored(raw: string | null): UserLabelFormat[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter(isUserLabelFormat).map(normalizeUserLabelFormat);
  } catch {
    return [];
  }
}

function isUserLabelFormat(x: unknown): x is UserLabelFormat {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.name === 'string' &&
    typeof o.widthMm === 'number' &&
    typeof o.heightMm === 'number' &&
    typeof o.marginPercent === 'number' &&
    typeof o.fontId === 'string' &&
    typeof o.textColor === 'string' &&
    typeof o.bold === 'boolean' &&
    (o.kind === 'qr' || o.kind === 'shelf')
  );
}

export async function loadUserLabelFormats(): Promise<UserLabelFormat[]> {
  const raw = await AsyncStorage.getItem(KEY);
  return parseStored(raw);
}

export async function saveUserLabelFormats(
  list: UserLabelFormat[]
): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}

export async function upsertUserLabelFormat(
  f: UserLabelFormat
): Promise<UserLabelFormat[]> {
  const list = await loadUserLabelFormats();
  const i = list.findIndex(x => x.id === f.id);
  const n = normalizeUserLabelFormat(f);
  if (i >= 0) list[i] = n;
  else list.push(n);
  await saveUserLabelFormats(list);
  return list;
}

export async function removeUserLabelFormat(
  id: string
): Promise<UserLabelFormat[]> {
  const list = (await loadUserLabelFormats()).filter(x => x.id !== id);
  await saveUserLabelFormats(list);
  return list;
}

export function createDraftFormat(kind: LabelFormatKind): UserLabelFormat {
  return {
    id: newId(),
    name: 'Nouveau format',
    widthMm: 100,
    heightMm: 50,
    marginPercent: 50,
    fontId: 'inter',
    textColor: '#111111',
    bold: true,
    kind,
  };
}

export function getFormatsByKind(
  all: UserLabelFormat[],
  kind: LabelFormatKind
): UserLabelFormat[] {
  return all.filter(f => f.kind === kind);
}

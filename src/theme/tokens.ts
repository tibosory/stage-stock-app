/**
 * Design tokens — source unique pour le rendu visuel (Lot 1 du PLATFORM_BLUEPRINT).
 *
 * Règle d’or : on nomme par **sens** (`accent.primary`, `surface.elevated`), pas par **valeur**
 * (`green`, `dark2`). Ainsi un changement de palette ne casse plus le code applicatif.
 *
 * Les anciens imports `Colors.*` continuent de fonctionner — ils sont dérivés des tokens
 * dans `./colors.ts` (rétro-compat 1:1, mêmes valeurs hexadécimales). Toute migration
 * vers les tokens se fait progressivement, fichier par fichier.
 */

const PALETTE = {
  black0: '#09090B',
  black1: '#0C0C0F',
  black2: '#121214',
  black3: '#141416',
  black4: '#16161A',
  black5: '#1A1A1E',
  borderHairline: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(255, 255, 255, 0.12)',
  borderSubtle: 'rgba(255, 255, 255, 0.06)',
  inputBorder: '#2A2A30',
  emerald400: '#34D399',
  emerald600: '#059669',
  emerald400Soft14: 'rgba(52, 211, 153, 0.14)',
  emerald400Soft10: 'rgba(52, 211, 153, 0.1)',
  emerald400Soft18: 'rgba(52, 211, 153, 0.18)',
  emerald400Glow: 'rgba(52, 211, 153, 0.35)',
  red400: '#F87171',
  red400Soft12: 'rgba(248, 113, 113, 0.12)',
  amber400: '#FBBF24',
  amber400Soft12: 'rgba(251, 191, 36, 0.12)',
  blue400: '#60A5FA',
  blue400Soft12: 'rgba(96, 165, 250, 0.12)',
  zinc50: '#FAFAFA',
  zinc100: '#F4F4F5',
  zinc400: '#A1A1AA',
  zinc500: '#71717A',
  zinc700: '#3F3F46',
} as const;

export const surface = {
  base: PALETTE.black0,
  raised: PALETTE.black3,
  card: PALETTE.black5,
  cardAlt: PALETTE.black4,
  input: PALETTE.black2,
  dock: PALETTE.black1,
} as const;

export const border = {
  hairline: PALETTE.borderHairline,
  strong: PALETTE.borderStrong,
  subtle: PALETTE.borderSubtle,
  input: PALETTE.inputBorder,
} as const;

export const text = {
  primary: PALETTE.zinc100,
  secondary: PALETTE.zinc400,
  muted: PALETTE.zinc500,
  onAccent: PALETTE.zinc50,
} as const;

export const accent = {
  primary: PALETTE.emerald400,
  primaryStrong: PALETTE.emerald600,
  primarySoft: PALETTE.emerald400Soft14,
  primarySurface: PALETTE.emerald400Soft10,
  primaryGlow: PALETTE.emerald400Glow,
  primaryActiveBg: PALETTE.emerald400Soft18,

  danger: PALETTE.red400,
  dangerSurface: PALETTE.red400Soft12,
  warn: PALETTE.amber400,
  warnSurface: PALETTE.amber400Soft12,
  info: PALETTE.blue400,
  infoSurface: PALETTE.blue400Soft12,
} as const;

export const status = {
  /** État matériel : opérationnel. */
  ok: PALETTE.emerald400,
  /** État matériel : usé / vigilance. */
  watch: PALETTE.amber400,
  /** État matériel : hors service. */
  critical: PALETTE.red400,
  /** Statut prêt : disponible / neutre. */
  neutral: PALETTE.zinc700,
  /** Statut prêt : sorti. */
  inUse: PALETTE.red400,
  /** Statut prêt : en réparation. */
  repair: PALETTE.amber400,
} as const;

export const alert = {
  high: PALETTE.red400,
  medium: PALETTE.amber400,
} as const;

export const tab = {
  background: PALETTE.black1,
  itemActive: PALETTE.emerald400,
  itemInactive: PALETTE.zinc500,
  itemActiveBg: PALETTE.emerald400Soft18,
} as const;

/**
 * Échelle d’espacement en multiples de 4 px. Les libellés `xs/sm/md/...` restent
 * supportés via le module `spacing.ts` pour rétro-compat ; les nouveaux composants
 * utilisent `spaceScale[N]` directement.
 */
export const spaceScale = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 32,
  8: 40,
} as const;

export const radius = {
  sm: 10,
  md: 12,
  lg: 14,
  card: 16,
  xl: 20,
  pill: 999,
} as const;

export const motion = {
  fast: 120,
  base: 200,
  slow: 320,
} as const;

export const elevation = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 3,
  },
  primaryGlow: {
    shadowColor: PALETTE.emerald400,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  dock: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
} as const;

export const touch = {
  /** Cible tactile minimale (Material : 48 dp ; Apple HIG : 44 pt). */
  minTarget: 48,
  /** Zone tactile étendue pour icônes compactes. */
  hitSlop: { top: 12, bottom: 12, left: 12, right: 12 },
} as const;

/**
 * Palette module **Accueil Pro** (indigo / or / crème) — exposée via `AccueilProColors` dans `colors.ts`.
 */
export const moduleAccueilPro = {
  navy: '#1A2744',
  gold: '#C8973A',
  cream: '#F7F4EE',
  card: '#FFFFFF',
  surfaceMuted: '#F0EDE5',
  textPrimary: '#1A2744',
  textSecondary: 'rgba(26, 39, 68, 0.68)',
  textMuted: 'rgba(26, 39, 68, 0.45)',
  borderSubtle: 'rgba(26, 39, 68, 0.12)',

  statusConfirme: '#2E7D5A',
  statusBrouillon: '#C8973A',
  statusAnnule: '#B54A45',
  statusEnCours: '#4068E0',
  statusTermine: '#5A6778',
  statusSigné: '#1A2744',

  eventSpectacle: '#6B4C9A',
  eventConcert: '#B84C7A',
  eventRéunion: '#4068E0',
  eventFormation: '#2E7D5A',
  eventConférence: '#C8973A',
  eventSéminaire: '#8B5E3C',
  eventMariage: '#C8973A',
  eventLocation: '#C8973A',
  eventAutre: '#5A6778',
  primary: '#4068E0',

  /** Cible tactile recommandée sur le terrain (gants, debout). */
  touchMin: 52,
  radiusLg: 14,
  radiusMd: 12,
} as const;

export type ModuleAccueilProPalette = typeof moduleAccueilPro;

/** Agrégat lisible (utile pour exposer un objet unique aux thèmes futurs). */
export const tokens = {
  surface,
  border,
  text,
  accent,
  status,
  alert,
  tab,
  space: spaceScale,
  radius,
  motion,
  elevation,
  touch,
  moduleAccueilPro,
} as const;

export type Tokens = typeof tokens;

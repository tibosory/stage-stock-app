// src/theme/colors.ts
/**
 * Alias rétro-compat des tokens sémantiques (cf. `./tokens.ts`).
 *
 * Cette surface `Colors`/`Shadow` est conservée telle quelle pour le code existant.
 * Les nouveaux composants doivent importer depuis `./tokens` (`surface`, `accent`, …)
 * — voir `docs/DESIGN_SYSTEM.md`. Aucune valeur ne change ici : les comparaisons
 * pixel-par-pixel restent vraies, seules les sources d’indirection diffèrent.
 */
import { accent, alert, border, elevation, status, surface, tab, text } from './tokens';

export const Colors = {
  bg: surface.base,
  bgElevated: surface.raised,
  bgCard: surface.card,
  bgCardAlt: surface.cardAlt,
  bgInput: surface.input,
  bgInputBorder: border.input,

  /** Accent principal (actions, liens actifs, succès). */
  green: accent.primary,
  greenDark: accent.primaryStrong,
  greenMuted: accent.primarySoft,
  greenBg: accent.primarySurface,
  tabIconActiveBg: tab.itemActiveBg,

  red: accent.danger,
  redBg: accent.dangerSurface,

  yellow: accent.warn,
  yellowBg: accent.warnSurface,

  blue: accent.info,
  blueBg: accent.infoSurface,

  white: text.onAccent,
  textPrimary: text.primary,
  textSecondary: text.secondary,
  textMuted: text.muted,

  border: border.hairline,
  borderStrong: border.strong,
  separator: border.subtle,

  /** Dock : légèrement au-dessus du fond pour effet « îlot ». */
  tabBar: tab.background,
  tabBarActive: tab.itemActive,
  tabBarInactive: tab.itemInactive,

  etatBon: status.ok,
  etatMoyen: status.watch,
  etatUse: status.watch,
  etatHorsService: status.critical,

  statutEnStock: status.neutral,
  statutEnPret: status.inUse,
  statutEnReparation: status.repair,

  alerteRouge: alert.high,
  alerteOrange: alert.medium,
};

export const Shadow = {
  card: elevation.card,
  primaryGlow: elevation.primaryGlow,
  /** Barre du bas : léger décollement. */
  dock: elevation.dock,
};

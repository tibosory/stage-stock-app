// src/theme/colors.ts
/**
 * Thème sombre éditorial : surfaces en couches, vert émeraude discret, contrastes maîtrisés.
 */
export const Colors = {
  bg: '#09090B',
  bgElevated: '#141416',
  bgCard: '#1A1A1E',
  bgCardAlt: '#16161A',
  bgInput: '#121214',
  bgInputBorder: '#2A2A30',

  /** Accent principal (actions, liens actifs, succès). */
  green: '#34D399',
  greenDark: '#059669',
  greenMuted: 'rgba(52, 211, 153, 0.14)',
  greenBg: 'rgba(52, 211, 153, 0.1)',
  tabIconActiveBg: 'rgba(52, 211, 153, 0.18)',

  red: '#F87171',
  redBg: 'rgba(248, 113, 113, 0.12)',

  yellow: '#FBBF24',
  yellowBg: 'rgba(251, 191, 36, 0.12)',

  blue: '#60A5FA',
  blueBg: 'rgba(96, 165, 250, 0.12)',

  white: '#FAFAFA',
  textPrimary: '#F4F4F5',
  textSecondary: '#A1A1AA',
  textMuted: '#71717A',

  border: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(255, 255, 255, 0.12)',
  separator: 'rgba(255, 255, 255, 0.06)',

  /** Dock : légèrement au-dessus du fond pour effet « îlot ». */
  tabBar: '#0C0C0F',
  tabBarActive: '#34D399',
  tabBarInactive: '#71717A',

  etatBon: '#34D399',
  etatMoyen: '#FBBF24',
  etatUse: '#FBBF24',
  etatHorsService: '#F87171',

  statutEnStock: '#3F3F46',
  statutEnPret: '#F87171',
  statutEnReparation: '#FBBF24',

  alerteRouge: '#F87171',
  alerteOrange: '#FBBF24',
};

export const Shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 3,
  },
  primaryGlow: {
    shadowColor: '#34D399',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  /** Barre du bas : léger décollement. */
  dock: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
};

/**
 * Garde de non-régression : `Colors` et `Shadow` (legacy) doivent rester
 * **byte-equal** au snapshot historique pendant toute la durée du Lot 1.
 *
 * Cette spec est destinée à être supprimée une fois la migration vers `tokens`
 * achevée (cf. PLATFORM_BLUEPRINT Lot 7+). Elle protège le rendu utilisateur
 * tant qu’on garde la rétro-compat.
 */
import { Colors, Shadow } from '../theme/colors';

const expectedColors: Record<string, string> = {
  bg: '#09090B',
  bgElevated: '#141416',
  bgCard: '#1A1A1E',
  bgCardAlt: '#16161A',
  bgInput: '#121214',
  bgInputBorder: '#2A2A30',
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

const colorsAsRecord = Colors as unknown as Record<string, string>;

const mismatches: string[] = [];
for (const [key, expected] of Object.entries(expectedColors)) {
  const got = colorsAsRecord[key];
  if (got !== expected) {
    mismatches.push(`Colors.${key}: got=${got} expected=${expected}`);
  }
}

if (mismatches.length > 0) {
  console.error(mismatches.join('\n'));
  throw new Error('theme-tokens.spec: Colors palette drifted from baseline');
}

if (Shadow.card.shadowOpacity !== 0.22) {
  throw new Error('theme-tokens.spec: Shadow.card.shadowOpacity changed');
}
if (Shadow.primaryGlow.shadowColor !== '#34D399') {
  throw new Error('theme-tokens.spec: Shadow.primaryGlow.shadowColor changed');
}
if (Shadow.dock.shadowOffset.height !== -4) {
  throw new Error('theme-tokens.spec: Shadow.dock.shadowOffset.height changed');
}

console.log('theme-tokens.spec: OK');

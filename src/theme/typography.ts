import { Platform, TextStyle } from 'react-native';
import { Colors } from './colors';

const FONT_REGULAR = Platform.select({
  ios: 'Roboto_400Regular',
  android: 'Roboto_400Regular',
  default: 'Roboto_400Regular',
});

const FONT_MEDIUM = Platform.select({
  ios: 'Roboto_500Medium',
  android: 'Roboto_500Medium',
  default: 'Roboto_500Medium',
});

/**
 * Échelle typographique sobre : hiérarchie claire, lisibilité, léger serrage sur les titres.
 */
export const Typography = {
  screenTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    fontFamily: FONT_MEDIUM,
    letterSpacing: -0.35,
    color: Colors.textPrimary,
  } satisfies TextStyle,

  sectionTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    fontFamily: FONT_MEDIUM,
    letterSpacing: -0.2,
    color: Colors.textPrimary,
  } satisfies TextStyle,

  body: {
    fontSize: 15,
    fontWeight: '400' as const,
    fontFamily: FONT_REGULAR,
    lineHeight: 22,
    color: Colors.textPrimary,
  } satisfies TextStyle,

  bodySecondary: {
    fontSize: 14,
    fontWeight: '400' as const,
    fontFamily: FONT_REGULAR,
    lineHeight: 20,
    color: Colors.textSecondary,
  } satisfies TextStyle,

  /** Sous-titre d’écran : contexte sous le titre principal (lisible, pas trop discret). */
  screenIntro: {
    fontSize: 14,
    fontWeight: '400' as const,
    fontFamily: FONT_REGULAR,
    lineHeight: 21,
    color: Colors.textSecondary,
  } satisfies TextStyle,

  caption: {
    fontSize: 12,
    fontWeight: '500' as const,
    fontFamily: FONT_MEDIUM,
    lineHeight: 16,
    color: Colors.textMuted,
  } satisfies TextStyle,

  label: {
    fontSize: 13,
    fontWeight: '500' as const,
    fontFamily: FONT_MEDIUM,
    letterSpacing: 0.1,
    color: Colors.textSecondary,
  } satisfies TextStyle,

  button: {
    fontSize: 16,
    fontWeight: '600' as const,
    fontFamily: FONT_MEDIUM,
    letterSpacing: 0.15,
  } satisfies TextStyle,

  tabLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    fontFamily: FONT_MEDIUM,
    letterSpacing: 0.2,
    lineHeight: 13,
  } satisfies TextStyle,
};

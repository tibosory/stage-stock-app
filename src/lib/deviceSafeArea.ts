import { Platform, StatusBar } from 'react-native';

/**
 * Sur Android (barre 3 boutons / gestes), `useSafeAreaInsets().bottom` est souvent 0
 * alors que la zone navigation existe — marge minimale en dp logiques.
 */
export const ANDROID_NAV_INSET_MIN = 64;

/** Repli si la status bar n’est pas remontée par le provider (edge-to-edge). */
export const ANDROID_STATUS_BAR_MIN = 28;

export function effectiveTopInset(insetTop: number): number {
  if (Platform.OS !== 'android') return insetTop;
  const status = StatusBar.currentHeight ?? ANDROID_STATUS_BAR_MIN;
  return Math.max(insetTop, status);
}

export function effectiveBottomInset(insetBottom: number): number {
  if (Platform.OS !== 'android') return Math.max(insetBottom, 12);
  return Math.max(insetBottom, ANDROID_NAV_INSET_MIN);
}

/** Hauteur utile d’une barre d’onglets workspace (hors inset bas système). */
export function workspaceTabBarContentHeight(variant: 'default' | 'accueilPro' = 'default'): number {
  if (variant === 'accueilPro') return Platform.OS === 'android' ? 60 : 56;
  return Platform.OS === 'android' ? 56 : 52;
}

/** Offset bas pour un FAB au-dessus de la barre d’onglets workspace + navigation Android. */
export function workspaceFabBottomOffset(insetBottom: number, variant: 'default' | 'accueilPro' = 'default'): number {
  const bottomPad = effectiveBottomInset(insetBottom);
  const barH = workspaceTabBarContentHeight(variant);
  return bottomPad + barH + 12;
}

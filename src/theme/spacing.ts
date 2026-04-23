/**
 * Espacements et rayons cohérents pour limiter la dérive entre écrans.
 */
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const Radius = {
  sm: 10,
  md: 12,
  lg: 14,
  xl: 20,
} as const;

/** Zone tactile minimale recommandée (icônes, boutons compacts). */
export const HitSlop = { top: 12, bottom: 12, left: 12, right: 12 } as const;

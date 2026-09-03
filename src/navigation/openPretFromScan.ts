import type { NavigationProp, ParamListBase } from '@react-navigation/native';

type NavLike = { getParent?: () => NavLike | undefined; navigate: (name: string, params?: object) => void };

function getRootNavigator(navigation: NavLike): NavLike {
  let nav: NavLike = navigation;
  for (let i = 0; i < 12; i++) {
    const p = nav.getParent?.();
    if (!p) break;
    nav = p;
  }
  return nav;
}

/** Ouvre la feuille de prêt avec les matériels scannés pré-sélectionnés. */
export function openNewPretFromScan(
  navigation: NavigationProp<ParamListBase> | NavLike,
  materielIds: string[]
): void {
  if (materielIds.length === 0) return;
  const root = getRootNavigator(navigation as NavLike);
  root.navigate('WorkspacePret', {
    screen: 'WsPret',
    params: { openNewPretWithMaterielIds: materielIds },
  });
}

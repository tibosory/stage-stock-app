import type { NavigationProp, ParamListBase } from '@react-navigation/native';

/** Remonte à la racine (stack) et ouvre l’écran d’accueil par activité. */
export function goActivityHome(
  navigation: NavigationProp<ParamListBase> | { getParent: () => unknown }
): void {
  type Nav = { getParent?: () => Nav | undefined; navigate: (n: string) => void };
  let nav: Nav = navigation as Nav;
  for (let i = 0; i < 8; i++) {
    const p = nav.getParent?.();
    if (!p) break;
    nav = p;
  }
  nav.navigate('ActivityHome');
}

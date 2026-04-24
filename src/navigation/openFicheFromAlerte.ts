import type { NavigationProp, ParamListBase } from '@react-navigation/native';

type NavLike = { getParent?: () => NavLike | undefined; navigate: (name: string, params?: object) => void };

function getRootNavigator(navigation: NavLike): NavLike {
  let nav: NavLike = navigation;
  for (let i = 0; i < 12; i++) {
    const p = nav.getParent?.();
    if (!p) break;
    nav = p as NavLike;
  }
  return nav;
}

/**
 * Ouvre matériel / VGP : depuis l’onglet `Alertes` (FullApp) ou l’espace
 * `WorkspaceAlertes` (où un simple `navigate('Stock')` n’existe pas dans l’arbre actif).
 */
export function openMaterielFicheFromAlerte(
  navigation: NavigationProp<ParamListBase> | NavLike,
  materielId: string,
  kind: 'stock' | 'vgp'
) {
  const root = getRootNavigator(navigation as NavLike);
  const tab = kind === 'vgp' ? 'VGP' : 'Stock';
  root.navigate('FullApp', {
    screen: tab,
    params: {
      screen: 'MaterielDetail',
      params: { materielId },
    },
  });
}

export function openPretFicheFromAlerte(navigation: NavigationProp<ParamListBase> | NavLike, pretId: string) {
  const root = getRootNavigator(navigation as NavLike);
  root.navigate('FullApp', {
    screen: 'Prêts',
    params: { openPretEditId: pretId },
  });
}

export function openConsoFicheFromAlerte(navigation: NavigationProp<ParamListBase> | NavLike, consoId: string) {
  const root = getRootNavigator(navigation as NavLike);
  root.navigate('FullApp', {
    screen: 'Consom.',
    params: { openConsoEditId: consoId },
  });
}

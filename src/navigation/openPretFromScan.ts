import type { NavigationProp, ParamListBase } from '@react-navigation/native';
import type { PretLigneQty } from '../lib/pretMaterielGroups';

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

function normalizeLignes(
  input: string[] | PretLigneQty[]
): PretLigneQty[] {
  if (!input.length) return [];
  if (typeof input[0] === 'string') {
    return (input as string[]).map(materielId => ({ materielId, quantite: 1 }));
  }
  return (input as PretLigneQty[]).map(l => ({
    materielId: l.materielId,
    quantite: Math.max(1, Math.floor(Number(l.quantite) || 1)),
  }));
}

/** Ouvre la feuille de prêt avec les matériels scannés pré-sélectionnés (qty pour les lots). */
export function openNewPretFromScan(
  navigation: NavigationProp<ParamListBase> | NavLike,
  materielIdsOrLignes: string[] | PretLigneQty[]
): void {
  const lignes = normalizeLignes(materielIdsOrLignes);
  if (lignes.length === 0) return;
  const root = getRootNavigator(navigation as NavLike);
  root.navigate('WorkspacePret', {
    screen: 'WsPret',
    params: {
      openNewPretWithMaterielLignes: lignes,
      /** Compat anciens appels / deep links. */
      openNewPretWithMaterielIds: lignes.map(l => l.materielId),
    },
  });
}

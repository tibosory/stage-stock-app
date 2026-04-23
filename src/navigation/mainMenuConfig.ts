/**
 * Barre d’onglets réduite + écran « Menu » : mêmes noms de routes que dans App.tsx.
 */
export type MainMenuDestination = { name: string; label: string };

/** Onglets secondaires : l’onglet « Menu » reste actif quand l’un de ces écrans est affiché. (Consommables = onglet dédié dans la barre.) */
export const STAFF_MENU_HUB_ROUTES = new Set([
  'Assistant',
  'Historique',
  'Alertes',
  'VGP',
  'Notice',
  'Réseau',
  'Params',
  'Utilisateur',
  'ImportExport',
]);

export const EMPRUNTEUR_MENU_HUB_ROUTES = new Set([
  'Assistant',
  'Notice',
  'Réseau',
  'Params',
  'Utilisateur',
  'ImportExport',
]);

export function menuHubTabIsFocused(
  currentRouteName: string,
  role: string | undefined
): boolean {
  if (currentRouteName === 'MenuHub') return true;
  if (role === 'emprunteur') return EMPRUNTEUR_MENU_HUB_ROUTES.has(currentRouteName);
  return STAFF_MENU_HUB_ROUTES.has(currentRouteName);
}

/** Barre du bas : accès direct Scanner · Stock · Consommables (centraux), puis Prêts, demandes admin, Menu. */
export function staffVisibleTabNames(isAdmin: boolean): string[] {
  const base = ['Scanner', 'Stock', 'Consom.', 'Prêts'];
  if (isAdmin) base.push('Demandes');
  base.push('MenuHub');
  return base;
}

export const EMPRUNTEUR_VISIBLE_TAB_NAMES = ['Prêts', 'MenuHub', 'Compte'] as const;

export function getStaffMenuDestinations(netLabel: string): MainMenuDestination[] {
  return [
    { name: 'Assistant', label: 'IA' },
    { name: 'Historique', label: 'Historique' },
    { name: 'Alertes', label: 'Alertes' },
    { name: 'VGP', label: 'VGP' },
    { name: 'Notice', label: 'Notice' },
    { name: 'Réseau', label: netLabel },
    { name: 'Utilisateur', label: 'Utilisateur' },
    { name: 'ImportExport', label: 'Import / Export' },
    { name: 'Params', label: 'Paramètres' },
  ];
}

export function getEmprunteurMenuDestinations(netLabel: string): MainMenuDestination[] {
  return [
    { name: 'Assistant', label: 'IA' },
    { name: 'Notice', label: 'Notice' },
    { name: 'Réseau', label: netLabel },
    { name: 'Utilisateur', label: 'Utilisateur' },
    { name: 'ImportExport', label: 'Import / Export' },
    { name: 'Params', label: 'Paramètres' },
  ];
}

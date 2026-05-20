/**
 * Barre d’onglets réduite + écran « Menu » : mêmes noms de routes que dans App.tsx.
 */
import { isV1LanMode } from '../config/appMode';
export type MainMenuDestination = { name: string; label: string };

export type Translate = (key: string) => string;

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
  'TourList',
  'TourDetail',
  'Tracking',
  'ActivityLog',
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

export function getStaffMenuDestinations(netLabel: string, t: Translate): MainMenuDestination[] {
  const full: MainMenuDestination[] = [
    { name: 'Assistant', label: t('tab.ai') },
    { name: 'Historique', label: t('tab.history') },
    { name: 'Alertes', label: t('tab.alerts') },
    { name: 'VGP', label: t('tab.vgp') },
    { name: 'Notice', label: t('tab.notice') },
    { name: 'Réseau', label: netLabel },
    { name: 'Utilisateur', label: t('tab.user') },
    { name: 'ImportExport', label: t('tab.importExport') },
    { name: 'Params', label: t('tab.settings') },
  ];
  if (!isV1LanMode()) return full;
  const v1Names = new Set(['Alertes', 'Notice', 'Réseau', 'Utilisateur', 'Params']);
  return full.filter(d => v1Names.has(d.name));
}

export function getEmprunteurMenuDestinations(netLabel: string, t: Translate): MainMenuDestination[] {
  const full: MainMenuDestination[] = [
    { name: 'Assistant', label: t('tab.ai') },
    { name: 'Notice', label: t('tab.notice') },
    { name: 'Réseau', label: netLabel },
    { name: 'Utilisateur', label: t('tab.user') },
    { name: 'ImportExport', label: t('tab.importExport') },
    { name: 'Params', label: t('tab.settings') },
  ];
  if (!isV1LanMode()) return full;
  return full.filter(d => ['Notice', 'Réseau', 'Utilisateur', 'Params'].includes(d.name));
}

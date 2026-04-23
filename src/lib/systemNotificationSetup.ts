/**
 * Configuration pour que les notifications locales apparaissent dans le centre
 * de notifications / volet système (Android + iOS), pas seulement en bannière in-app.
 */
import * as Notifications from 'expo-notifications';
import type { NotificationContentInput } from 'expo-notifications';
import { Platform } from 'react-native';

/** Nouveaux IDs de canal : l’importance d’un canal Android existant ne peut pas être relevée après création. */
export const TRAY_CHANNEL_PRETS = 'stagestock-tray-prets-v1';
export const TRAY_CHANNEL_VGP = 'stagestock-tray-vgp-v1';
export const TRAY_CHANNEL_SEUILS = 'stagestock-tray-seuils-v1';

let handlerConfigured = false;

export function configureNotificationsForSystemTray(): void {
  if (handlerConfigured) return;
  handlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    }),
  });
}

/** Canaux Android : importance HIGH + visibilité écran de verrouillage pour le volet « Notifications ». */
export async function ensureTrayAndroidChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const common = {
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    enableVibrate: true,
    sound: 'default' as const,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    showBadge: true,
  };
  await Notifications.setNotificationChannelAsync(TRAY_CHANNEL_PRETS, {
    name: 'Rappels prêts',
    ...common,
  });
  await Notifications.setNotificationChannelAsync(TRAY_CHANNEL_VGP, {
    name: 'Rappels VGP',
    ...common,
  });
  await Notifications.setNotificationChannelAsync(TRAY_CHANNEL_SEUILS, {
    name: 'Seuils consommables',
    ...common,
  });
}

/** Champs communs pour les notifs planifiées (barre d’état + centre). */
export function trayScheduledNotificationContentExtras(): Pick<
  NotificationContentInput,
  'sound' | 'priority' | 'interruptionLevel'
> {
  return {
    sound: 'default',
    priority: Notifications.AndroidNotificationPriority.HIGH,
    interruptionLevel: 'active',
  };
}

configureNotificationsForSystemTray();

/**
 * Configuration pour que les notifications locales apparaissent dans le centre
 * de notifications / volet système (Android + iOS), pas seulement en bannière in-app.
 */
import * as Notifications from 'expo-notifications';
import {
  SchedulableTriggerInputTypes,
  type DateTriggerInput,
  type NotificationContentInput,
  type NotificationTriggerInput,
  type TimeIntervalTriggerInput,
} from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

/** Nouveaux IDs de canal : l’importance d’un canal Android existant ne peut pas être relevée après création. */
export const TRAY_CHANNEL_PRETS = 'stagestock-tray-prets-v1';
export const TRAY_CHANNEL_VGP = 'stagestock-tray-vgp-v1';
export const TRAY_CHANNEL_SEUILS = 'stagestock-tray-seuils-v1';
export const TRAY_CHANNEL_ACCUEILPRO = 'stagestock-tray-accueilpro-v1';

let handlerConfigured = false;
const isExpoGoRuntime = Constants.appOwnership === 'expo';

export function configureNotificationsForSystemTray(): void {
  if (isExpoGoRuntime) return;
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
  if (isExpoGoRuntime) return;
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
  await Notifications.setNotificationChannelAsync(TRAY_CHANNEL_ACCUEILPRO, {
    name: 'Accueil Pro',
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

/** Contenu notification locale (canal Android explicite). */
export function buildTrayNotificationContent(
  channelId: string,
  title: string,
  body: string,
  data: Record<string, string>
): NotificationContentInput {
  return {
    ...trayScheduledNotificationContentExtras(),
    title,
    body,
    data,
    ...(Platform.OS === 'android' ? { channelId } : {}),
  };
}

/**
 * Planifie une notification locale. Sur Android, les délais sous 60 s utilisent un trigger DATE
 * (TIME_INTERVAL court provoque souvent « Failed to schedule… JSONObject »).
 */
export function buildTrayNotificationTrigger(channelId: string, fireAt: Date): NotificationTriggerInput {
  const secondsUntil = Math.max(1, Math.ceil((fireAt.getTime() - Date.now()) / 1000));
  if (Platform.OS === 'android' && secondsUntil < 60) {
    const trigger: DateTriggerInput = {
      type: SchedulableTriggerInputTypes.DATE,
      date: fireAt,
      channelId,
    };
    return trigger;
  }
  const trigger: TimeIntervalTriggerInput = {
    type: SchedulableTriggerInputTypes.TIME_INTERVAL,
    seconds: Math.max(60, secondsUntil),
    repeats: false,
    ...(Platform.OS === 'android' ? { channelId } : {}),
  };
  return trigger;
}

export async function scheduleTrayNotificationAt(
  channelId: string,
  title: string,
  body: string,
  data: Record<string, string>,
  fireAt: Date
): Promise<string> {
  await ensureTrayAndroidChannels();
  return Notifications.scheduleNotificationAsync({
    content: buildTrayNotificationContent(channelId, title, body, data),
    trigger: buildTrayNotificationTrigger(channelId, fireAt),
  });
}

configureNotificationsForSystemTray();

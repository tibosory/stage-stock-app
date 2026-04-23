import * as Notifications from 'expo-notifications';
import {
  SchedulableTriggerInputTypes,
  type TimeIntervalTriggerInput,
} from 'expo-notifications';
import { Platform } from 'react-native';
import { addDays, setHours, startOfDay } from 'date-fns';
import { Consommable } from '../types';
import { loadNotificationPrefs } from './notificationPrefs';
import {
  ensureTrayAndroidChannels,
  trayScheduledNotificationContentExtras,
  TRAY_CHANNEL_SEUILS,
} from './systemNotificationSetup';

function nextNineAmAnchor(from: Date): Date {
  let d = setHours(startOfDay(from), 9);
  if (d.getTime() <= from.getTime()) {
    d = setHours(startOfDay(addDays(from, 1)), 9);
  }
  return d;
}

/**
 * Rappel agrégé unique : stocks consommables sous le seuil (reprogrammé au chargement / synchro).
 */
export async function rescheduleSeuilBasReminders(consosBelowSeuil: Consommable[]): Promise<void> {
  await ensureTrayAndroidChannels();

  const pending = await Notifications.getAllScheduledNotificationsAsync();
  for (const p of pending) {
    const data = p.content.data as { kind?: string } | undefined;
    if (data?.kind === 'seuil_bas') {
      await Notifications.cancelScheduledNotificationAsync(p.identifier);
    }
  }

  const prefs = await loadNotificationPrefs();
  if (!prefs.pushSeuilBas || consosBelowSeuil.length === 0) return;

  const now = new Date();
  const when = nextNineAmAnchor(now);
  const seconds = Math.max(60, Math.floor((when.getTime() - now.getTime()) / 1000));
  const trigger: TimeIntervalTriggerInput = {
    type: SchedulableTriggerInputTypes.TIME_INTERVAL,
    seconds,
    ...(Platform.OS === 'android' ? { channelId: TRAY_CHANNEL_SEUILS } : {}),
  };

  const n = consosBelowSeuil.length;
  await Notifications.scheduleNotificationAsync({
    content: {
      ...trayScheduledNotificationContentExtras(),
      title: 'Stocks consommables faibles',
      body:
        n === 1
          ? `1 article sous le seuil : ${consosBelowSeuil[0].nom}`
          : `${n} articles sous le seuil — ouvrez l’onglet Alertes.`,
      data: { kind: 'seuil_bas', aggregate: true },
    },
    trigger,
  });
}

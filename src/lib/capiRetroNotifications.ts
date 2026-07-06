import * as Notifications from 'expo-notifications';
import {
  SchedulableTriggerInputTypes,
  type TimeIntervalTriggerInput,
} from 'expo-notifications';
import { Platform } from 'react-native';
import { setHours, startOfDay } from 'date-fns';
import { listCapiRetroNotifications, type CapiRetroNotification } from '../db/capiRetroNotificationDb';
import { loadNotificationPrefs } from './notificationPrefs';
import {
  ensureTrayAndroidChannels,
  trayScheduledNotificationContentExtras,
  TRAY_CHANNEL_PRETS,
} from './systemNotificationSetup';

function niveauLabel(n: string): string {
  if (n === 'retard') return 'En retard';
  if (n === 'urgent') return 'Urgent';
  if (n === 'proche') return 'Proche';
  return n;
}

function buildBody(row: CapiRetroNotification): string {
  const parts = [row.spectacleTitre, row.actionLibelle].filter(Boolean);
  const base = parts.join(' — ');
  if (row.joursRestants != null && row.joursRestants < 0) {
    return `${base} (retard ${-row.joursRestants} j)`;
  }
  if (row.joursRestants != null) {
    return `${base} (J-${row.joursRestants})`;
  }
  return base;
}

/** Reprogramme les rappels locaux pour les échéances rétroplanning CAPI reçues du serveur. */
export async function rescheduleCapiRetroReminders(): Promise<void> {
  await ensureTrayAndroidChannels();
  const prefs = await loadNotificationPrefs();
  if (!prefs.pushCapiRetro) return;

  const pending = await Notifications.getAllScheduledNotificationsAsync();
  for (const p of pending) {
    const data = p.content.data as { kind?: string } | undefined;
    if (data?.kind === 'capi_retro') {
      await Notifications.cancelScheduledNotificationAsync(p.identifier);
    }
  }

  const rows = await listCapiRetroNotifications();
  const now = Date.now();
  const when = setHours(startOfDay(new Date()), 9);
  if (when.getTime() <= now) {
    when.setDate(when.getDate() + 1);
  }
  const seconds = Math.max(60, Math.floor((when.getTime() - now) / 1000));

  const urgent = rows.filter((r) => r.niveau === 'retard' || r.niveau === 'urgent');
  if (!urgent.length) return;

  const trigger: TimeIntervalTriggerInput = {
    type: SchedulableTriggerInputTypes.TIME_INTERVAL,
    seconds,
    ...(Platform.OS === 'android' ? { channelId: TRAY_CHANNEL_PRETS } : {}),
  };

  const preview = urgent.slice(0, 3).map((r) => `• ${buildBody(r)}`).join('\n');
  const extra = urgent.length > 3 ? `\n… +${urgent.length - 3} autre(s)` : '';

  await Notifications.scheduleNotificationAsync({
    content: {
      ...trayScheduledNotificationContentExtras(),
      title: 'Rétroplanning CAPI — échéances',
      body: `${preview}${extra}`,
      data: { kind: 'capi_retro', count: urgent.length },
    },
    trigger,
  });
}

export function capiRetroNiveauColor(niveau: string): string {
  if (niveau === 'retard') return '#c0392b';
  if (niveau === 'urgent') return '#e67e22';
  return '#f1c40f';
}

export { niveauLabel };

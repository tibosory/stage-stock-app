import * as Notifications from 'expo-notifications';
import {
  SchedulableTriggerInputTypes,
  type TimeIntervalTriggerInput,
} from 'expo-notifications';
import { Platform } from 'react-native';
import { addDays, startOfDay, setHours, format } from 'date-fns';
import { Materiel } from '../types';
import { isVgpActif, computeVgpProchaineDate } from './vgp';
import { getVgpNotificationAdvanceDays } from './vgpPrefs';
import { loadNotificationPrefs } from './notificationPrefs';
import {
  ensureTrayAndroidChannels,
  trayScheduledNotificationContentExtras,
  TRAY_CHANNEL_VGP,
} from './systemNotificationSetup';

/** Annule les rappels VGP puis reprogramme J−N (si N>0) et jour J à 9h (locales). */
export async function rescheduleVgpDueReminders(materiels: Materiel[]): Promise<void> {
  await ensureTrayAndroidChannels();
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  for (const p of pending) {
    const data = p.content.data as { kind?: string } | undefined;
    if (data?.kind === 'vgp_echeance') {
      await Notifications.cancelScheduledNotificationAsync(p.identifier);
    }
  }

  const prefs = await loadNotificationPrefs();
  if (!prefs.pushVgpControle) return;

  const advance = await getVgpNotificationAdvanceDays();
  const now = Date.now();

  const scheduleAt = async (when: Date, title: string, body: string, materielId: string, suffix: string) => {
    if (when.getTime() <= now) return;
    const seconds = Math.max(60, Math.floor((when.getTime() - now) / 1000));
    const trigger: TimeIntervalTriggerInput = {
      type: SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
      ...(Platform.OS === 'android' ? { channelId: TRAY_CHANNEL_VGP } : {}),
    };
    await Notifications.scheduleNotificationAsync({
      content: {
        ...trayScheduledNotificationContentExtras(),
        title,
        body,
        data: { kind: 'vgp_echeance', materielId, suffix },
      },
      trigger,
    });
  };

  for (const m of materiels) {
    if (!isVgpActif(m)) continue;
    const jours = m.vgp_periodicite_jours;
    if (jours == null || jours <= 0) continue;
    const due = computeVgpProchaineDate(m);
    if (!due) continue;

    const dayJ = setHours(startOfDay(due), 9);
    const extra = m.vgp_libelle?.trim() ? ` — ${m.vgp_libelle.trim()}` : '';
    const dateFr = format(due, 'dd/MM/yyyy');

    await scheduleAt(
      dayJ,
      'VGP — échéance',
      `Aujourd’hui : ${m.nom}${extra} (échéance ${dateFr})`,
      m.id,
      'j0'
    );

    if (advance > 0) {
      const remind = setHours(startOfDay(addDays(due, -advance)), 9);
      if (remind.getTime() < dayJ.getTime()) {
        await scheduleAt(
          remind,
          'VGP — rappel',
          `Dans ${advance} jour${advance > 1 ? 's' : ''} : ${m.nom}${extra} (échéance ${dateFr})`,
          m.id,
          `j-${advance}`
        );
      }
    }
  }
}

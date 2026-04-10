import * as Notifications from 'expo-notifications';
import {
  SchedulableTriggerInputTypes,
  type TimeIntervalTriggerInput,
} from 'expo-notifications';
import { Platform } from 'react-native';
import { addDays, parseISO, isValid, startOfDay, setHours } from 'date-fns';
import { Pret } from '../types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const CHANNEL_ID = 'prets-retour';

async function ensureAndroidChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Rappels prêts',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

function parseYmd(s: string | undefined): Date | null {
  if (!s) return null;
  const d = s.includes('T') ? parseISO(s) : parseISO(`${s}T09:00:00`);
  return isValid(d) ? d : null;
}

export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/** Annule les rappels liés aux prêts puis reprogramme J-1 et jour J à 9h (locales). */
export async function reschedulePretReturnReminders(prets: Pret[]): Promise<void> {
  await ensureAndroidChannel();
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  for (const p of pending) {
    const data = p.content.data as { kind?: string } | undefined;
    if (data?.kind === 'pret_retour') {
      await Notifications.cancelScheduledNotificationAsync(p.identifier);
    }
  }

  const actifs = prets.filter(
    p => (p.statut === 'en cours' || p.statut === 'en retard') && p.retour_prevu
  );

  for (const pret of actifs) {
    const retour = parseYmd(pret.retour_prevu);
    if (!retour) continue;

    const dayJ = setHours(startOfDay(retour), 9);
    const dayJ1 = setHours(startOfDay(addDays(retour, -1)), 9);
    const now = Date.now();

    const schedule = async (when: Date, body: string, suffix: string) => {
      if (when.getTime() <= now) return;
      const seconds = Math.max(60, Math.floor((when.getTime() - now) / 1000));
      const trigger: TimeIntervalTriggerInput = {
        type: SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
      };

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Rappel prêt — Stage Stock',
          body,
          data: { kind: 'pret_retour', pretId: pret.id, suffix },
        },
        trigger,
      });
    };

    await schedule(
      dayJ1,
      `Retour prévu demain : ${pret.emprunteur} — feuille ${pret.numero_feuille ?? pret.id.slice(0, 8)}`,
      'j1'
    );
    await schedule(
      dayJ,
      `Retour prévu aujourd’hui : ${pret.emprunteur} — feuille ${pret.numero_feuille ?? pret.id.slice(0, 8)}`,
      'j0'
    );
  }
}

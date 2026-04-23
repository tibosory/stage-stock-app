import * as Notifications from 'expo-notifications';
import {
  SchedulableTriggerInputTypes,
  type TimeIntervalTriggerInput,
} from 'expo-notifications';
import { Platform } from 'react-native';
import { addDays, parseISO, isValid, startOfDay, setHours } from 'date-fns';
import { Pret } from '../types';
import { loadNotificationPrefs } from './notificationPrefs';
import {
  ensureTrayAndroidChannels,
  trayScheduledNotificationContentExtras,
  TRAY_CHANNEL_PRETS,
} from './systemNotificationSetup';

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

/** Nombre de jours avant le retour pour le 1er rappel (9 h). Vide / invalide = 1 (J-1). */
function reminderDaysBeforeRetour(pret: Pret): number {
  const raw = pret.rappel_jours_avant;
  if (raw == null) return 1;
  const n = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(365, Math.floor(n));
}

/** Annule les rappels liés aux prêts puis reprogramme rappel « J−N » (N configurable, défaut 1) et jour J à 9 h. */
export async function reschedulePretReturnReminders(prets: Pret[]): Promise<void> {
  await ensureTrayAndroidChannels();
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  for (const p of pending) {
    const data = p.content.data as { kind?: string } | undefined;
    if (data?.kind === 'pret_retour') {
      await Notifications.cancelScheduledNotificationAsync(p.identifier);
    }
  }

  const prefs = await loadNotificationPrefs();
  if (!prefs.pushPrets) return;

  const actifs = prets.filter(
    p => (p.statut === 'en cours' || p.statut === 'en retard') && p.retour_prevu
  );

  for (const pret of actifs) {
    const retour = parseYmd(pret.retour_prevu);
    if (!retour) continue;

    const nJours = reminderDaysBeforeRetour(pret);
    const dayJ = setHours(startOfDay(retour), 9);
    const advanceDay = setHours(startOfDay(addDays(retour, -nJours)), 9);
    const now = Date.now();

    const schedule = async (when: Date, body: string, suffix: string) => {
      if (when.getTime() <= now) return;
      const seconds = Math.max(60, Math.floor((when.getTime() - now) / 1000));
      const trigger: TimeIntervalTriggerInput = {
        type: SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        ...(Platform.OS === 'android' ? { channelId: TRAY_CHANNEL_PRETS } : {}),
      };

      await Notifications.scheduleNotificationAsync({
        content: {
          ...trayScheduledNotificationContentExtras(),
          title: 'Rappel prêt — Stage Stock',
          body,
          data: { kind: 'pret_retour', pretId: pret.id, suffix },
        },
        trigger,
      });
    };

    const feuille = pret.numero_feuille ?? pret.id.slice(0, 8);
    const advanceBody =
      nJours === 1
        ? `Retour prévu demain : ${pret.emprunteur} — feuille ${feuille}`
        : `Retour prévu dans ${nJours} jours : ${pret.emprunteur} — feuille ${feuille}`;

    if (advanceDay.getTime() !== dayJ.getTime()) {
      await schedule(advanceDay, advanceBody, `avant-${nJours}`);
    }
    await schedule(
      dayJ,
      `Retour prévu aujourd’hui : ${pret.emprunteur} — feuille ${feuille}`,
      'j0'
    );
  }
}

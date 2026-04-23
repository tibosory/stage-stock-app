/**
 * Outils de test : notification locale, push Expo (équipe), e-mail SMTP via le même endpoint que les alertes auto.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import {
  SchedulableTriggerInputTypes,
  type TimeIntervalTriggerInput,
} from 'expo-notifications';
import { getResolvedApiBase, stageStockApiHeadersAsync, checkServerReachableQuick } from '../config/stageStockApi';
import { getAlertesEmail, getStaffExpoPushTokens } from '../db/database';
import { loadMailRecipientAlerteIds } from './notificationPrefs';
import { ensureTrayAndroidChannels, TRAY_CHANNEL_PRETS } from './systemNotificationSetup';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

function joinBasePath(base: string, path: string): string {
  const b = base.replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}

async function getMailTestRecipients(): Promise<string[]> {
  const [ids, list] = await Promise.all([loadMailRecipientAlerteIds(), getAlertesEmail()]);
  const pick = ids.length ? list.filter(a => ids.includes(a.id)) : list;
  return [...new Set(pick.map(a => a.email.trim().toLowerCase()).filter(Boolean))];
}

/** Notification locale après ~2 s (même canal Android que les prêts). */
export async function scheduleTestLocalNotification(
  title: string,
  body: string
): Promise<{ ok: boolean; message: string }> {
  const t = title.trim() || 'Stage Stock — test';
  const b = (body.trim() || 'Notification locale de test.').slice(0, 400);
  await ensureTrayAndroidChannels();
  const trigger: TimeIntervalTriggerInput = {
    type: SchedulableTriggerInputTypes.TIME_INTERVAL,
    seconds: 2,
    repeats: false,
    ...(Platform.OS === 'android' ? { channelId: TRAY_CHANNEL_PRETS } : {}),
  };
  await Notifications.scheduleNotificationAsync({
    content: {
      title: t,
      body: b,
      sound: true,
      data: { kind: 'stagestock_test_local' },
    },
    trigger,
  });
  return {
    ok: true,
    message: 'Une notification locale est programmée dans environ 2 secondes.',
  };
}

/** Push Expo vers les jetons enregistrés (comptes admin + technicien actifs). */
export async function sendTestExpoPushToStaff(options: {
  title: string;
  body: string;
}): Promise<{ ok: boolean; message: string }> {
  const title = (options.title.trim() || 'Stage Stock — test push').slice(0, 120);
  const body = (options.body.trim() || 'Message de test.').slice(0, 400);
  const tokens = await getStaffExpoPushTokens();
  if (tokens.length === 0) {
    return {
      ok: false,
      message:
        'Aucun jeton Expo : ouvrez la session sur un appareil avec notifications activées pour au moins un compte admin ou technicien.',
    };
  }
  try {
    const messages = tokens.map(to => ({
      to,
      sound: 'default' as const,
      title,
      body,
      data: { kind: 'stagestock_test_push' },
    }));
    const resp = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });
    const json = (await resp.json()) as { data?: Array<{ status?: string; message?: string }> };
    const results = Array.isArray(json?.data) ? json.data : [];
    const okCount = results.filter(r => r.status === 'ok').length;
    if (okCount > 0) {
      const err = results.length - okCount;
      return {
        ok: true,
        message: `Envoi Expo : ${okCount} notification(s) acceptée(s)${err > 0 ? `, ${err} rejet(s)` : ''} (${tokens.length} jeton(s) tenté(s)).`,
      };
    }
    const firstErr = results[0]?.message ?? resp.status;
    return {
      ok: false,
      message: `Aucun envoi accepté par Expo. Détail : ${String(firstErr).slice(0, 200)}`,
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Erreur réseau (Expo push).' };
  }
}

/**
 * E-mail via POST /api/email/send-alert (même chemin que l’envoi auto d’alertes) — nécessite SMTP sur le serveur.
 */
export async function sendTestSmtpAlertEmail(options: {
  subject: string;
  text: string;
}): Promise<{ ok: boolean; message: string }> {
  const subject = (options.subject.trim() || '[Stage Stock] Test e-mail').slice(0, 300);
  const text = (options.text.trim() || 'Message de test.').slice(0, 50_000);
  const base = await getResolvedApiBase();
  if (!base || !/^https?:\/\//i.test(base) || base.length < 8) {
    return { ok: false, message: 'URL du serveur non configurée (onglet Réseau ou build).' };
  }
  const reachable = await checkServerReachableQuick();
  if (!reachable) {
    return { ok: false, message: 'Serveur injoignable. Vérifiez le réseau et l’URL API.' };
  }
  const to = await getMailTestRecipients();
  if (to.length === 0) {
    return {
      ok: false,
      message:
        'Aucun destinataire : ajoutez des adresses dans « Destinataires alertes email ». Si des cases sont cochées, seules ces fiches reçoivent le test ; sinon toutes les adresses enregistrées.',
    };
  }
  const url = joinBasePath(base, '/api/email/send-alert');
  const headers = await stageStockApiHeadersAsync();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ to, subject, text: `${text}\n\n— Stage Stock (test manuel)` }),
  });
  if (res.status === 501) {
    const j = (await res.json().catch(() => ({}))) as { hint?: string };
    return {
      ok: false,
      message: j.hint ?? 'SMTP non configuré sur le serveur (variables SMTP / SMTP_URL).',
    };
  }
  if (!res.ok) {
    const t = await res.text();
    return { ok: false, message: t.slice(0, 400) || `HTTP ${res.status}` };
  }
  return { ok: true, message: `E-mail de test envoyé vers : ${to.join(', ')}` };
}

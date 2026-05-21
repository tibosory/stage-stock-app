/**
 * Notifications Accueil Pro : nouvelles demandes de location et décisions staff.
 */
import { Linking, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { format, parseISO, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getAdminExpoPushTokens, getAdminNotificationEmails } from '../db/userDb';
import { getApOrganization } from '../db/accueilProDb';
import type { ApRentalRequest } from '../types/accueilPro';
import {
  ensureTrayAndroidChannels,
  trayScheduledNotificationContentExtras,
  TRAY_CHANNEL_ACCUEILPRO,
} from './systemNotificationSetup';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

function formatDateLong(raw: string | undefined): string {
  if (!raw?.trim()) return 'non précisée';
  const d = raw.includes('T') ? parseISO(raw) : parseISO(`${raw.trim()}T12:00:00`);
  if (!isValid(d)) return raw.trim();
  return format(d, 'd MMMM yyyy', { locale: fr });
}

async function sendExpoPush(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, string>
): Promise<number> {
  if (tokens.length === 0) return 0;
  try {
    const messages = tokens.map(to => ({
      to,
      sound: 'default' as const,
      title,
      body,
      data,
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
    const json = (await resp.json()) as { data?: Array<{ status?: string }> };
    const results = Array.isArray(json?.data) ? json.data : [];
    return results.filter(r => r.status === 'ok').length;
  } catch {
    return 0;
  }
}

/** Notification locale immédiate (centre de notifications). */
export async function notifyAccueilProLocal(title: string, body: string, data?: Record<string, string>): Promise<void> {
  await ensureTrayAndroidChannels();
  await Notifications.scheduleNotificationAsync({
    content: {
      ...trayScheduledNotificationContentExtras(),
      title: title.slice(0, 120),
      body: body.slice(0, 400),
      data: { kind: 'accueilpro', ...(data ?? {}) },
      ...(Platform.OS === 'android' ? { channelId: TRAY_CHANNEL_ACCUEILPRO } : {}),
    },
    trigger: null,
  });
}

function rentalSummary(r: ApRentalRequest, orgName?: string | null): string {
  const parts = [
    orgName ? `Organisation : ${orgName}` : null,
    r.event_name?.trim() ? `Événement : ${r.event_name.trim()}` : null,
    `Date : ${formatDateLong(r.date_debut)}`,
    r.heure_debut ? `Heure : ${r.heure_debut}${r.heure_fin ? `–${r.heure_fin}` : ''}` : null,
  ].filter(Boolean);
  return parts.join(' · ');
}

/** Nouvelle demande soumise : push vers les administrateurs. */
export async function notifyAdminsNewAccueilProRentalRequest(
  rental: ApRentalRequest
): Promise<{ ok: boolean; message: string }> {
  const org = await getApOrganization(rental.organization_id);
  const title = 'Accueil Pro — nouvelle demande';
  const body = rentalSummary(rental, org?.name);
  const okPush = await sendExpoPush(await getAdminExpoPushTokens(), title, body, {
    kind: 'accueilpro_demande_nouvelle',
    rentalId: rental.id,
  });
  if (okPush > 0) {
    return { ok: true, message: `${okPush} administrateur(s) notifié(s).` };
  }
  return {
    ok: false,
    message: 'Aucun administrateur joignable par push (session admin avec notifications activées).',
  };
}

/** Validation ou refus : notification locale + mailto organisation si e-mail connu. */
export async function notifyAccueilProRentalDecision(
  rental: ApRentalRequest,
  decision: 'validée' | 'refusée',
  eventName?: string | null
): Promise<{ local: boolean; mailto: boolean }> {
  const org = await getApOrganization(rental.organization_id);
  const label = decision === 'validée' ? 'Demande validée' : 'Demande refusée';
  const detail =
    decision === 'validée' && eventName
      ? `Événement créé : ${eventName}.`
      : rentalSummary(rental, org?.name);

  try {
    await notifyAccueilProLocal(`Accueil Pro — ${label}`, detail, {
      kind: 'accueilpro_demande_decision',
      rentalId: rental.id,
      decision,
    });
  } catch {
    /* ignore tray errors */
  }

  const email = org?.email?.trim();
  if (email) {
    const subject = encodeURIComponent(`Accueil Pro — ${label}`);
    const body = encodeURIComponent(`${label}\n\n${detail}\n\n— CATRACK Pro`);
    void Linking.openURL(`mailto:${email}?subject=${subject}&body=${body}`);
    return { local: true, mailto: true };
  }

  const adminEmails = await getAdminNotificationEmails();
  if (adminEmails.length > 0 && decision === 'validée') {
    const subject = encodeURIComponent(`Accueil Pro — ${label}`);
    const body = encodeURIComponent(`${label}\n\n${detail}\n\n— CATRACK Pro`);
    void Linking.openURL(`mailto:${adminEmails[0]}?subject=${subject}&body=${body}`);
    return { local: true, mailto: true };
  }

  return { local: true, mailto: false };
}

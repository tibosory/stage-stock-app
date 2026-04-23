import { Linking } from 'react-native';
import { format, parseISO, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  getAdminExpoPushTokens,
  getAdminNotificationEmails,
  getExpoPushTokenForUserId,
} from '../db/database';
import type { Pret } from '../types';

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

/** Nouvelle demande : notifie les administrateurs (push puis mailto). */
export async function notifyAdminsNewPretDemande(pret: Pret): Promise<{ ok: boolean; message: string }> {
  const body = [
    `Nouvelle demande de prêt de ${pret.emprunteur}.`,
    `Départ prévu : ${formatDateLong(pret.date_depart)}.`,
    pret.retour_prevu ? `Retour prévu : ${formatDateLong(pret.retour_prevu)}.` : '',
    pret.commentaire ? `Commentaire : ${pret.commentaire}` : '',
  ]
    .filter(Boolean)
    .join(' ');
  const title = 'Stage Stock — demande de prêt';

  const okPush = await sendExpoPush(await getAdminExpoPushTokens(), title, body, {
    kind: 'pret_demande_nouvelle',
    pretId: pret.id,
  });
  if (okPush > 0) {
    return { ok: true, message: `${okPush} administrateur(s) notifié(s) sur l’app.` };
  }

  const emails = await getAdminNotificationEmails();
  if (emails.length === 0) {
    return {
      ok: false,
      message:
        'Aucun administrateur joignable : ajoutez un e-mail sur un compte admin ou connectez-vous avec les notifications activées.',
    };
  }
  const subject = encodeURIComponent(title);
  const mailBody = encodeURIComponent(`${body}\n\n— Stage Stock`);
  const mailto = `mailto:${emails.join(',')}?subject=${subject}&body=${mailBody}`;
  try {
    if (await Linking.canOpenURL(mailto)) {
      await Linking.openURL(mailto);
      return { ok: true, message: 'Messagerie ouverte pour prévenir les administrateurs.' };
    }
  } catch {
    /* ignore */
  }
  return { ok: false, message: 'Impossible d’envoyer la notification aux administrateurs.' };
}

/** Demande validée : notifie l’emprunteur (push ou e-mail de la fiche). */
export async function notifyBorrowerDemandeAcceptee(pret: Pret): Promise<void> {
  const title = 'Stage Stock — prêt accepté';
  const body = `Votre demande de prêt a été validée. Le prêt est maintenant « en cours » (départ ${formatDateLong(pret.date_depart)}).`;

  const token = await getExpoPushTokenForUserId(pret.emprunteur_user_id);
  if (token) {
    const n = await sendExpoPush([token], title, body, { kind: 'pret_demande_acceptee', pretId: pret.id });
    if (n > 0) return;
  }

  const email = pret.email?.trim();
  if (!email || !email.includes('@')) return;
  const subject = encodeURIComponent(title);
  const mailBody = encodeURIComponent(`${body}\n\n— Stage Stock`);
  const mailto = `mailto:${encodeURIComponent(email)}?subject=${subject}&body=${mailBody}`;
  try {
    if (await Linking.canOpenURL(mailto)) await Linking.openURL(mailto);
  } catch {
    /* ignore */
  }
}

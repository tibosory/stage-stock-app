import { Linking } from 'react-native';
import { format, parseISO, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getStaffExpoPushTokens, getStaffNotificationEmails } from '../db/database';
import type { Pret } from '../types';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

function formatRetourPrevu(raw: string | undefined): string {
  if (!raw?.trim()) return 'non indiquée sur la feuille';
  const d = raw.includes('T') ? parseISO(raw) : parseISO(`${raw.trim()}T12:00:00`);
  if (!isValid(d)) return raw.trim();
  return format(d, 'EEEE d MMMM yyyy', { locale: fr });
}

/**
 * Prévient admin / technicien : push Expo si des jetons sont enregistrés, sinon ouverture mailto.
 */
export async function notifyStaffAboutBorrowerReturn(
  pret: Pret,
  precisionHoraire: string
): Promise<{ ok: boolean; message: string }> {
  const dateFeuille = formatRetourPrevu(pret.retour_prevu);
  const lines = [
    `${pret.emprunteur} signale le retour du matériel.`,
    `Retour prévu (feuille) : ${dateFeuille}.`,
  ];
  if (precisionHoraire.trim()) {
    lines.push(`Précision horaire / lieu : ${precisionHoraire.trim()}.`);
  }
  if (pret.numero_feuille?.trim()) {
    lines.push(`Feuille n° ${pret.numero_feuille.trim()}.`);
  }
  const body = lines.join(' ');
  const title = 'Stage Stock — retour matériel';

  const tokens = await getStaffExpoPushTokens();
  if (tokens.length > 0) {
    try {
      const messages = tokens.map(to => ({
        to,
        sound: 'default' as const,
        title,
        body,
        data: { kind: 'borrower_return_notice', pretId: pret.id },
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
        const errCount = results.length - okCount;
        const tail = errCount > 0 ? ` (${errCount} envoi en erreur)` : '';
        return { ok: true, message: `L'équipe a été notifiée (${okCount} notification(s))${tail}.` };
      }
    } catch {
      /* repli mail */
    }
  }

  const emails = await getStaffNotificationEmails();
  if (emails.length === 0) {
    return {
      ok: false,
      message:
        'Aucun destinataire : demandez à un responsable de se connecter une fois à l’app (notifications acceptées) ou d’ajouter des e-mails (comptes admin/technicien ou liste « Alertes e-mail »).',
    };
  }

  const subject = encodeURIComponent(title);
  const mailBody = encodeURIComponent(
    `${body}\n\n— Message envoyé depuis l’app Stage Stock (compte emprunteur).`
  );
  const mailto = `mailto:${emails.join(',')}?subject=${subject}&body=${mailBody}`;

  try {
    const can = await Linking.canOpenURL(mailto);
    if (can) {
      await Linking.openURL(mailto);
      return {
        ok: true,
        message: 'Messagerie ouverte avec le message prêt à envoyer aux responsables.',
      };
    }
  } catch {
    /* ignore */
  }

  return {
    ok: false,
    message: 'Impossible d’ouvrir la messagerie. Réessayez ou contactez l’équipe autrement.',
  };
}

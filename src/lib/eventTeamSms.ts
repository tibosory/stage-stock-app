import * as SMS from 'expo-sms';
import { Linking, Platform } from 'react-native';
import { openSms } from './contactActions';

function phoneKey(phone: string): string {
  let key = phone.replace(/[^\d+]/g, '').replace(/^00/, '+');
  if (/^0\d{9}$/.test(key)) key = `+33${key.slice(1)}`;
  return key;
}

export type SendTeamSmsResult = 'sent' | 'cancelled' | 'unavailable';

/** Ouvre l’app Messages avec tous les destinataires et le corps pré-rempli. */
export async function sendSmsToPhones(phones: string[], message: string): Promise<SendTeamSmsResult> {
  const body = message.trim();
  if (!body || phones.length === 0) return 'unavailable';

  const normalized = phones.map(p => phoneKey(p));

  if (await SMS.isAvailableAsync()) {
    const { result } = await SMS.sendSMSAsync(normalized, body);
    if (result === 'cancelled') return 'cancelled';
    return 'sent';
  }

  if (Platform.OS === 'android' && normalized.length > 0) {
    const recipients = normalized.join(';');
    const url = `smsto:${recipients}?body=${encodeURIComponent(body)}`;
    const ok = await Linking.canOpenURL(`smsto:${normalized[0]}`);
    if (ok) {
      await Linking.openURL(url);
      return 'sent';
    }
  }

  if (normalized.length === 1) {
    const ok = await openSms(normalized[0], body);
    return ok ? 'sent' : 'unavailable';
  }

  return 'unavailable';
}

export { listEventTeamSmsRecipients } from './eventTeamSmsRecipients';
export type { EventTeamSmsRecipient, EventTeamSmsSkipped } from './eventTeamSmsRecipients';

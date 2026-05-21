import { Linking, Platform } from 'react-native';

function digitsOnly(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}

/** Ouvre l’application téléphone. */
export async function openPhone(phone?: string | null): Promise<boolean> {
  const raw = phone?.trim();
  if (!raw) return false;
  const normalized = /^\+/.test(raw) ? digitsOnly(raw) : digitsOnly(raw);
  const url = `tel:${normalized}`;
  const ok = await Linking.canOpenURL(url);
  if (!ok) return false;
  await Linking.openURL(url);
  return true;
}

/**
 * Compose un SMS pré‑rempli (corps optionnel ; numéros internationaux : préfixer + pays).
 */
export async function openSms(phone?: string | null, body?: string | null): Promise<boolean> {
  const raw = phone?.trim();
  if (!raw) return false;
  const normalized = digitsOnly(raw).replace(/^00/, '+');

  let url: string;
  if (Platform.OS === 'android') {
    url = body?.trim()
      ? `smsto:${normalized}?body=${encodeURIComponent(body)}`
      : `smsto:${normalized}`;
  } else {
    url = body?.trim()
      ? `sms:${normalized}&body=${encodeURIComponent(body)}`
      : `sms:${normalized}`;
  }

  const schemeProbe = Platform.OS === 'android' ? `smsto:${normalized}` : `sms:${normalized}`;
  const ok = await Linking.canOpenURL(schemeProbe);
  if (!ok) return false;
  await Linking.openURL(url);
  return true;
}

/** Ouvre le client messagerie (`mailto`). */
export async function openEmail(
  email?: string | null,
  opts?: { subject?: string; body?: string }
): Promise<boolean> {
  const raw = email?.trim();
  if (!raw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return false;
  const qs = new URLSearchParams();
  if (opts?.subject) qs.set('subject', opts.subject);
  if (opts?.body) qs.set('body', opts.body);
  const suffix = qs.toString().length ? `?${qs.toString()}` : '';
  const url = `mailto:${raw}${suffix}`;
  const ok = await Linking.canOpenURL('mailto:');
  if (!ok) return false;
  await Linking.openURL(url);
  return true;
}

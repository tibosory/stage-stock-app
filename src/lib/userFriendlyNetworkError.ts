import type { AppLanguage } from '../i18n/strings';

export type FriendlyLang = AppLanguage;

/** Transforme une erreur technique réseau/API en message compréhensible pour l'utilisateur final. */
export function toUserFriendlyNetworkMessage(raw: string, language: FriendlyLang = 'fr'): string {
  const t = raw.trim();
  if (!t) {
    return language === 'en'
      ? 'Connection problem. Check your network and try again.'
      : 'Problème de connexion. Vérifiez votre réseau puis réessayez.';
  }
  const lower = t.toLowerCase();

  if (
    lower.includes('econnrefused') ||
    lower.includes('connection refused') ||
    lower.includes('failed to connect') ||
    lower.includes('connexion refusée')
  ) {
    return language === 'en'
      ? 'Cannot reach your server. Check that StageStock Local is running on your PC, then tap Retry.'
      : 'Impossible de joindre votre serveur. Vérifiez qu\'il est démarré sur le PC, puis appuyez sur Réessayer.';
  }

  if (
    lower.includes('network request failed') ||
    lower.includes('network error') ||
    lower.includes('fetch failed') ||
    lower.includes('failed to fetch') ||
    lower.includes('internet') && lower.includes('unavailable')
  ) {
    return language === 'en'
      ? 'Internet or Wi‑Fi unavailable. The app continues in offline mode; sync will resume when connected.'
      : 'Connexion internet ou Wi‑Fi indisponible. L\'application continue en mode hors ligne ; la synchronisation reprendra dès que possible.';
  }

  if (lower.includes('timeout') || lower.includes('timed out') || lower.includes('aborted')) {
    return language === 'en'
      ? 'The server is taking too long to respond. Check that it is running and on the same Wi‑Fi, then try again.'
      : 'Le serveur met trop de temps à répondre. Vérifiez qu\'il est lancé et sur le même Wi‑Fi, puis réessayez.';
  }

  if (
    lower.includes('token expired') ||
    lower.includes('jwt expired') ||
    lower.includes('session expired') ||
    lower.includes('unauthorized') ||
    lower.includes('401')
  ) {
    return language === 'en'
      ? 'Your session has expired. Sign in again from Settings or scan the pairing QR code.'
      : 'Votre session a expiré. Reconnectez-vous depuis Paramètres ou scannez à nouveau le QR d\'appairage.';
  }

  if (lower.includes('enotfound') || lower.includes('unable to resolve host') || lower.includes('dns')) {
    return language === 'en'
      ? 'Server address not found. Check the address or scan the pairing QR code again.'
      : 'Adresse du serveur introuvable. Vérifiez l\'adresse ou scannez à nouveau le QR d\'appairage.';
  }

  if (lower.includes('aucune url') || lower.includes('no api url') || lower.includes('not configured')) {
    return language === 'en'
      ? 'No server configured yet. Install the PC server and scan the pairing QR code, or continue in offline mode.'
      : 'Aucun serveur configuré pour l\'instant. Installez le serveur PC et scannez le QR d\'appairage, ou continuez en mode hors ligne.';
  }

  if (lower.includes('404') && lower.includes('installateur')) {
    return language === 'en'
      ? 'Installer file not found online. Try again later or transfer the file from another device.'
      : 'Fichier d\'installation introuvable en ligne. Réessayez plus tard ou transférez le fichier depuis un autre appareil.';
  }

  // Message déjà orienté utilisateur (onboarding, smart diag) — ne pas écraser.
  if (t.length < 220 && !lower.includes('http ') && !/\b\d{3}\b/.test(lower)) {
    return t;
  }

  return language === 'en'
    ? 'Cannot connect to the server right now. Your data stays on the phone; sync will resume automatically when the server is available.'
    : 'Connexion au serveur impossible pour le moment. Vos données restent sur le téléphone ; la synchronisation reprendra automatiquement dès que le serveur sera disponible.';
}

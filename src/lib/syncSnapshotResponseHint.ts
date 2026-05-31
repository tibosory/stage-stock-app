/** Message utilisateur quand GET …/snapshot renvoie autre chose que du JSON. */
export function syncSnapshotInvalidJsonMessage(body: string, language: 'fr' | 'en' = 'fr'): string {
  if (body.trim().startsWith('<')) {
    return language === 'en'
      ? 'The server returned an HTML page (often because the URL contains /pair). In Network, set http://IP:8091 only, or scan the pairing QR again.'
      : 'Le serveur renvoie une page HTML (souvent l’URL contient /pair). Dans Réseau, mettez uniquement http://IP:8091, ou refaites le scan QR d’appairage.';
  }
  return language === 'en'
    ? 'Invalid snapshot response (JSON expected). Reinstall the server from the app (Network) if it is outdated.'
    : 'Réponse snapshot invalide (JSON attendu). Réinstallez le serveur depuis l’APK (Réseau) si la version est ancienne.';
}

export function isInvalidSnapshotJsonError(message: string | undefined): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return m.includes('json') || m.includes('snapshot invalide') || m.includes('html');
}

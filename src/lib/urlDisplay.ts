/**
 * Libellés sans adresse IP ni numéro de port (mode grand public).
 */
const IPV4 = /^(\d{1,3}\.){3}\d{1,3}$/;

/** Indique si l’hôte ressemble à une IP privée / locale (sans l’afficher). */
export function isLocalOrIpHost(hostname: string): boolean {
  if (IPV4.test(hostname)) return true;
  const h = hostname.toLowerCase();
  return h === 'localhost' || h.endsWith('.local');
}

/**
 * Libellé utilisateur pour l’état de connexion (aucune IP, aucun port).
 */
export function connectionSurfaceLabel(resolvedBaseUrl: string): string {
  const t = resolvedBaseUrl.trim();
  if (!t) return 'Service Stage Stock';
  try {
    const u = new URL(t);
    if (isLocalOrIpHost(u.hostname)) {
      return 'Réseau local';
    }
    return 'Service en ligne';
  } catch {
    return 'Service Stage Stock';
  }
}

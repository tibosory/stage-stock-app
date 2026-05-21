/** Erreur explicite quand le téléphone n’a pas de clé API locale (jumelage /pair incomplet). */
export function missingSyncApiKeyError(scope = 'Sync'): Error {
  return new Error(
    `${scope} impossible : clé API manquante sur le téléphone.\n\n` +
      `Le serveur PC refuse la sync sans jumelage complet.\n` +
      `Connexion/Réseau → ouvrez la page /pair du PC et scannez le QR (clé incluse), ` +
      `ou saisissez la clé API du fichier .env du serveur.`
  );
}

/** Message utilisateur pour échecs HTTP de sync (Accueil Pro, inventaire). */
export function formatSyncHttpError(status: number, body: string, scope = 'Sync'): Error {
  const snippet = body.trim().slice(0, 280);
  if (status === 401) {
    let hint = '';
    try {
      const j = JSON.parse(body) as { hint?: string; error?: string };
      hint = j.hint?.trim() || j.error?.trim() || '';
    } catch {
      /* ignore */
    }
    return new Error(
      `${scope} refusée (HTTP 401 — non autorisé).\n\n` +
        `Le serveur PC exige une clé API valide.\n` +
        `• Ouvrez Connexion/Réseau → scannez le QR de la page /pair du PC (clé incluse),\n` +
        `  ou saisissez la clé API affichée dans le fichier .env du serveur.\n` +
        `• Si le serveur a été réinstallé, refaites le jumelage (ancienne clé invalide).` +
        (hint ? `\n\nServeur : ${hint}` : snippet ? `\n\n${snippet}` : '')
    );
  }
  if (status === 403) {
    return new Error(`${scope} refusée (HTTP 403). Droits ou clé API insuffisants.${snippet ? `\n\n${snippet}` : ''}`);
  }
  return new Error(`${scope} HTTP ${status}${snippet ? `: ${snippet}` : ''}`);
}

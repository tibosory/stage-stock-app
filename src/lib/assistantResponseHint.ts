function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Explique une réponse HTTP 200 sans objet `response` attendu par POST /ask. */
export function describeInvalidAssistantResponse(
  parsed: unknown,
  rawText: string,
  askUrl: string
): string {
  const text = rawText.trim();
  if (!text) {
    return (
      'Réponse vide du serveur (HTTP 200).\n\n' +
      'Vérifiez l’URL dans Réseau : http://IP:PORT (sans /pair, sans /api), puis Diagnostic → Réparer.'
    );
  }
  if (text.startsWith('<')) {
    return (
      'Page HTML reçue au lieu de l’assistant IA.\n\n' +
      'L’URL pointe probablement vers /pair ou un autre service. Mettez http://IP:PORT dans Réseau et refaites le scan QR.'
    );
  }
  if (isRecord(parsed)) {
    if (parsed.status === 'ok' && parsed.uptime != null) {
      return (
        'Mauvaise adresse : la requête n’atteint pas POST /ask (réponse /health).\n\n' +
        'Dans Réseau, URL = http://192.168.x.x:PORT uniquement.'
      );
    }
    if ('materiels' in parsed || 'counts' in parsed || 'ap_venues' in parsed) {
      return (
        'Mauvaise adresse : réponse inventaire reçue au lieu de l’assistant.\n\n' +
        'URL = racine du serveur (http://IP:PORT), pas un chemin /api/…'
      );
    }
    if (parsed.message === 'Stagestock API running') {
      return (
        'Mauvaise adresse API.\n\n' +
        'L’assistant appelle http://IP:PORT/ask — corrigez l’URL dans Réseau (sans suffixe /pair).'
      );
    }
    if (typeof parsed.error === 'string') {
      const detail = typeof parsed.detail === 'string' ? parsed.detail : undefined;
      const hint = typeof parsed.hint === 'string' ? parsed.hint : undefined;
      return [parsed.error, detail, hint ? `Indication : ${hint}` : '']
        .filter(Boolean)
        .join('\n\n');
    }
    const keys = Object.keys(parsed).slice(0, 8).join(', ');
    return (
      `Réponse serveur invalide pour l’assistant (champs reçus : ${keys}).\n\n` +
      `URL testée : ${askUrl}\n\n` +
      'Vérifiez Réseau → URL, Diagnostic → Réparer, et sur le PC : StageStock Local + Ollama (GET /diagnostic, section ai).'
    );
  }
  return (
    'Réponse serveur invalide pour l’assistant.\n\n' +
    `URL : ${askUrl}\n\n` +
    'Même Wi‑Fi, URL http://IP:PORT, jumelage QR, serveur et Ollama actifs sur le PC.'
  );
}
